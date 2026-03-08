import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Address = { street: string; building: string; local: string; postal_code: string; city: string };

type NameCandidate = {
  source: string;
  value: string;
};

function parseAddress(raw: string | null): Address {
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

function asCleanString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function hasBusinessMarker(name: string): boolean {
  return /(SP\.?\s*Z\s*O\.?\s*O\.?|SPÓŁKA|FIRMA|USŁUGI|PRZEDSIĘBIORSTWO|BIURO|SERWIS|STUDIO|SKLEP|TECH|SYSTEM|CONSULTING|GROUP|TEAM|SOLUTIONS|\-|_)/i.test(name);
}

function isLikelyPersonalName(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  const words = n.split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  if (hasBusinessMarker(n)) return false;
  return words.every((w) => /^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+$/.test(w));
}

function pickFirstNonEmpty(subject: Record<string, unknown>, fields: string[]): NameCandidate[] {
  return fields
    .map((field) => ({ source: field, value: asCleanString(subject[field]) }))
    .filter((c) => c.value.length > 0);
}

function parseOwnerFromRepresentatives(representatives: unknown): { first_name: string | null; last_name: string | null } {
  if (!representatives) return { first_name: null, last_name: null };

  let ownerFull = "";
  if (Array.isArray(representatives) && representatives.length > 0) {
    const rep = representatives[0] as Record<string, unknown> | string;
    if (typeof rep === "string") ownerFull = rep.trim();
    else ownerFull = (asCleanString(rep.name) || `${asCleanString(rep.firstName)} ${asCleanString(rep.lastName)}`.trim()).trim();
  } else if (typeof representatives === "string") {
    ownerFull = representatives.split(",")[0].trim();
  }

  const parts = ownerFull.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
  }
  return { first_name: null, last_name: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nip } = await req.json();
    if (!nip) throw new Error("NIP jest wymagany");

    const cleanNip = String(nip).replace(/^PL/i, "").replace(/[\s\-]/g, "");
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
    const subject = (data?.result?.subject ?? null) as Record<string, unknown> | null;

    if (!subject) {
      return new Response(JSON.stringify({ error: "Nie znaleziono podmiotu o podanym NIP" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isJdg = !asCleanString(subject.krs);
    const address = parseAddress(asCleanString(subject.workingAddress) || asCleanString(subject.residenceAddress) || null);

    const owner = parseOwnerFromRepresentatives(subject.representatives);

    const nameCandidates = pickFirstNonEmpty(subject, [
      "name",
      "tradeName",
      "businessName",
      "firmName",
      "fullName",
      "companyName",
      "entityName",
    ]);

    const primaryBusiness = nameCandidates.find((c) => hasBusinessMarker(c.value) || (c.value.split(/\s+/).length >= 3 && !isLikelyPersonalName(c.value)));
    const alternativeBusiness = nameCandidates[0] ?? null;
    const fallbackOwnerName = [owner.first_name, owner.last_name].filter(Boolean).join(" ") || null;

    let chosenCompanyName = "";
    let chosenSource = "";

    if (isJdg) {
      if (primaryBusiness?.value) {
        chosenCompanyName = primaryBusiness.value;
        chosenSource = primaryBusiness.source;
      } else if (alternativeBusiness?.value) {
        chosenCompanyName = alternativeBusiness.value;
        chosenSource = alternativeBusiness.source;
      } else if (fallbackOwnerName) {
        chosenCompanyName = fallbackOwnerName;
        chosenSource = "owner(first_name+last_name)";
      }
    } else {
      chosenCompanyName = alternativeBusiness?.value || fallbackOwnerName || "";
      chosenSource = alternativeBusiness?.source || "owner(first_name+last_name)";
    }

    // Last-resort owner split for JDG when representatives are empty
    let firstName = owner.first_name;
    let lastName = owner.last_name;
    if (!firstName && isJdg && chosenCompanyName) {
      const parts = chosenCompanyName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        firstName = parts[parts.length - 2];
        lastName = parts[parts.length - 1];
      }
    }

    const candidateLog = nameCandidates.reduce<Record<string, string>>((acc, c) => {
      acc[c.source] = c.value;
      return acc;
    }, {});

    console.log("JDG mapping debug:", JSON.stringify({
      nip: cleanNip,
      entity_type: isJdg ? "JDG" : "OTHER",
      raw_subject_name: asCleanString(subject.name),
      raw_subject_keys: Object.keys(subject),
      company_name_candidates: candidateLog,
      chosen_company_name: chosenCompanyName || null,
      chosen_company_name_source: chosenSource || null,
    }));

    const result = {
      company_name: chosenCompanyName || null,
      company_name_source: chosenSource || null,
      first_name: firstName,
      last_name: lastName,
      nip: cleanNip,
      regon: asCleanString(subject.regon) || null,
      krs: asCleanString(subject.krs) || null,
      street: address.street,
      building: address.building,
      local: address.local,
      postal_code: address.postal_code,
      city: address.city,
      country: "Polska",
      vat_status: asCleanString(subject.statusVat) || null,
      is_jdg: isJdg,
      is_person_name_only: isLikelyPersonalName(chosenCompanyName),
      debug_company_name_candidates: candidateLog,
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
