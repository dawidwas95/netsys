import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Parse Polish "White List" address like "RONDO IGNACEGO DASZYŃSKIEGO 2C, 00-843 WARSZAWA" */
function parseAddress(raw: string | null): { street: string; building: string; local: string; postal_code: string; city: string } {
  const result = { street: "", building: "", local: "", postal_code: "", city: "" };
  if (!raw) return result;

  const commaIdx = raw.lastIndexOf(",");
  if (commaIdx === -1) {
    result.street = raw.trim();
    return result;
  }

  const streetPart = raw.substring(0, commaIdx).trim();
  const cityPart = raw.substring(commaIdx + 1).trim();

  const postalMatch = cityPart.match(/^(\d{2}-\d{3})\s+(.+)$/);
  if (postalMatch) {
    result.postal_code = postalMatch[1];
    result.city = postalMatch[2];
  } else {
    result.city = cityPart;
  }

  const streetMatch = streetPart.match(/^(.+?)\s+(\d+\w*(?:\/\d+\w*)?)$/);
  if (streetMatch) {
    result.street = streetMatch[1];
    const numParts = streetMatch[2].split("/");
    result.building = numParts[0];
    result.local = numParts[1] || "";
  } else {
    result.street = streetPart;
  }

  return result;
}

/** Try CEIDG API to get JDG business name */
async function lookupCeidg(nip: string): Promise<{ name: string; firstName: string; lastName: string } | null> {
  try {
    const url = `https://dane.biznes.gov.pl/api/ceidg/v2/firma?nip=${nip}`;
    const resp = await fetch(url, {
      headers: { "Accept": "application/json" },
    });
    if (!resp.ok) {
      await resp.text();
      return null;
    }
    const data = await resp.json();
    console.log("CEIDG raw response:", JSON.stringify(data).substring(0, 2000));
    
    // CEIDG v2 returns { firpimy: [...] } or { firma: [...] }
    const firms = data?.firmy || data?.firma || [];
    const firm = Array.isArray(firms) ? firms[0] : firms;
    if (!firm) return null;

    // CEIDG fields: nazwa (full business name), imie, nazwisko
    const name = firm.nazwa || firm.name || null;
    const firstName = firm.imie || firm.wlasciciel?.imie || null;
    const lastName = firm.nazwisko || firm.wlasciciel?.nazwisko || null;

    if (name) {
      return { name, firstName: firstName || "", lastName: lastName || "" };
    }
    return null;
  } catch (e) {
    console.log("CEIDG lookup failed:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nip } = await req.json();
    if (!nip) throw new Error("NIP jest wymagany");

    const cleanNip = nip.replace(/^PL/i, "").replace(/[\s\-]/g, "");
    if (!/^\d{10}$/.test(cleanNip)) {
      return new Response(JSON.stringify({ error: "Nieprawidłowy format NIP (wymagane 10 cyfr)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const url = `https://wl-api.mf.gov.pl/api/search/nip/${cleanNip}?date=${today}`;

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 400) {
        return new Response(JSON.stringify({ error: "Nieprawidłowy NIP" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`White List API error: ${response.status}`);
    }

    const data = await response.json();
    const subject = data?.result?.subject;

    if (!subject) {
      return new Response(JSON.stringify({ error: "Nie znaleziono podmiotu o podanym NIP" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Debug: log all subject fields to identify what the API returns
    console.log("White List subject keys:", Object.keys(subject));
    console.log("White List subject.name:", subject.name);
    console.log("White List subject.tradeName:", subject.tradeName);
    console.log("White List subject.krs:", subject.krs);
    console.log("White List subject.residenceAddress:", subject.residenceAddress);
    console.log("White List subject.workingAddress:", subject.workingAddress);
    console.log("White List subject.representatives type:", typeof subject.representatives, 
      Array.isArray(subject.representatives) ? `(array, len=${subject.representatives.length})` : "");

    const address = parseAddress(subject.workingAddress || subject.residenceAddress);

    // Determine the best company name.
    // White List `subject.name` is the full registered name for both sp. z o.o. and JDG.
    // For JDG it should be e.g. "DW-TECH DAWID WAŚ", not just "DAWID WAŚ".
    // However, some results might only have owner name. We check multiple fields.
    let companyName = subject.name || null;
    let firstName: string | null = null;
    let lastName: string | null = null;
    const isJdg = !subject.krs;

    // Extract first/last name from representatives
    const reps = subject.representatives;
    if (reps) {
      let repName = "";
      if (Array.isArray(reps) && reps.length > 0) {
        const rep = reps[0];
        repName = typeof rep === "string" ? rep : (rep.name || `${rep.firstName || ""} ${rep.lastName || ""}`.trim());
      } else if (typeof reps === "string") {
        repName = reps.split(",")[0].trim();
      }
      if (repName) {
        const parts = repName.trim().split(/\s+/);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(" ");
        }
      }
    }

    // For JDG: if companyName looks like just "FIRST LAST" (2 words, no business prefix),
    // try CEIDG to get the real business name
    if (isJdg && companyName) {
      const nameWords = companyName.trim().split(/\s+/);
      const looksLikePersonalNameOnly = nameWords.length === 2 && 
        nameWords.every(w => /^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+$/.test(w));
      
      if (looksLikePersonalNameOnly) {
        console.log("Company name looks like personal name only, trying CEIDG...");
        const ceidgData = await lookupCeidg(cleanNip);
        if (ceidgData && ceidgData.name && ceidgData.name.trim().split(/\s+/).length > 2) {
          console.log("CEIDG returned better business name:", ceidgData.name);
          companyName = ceidgData.name;
          if (ceidgData.firstName) firstName = ceidgData.firstName;
          if (ceidgData.lastName) lastName = ceidgData.lastName;
        }
      }
    }

    // If no first/last extracted yet, try parsing from name for JDG
    if (!firstName && isJdg && companyName) {
      const nameParts = companyName.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        lastName = nameParts[nameParts.length - 1];
        firstName = nameParts[nameParts.length - 2];
      }
    }

    const result = {
      company_name: companyName,
      first_name: firstName,
      last_name: lastName,
      nip: cleanNip,
      regon: subject.regon || null,
      krs: subject.krs || null,
      street: address.street,
      building: address.building,
      local: address.local,
      postal_code: address.postal_code,
      city: address.city,
      country: "Polska",
      vat_status: subject.statusVat || null,
      is_jdg: isJdg,
      _debug_raw_name: subject.name,
      _debug_trade_name: subject.tradeName || null,
    };

    console.log("Final result:", JSON.stringify(result));

    return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gus-lookup error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
