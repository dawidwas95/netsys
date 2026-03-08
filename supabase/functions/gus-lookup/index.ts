import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Parse Polish "White List" address like "RONDO IGNACEGO DASZYŃSKIEGO 2C, 00-843 WARSZAWA" */
function parseAddress(raw: string | null): { street: string; building: string; local: string; postal_code: string; city: string } {
  const result = { street: "", building: "", local: "", postal_code: "", city: "" };
  if (!raw) return result;

  // Format: "STREET NUMBER[/LOCAL], POSTAL CITY"
  const commaIdx = raw.lastIndexOf(",");
  if (commaIdx === -1) {
    result.street = raw.trim();
    return result;
  }

  const streetPart = raw.substring(0, commaIdx).trim();
  const cityPart = raw.substring(commaIdx + 1).trim();

  // Parse city part: "00-843 WARSZAWA"
  const postalMatch = cityPart.match(/^(\d{2}-\d{3})\s+(.+)$/);
  if (postalMatch) {
    result.postal_code = postalMatch[1];
    result.city = postalMatch[2];
  } else {
    result.city = cityPart;
  }

  // Parse street part: "UL. EXAMPLE 25/3" or "RONDO DASZYŃSKIEGO 2C"
  // Try to extract building number (and optional local) from the end
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nip } = await req.json();
    if (!nip) throw new Error("NIP jest wymagany");

    // Clean NIP
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
      throw new Error(`GUS API error: ${response.status}`);
    }

    const data = await response.json();
    const subject = data?.result?.subject;

    if (!subject) {
      return new Response(JSON.stringify({ error: "Nie znaleziono podmiotu o podanym NIP" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const address = parseAddress(subject.workingAddress || subject.residenceAddress);

    const result = {
      company_name: subject.name || null,
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
    };

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
