import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Building2, User, MapPin, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { CLIENT_TYPE_LABELS, BUSINESS_ROLE_LABELS, type ClientType, type Client, type BusinessRole } from "@/types/database";

interface ClientFormDialogProps {
  onCreated?: (clientId: string) => void;
  onUpdated?: () => void;
  trigger?: React.ReactNode;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pass existing client for edit mode */
  editClient?: Client | null;
}

const emptyForm = {
  client_type: "PRIVATE" as ClientType,
  business_role: "CUSTOMER" as BusinessRole,
  first_name: "",
  last_name: "",
  company_name: "",
  phone: "",
  email: "",
  nip: "",
  regon: "",
  address_street: "",
  address_building: "",
  address_local: "",
  address_city: "",
  address_postal_code: "",
  address_country: "Polska",
  notes: "",
};

function clientToForm(client: Client) {
  return {
    client_type: client.client_type as ClientType,
    business_role: ((client as any).business_role ?? "CUSTOMER") as BusinessRole,
    first_name: client.first_name ?? "",
    last_name: client.last_name ?? "",
    company_name: client.company_name ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    nip: client.nip ?? "",
    regon: client.regon ?? "",
    address_street: client.address_street ?? "",
    address_building: (client as any).address_building ?? "",
    address_local: (client as any).address_local ?? "",
    address_city: client.address_city ?? "",
    address_postal_code: client.address_postal_code ?? "",
    address_country: client.address_country ?? "Polska",
    notes: client.notes ?? "",
  };
}

/** Build the payload for insert/update — NEVER include display_name (it's GENERATED ALWAYS) */
function buildPayload(form: typeof emptyForm) {
  return {
    client_type: form.client_type,
    business_role: form.business_role,
    first_name: form.first_name || null,
    last_name: form.last_name || null,
    company_name: form.company_name || null,
    phone: form.phone || null,
    email: form.email || null,
    nip: form.nip || null,
    regon: form.regon || null,
    address_street: form.address_street || null,
    address_building: form.address_building || null,
    address_local: form.address_local || null,
    address_city: form.address_city || null,
    address_postal_code: form.address_postal_code || null,
    address_country: form.address_country || null,
    notes: form.notes || null,
  };
}

export function ClientFormDialog({ onCreated, onUpdated, trigger, externalOpen, onOpenChange, editClient }: ClientFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (externalOpen !== undefined) {
      onOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };

  const isEdit = !!editClient;
  const [form, setForm] = useState({ ...emptyForm });
  const { user } = useAuth();
  const qc = useQueryClient();

  // Reset/populate form when dialog opens/closes or editClient changes
  useEffect(() => {
    if (open) {
      setForm(editClient ? clientToForm(editClient) : { ...emptyForm });
    }
  }, [open, editClient]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form);

      if (isEdit) {
        const { error } = await supabase
          .from("clients")
          .update({ ...payload, updated_by: user?.id })
          .eq("id", editClient!.id);
        if (error) throw error;
        return { id: editClient!.id };
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert({ ...payload, created_by: user?.id })
          .select("id")
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clients-select"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", editClient?.id] });
      toast.success(isEdit ? "Klient zaktualizowany" : "Klient dodany");
      if (isEdit) {
        onUpdated?.();
      } else {
        onCreated?.(data.id);
      }
      setOpen(false);
    },
    onError: (err: any) => {
      console.error("Client save error:", err);
      toast.error(err?.message || "Błąd zapisu klienta");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Validation
    if (form.client_type === "COMPANY" && !form.company_name.trim()) {
      toast.error("Nazwa firmy jest wymagana");
      return;
    }
    if (form.client_type === "PRIVATE" && !form.first_name.trim() && !form.last_name.trim()) {
      toast.error("Imię lub nazwisko jest wymagane");
      return;
    }

    saveMutation.mutate();
  };

  const dialogContent = (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edytuj klienta" : "Nowy klient"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Typ klienta</Label>
            <Select value={form.client_type} onValueChange={(v) => setForm({ ...form, client_type: v as ClientType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map((k) => (
                  <SelectItem key={k} value={k}>{CLIENT_TYPE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Rola biznesowa</Label>
            <Select value={form.business_role} onValueChange={(v) => setForm({ ...form, business_role: v as BusinessRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(BUSINESS_ROLE_LABELS) as BusinessRole[]).map((k) => (
                  <SelectItem key={k} value={k}>{BUSINESS_ROLE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.client_type === "COMPANY" && (
          <>
            <div className="space-y-1.5">
              <Label>Nazwa firmy *</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>NIP</Label>
                <Input value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>REGON</Label>
                <Input value={form.regon} onChange={(e) => setForm({ ...form, regon: e.target.value })} />
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{form.client_type === "COMPANY" ? "Imię kontaktowe" : "Imię *"}</Label>
            <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{form.client_type === "COMPANY" ? "Nazwisko kontaktowe" : "Nazwisko *"}</Label>
            <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Telefon</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Ulica</Label>
            <Input value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Kod pocztowy</Label>
            <Input value={form.address_postal_code} onChange={(e) => setForm({ ...form, address_postal_code: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Miasto</Label>
            <Input value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Kraj</Label>
            <Input value={form.address_country} onChange={(e) => setForm({ ...form, address_country: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Uwagi</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Zapisywanie..." : isEdit ? "Zapisz zmiany" : "Dodaj klienta"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );

  if (externalOpen !== undefined) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm"><Plus className="mr-1 h-4 w-4" />Dodaj klienta</Button>}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
