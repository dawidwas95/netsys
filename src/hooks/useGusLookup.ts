import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GusCompanyData {
  company_name: string | null;
  nip: string;
  regon: string | null;
  krs: string | null;
  street: string;
  building: string;
  local: string;
  postal_code: string;
  city: string;
  country: string;
  vat_status: string | null;
}

export function useGusLookup() {
  const [loading, setLoading] = useState(false);

  async function lookupNip(nip: string): Promise<GusCompanyData | null> {
    const cleanNip = nip.replace(/^PL/i, "").replace(/[\s\-]/g, "");
    if (!/^\d{10}$/.test(cleanNip)) {
      toast.error("Nieprawidłowy format NIP (wymagane 10 cyfr)");
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gus-lookup", {
        body: { nip: cleanNip },
      });

      if (error) throw new Error(error.message);
      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      toast.success(`Pobrano dane: ${data.data.company_name}`);
      return data.data as GusCompanyData;
    } catch (err: any) {
      toast.error(err?.message || "Błąd pobierania danych z GUS");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { lookupNip, loading };
}
