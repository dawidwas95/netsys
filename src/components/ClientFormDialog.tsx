import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGusLookup } from "@/hooks/useGusLookup";
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
import { Plus, Building2, User, MapPin, Phone, Mail, Globe, Loader2 } from "lucide-react";
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
  /** Prefill data for new client (e.g. from OCR) */
  initialData?: Partial<typeof emptyForm> | null;
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

export function ClientFormDialog({ onCreated, onUpdated, trigger, externalOpen, onOpenChange, editClient, initialData }: ClientFormDialogProps) {
  const { lookupNip, loading: gusLoading } = useGusLookup();
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
      if (editClient) {
        setForm(clientToForm(editClient));
      } else if (initialData) {
        setForm({ ...emptyForm, ...initialData });
      } else {
        setForm({ ...emptyForm });
      }
    }
  }, [open, editClient, initialData]);

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
    <DialogContent className="max-w-[800px] max-h-[90vh] overflow-hidden p-0" onPointerDownOutside={(e) => e.preventDefault()}>
      <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {form.client_type === "COMPANY" ? <Building2 className="h-5 w-5 text-muted-foreground" /> : <User className="h-5 w-5 text-muted-foreground" />}
              {isEdit ? "Edytuj kontrahenta" : "Nowy kontrahent"}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Section: Basic info */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dane podstawowe</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Typ kontrahenta</Label>
                <Select value={form.client_type} onValueChange={(v) => setForm({ ...form, client_type: v as ClientType })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map((k) => (
                      <SelectItem key={k} value={k}>{CLIENT_TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Rola biznesowa</Label>
                <Select value={form.business_role} onValueChange={(v) => setForm({ ...form, business_role: v as BusinessRole })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(BUSINESS_ROLE_LABELS) as BusinessRole[]).map((k) => (
                      <SelectItem key={k} value={k}>{BUSINESS_ROLE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Company fields */}
          {form.client_type === "COMPANY" && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dane firmy</h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nazwa firmy *</Label>
                    <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="h-10" required />
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">NIP</Label>
                      <div className="flex gap-2">
                        <Input value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} placeholder="0000000000" className="h-10 font-mono flex-1" />
                        <Button type="button" variant="outline" size="sm" className="h-10 whitespace-nowrap" disabled={gusLoading || !form.nip}
                          onClick={async () => {
                            const data = await lookupNip(form.nip);
                            if (data) setForm(prev => ({
                              ...prev,
                              company_name: data.company_name || prev.company_name,
                              first_name: data.first_name || prev.first_name,
                              last_name: data.last_name || prev.last_name,
                              nip: data.nip,
                              regon: data.regon || prev.regon,
                              address_street: data.street || prev.address_street,
                              address_building: data.building || prev.address_building,
                              address_local: data.local || prev.address_local,
                              address_postal_code: data.postal_code || prev.address_postal_code,
                              address_city: data.city || prev.address_city,
                              address_country: data.country || prev.address_country,
                            }));
                          }}>
                          {gusLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                          <span className="ml-1.5">Pobierz z GUS</span>
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">REGON</Label>
                      <Input value={form.regon} onChange={(e) => setForm({ ...form, regon: e.target.value })} className="h-10 font-mono" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Section: Person */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {form.client_type === "COMPANY" ? "Osoba kontaktowa" : "Dane osobowe"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{form.client_type === "COMPANY" ? "Imię" : "Imię *"}</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{form.client_type === "COMPANY" ? "Nazwisko" : "Nazwisko *"}</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="h-10" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section: Contact */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Kontakt
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Telefon</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+48..." className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section: Address */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Adres
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_100px_80px] gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ulica</Label>
                  <Input value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nr budynku</Label>
                  <Input value={form.address_building} onChange={(e) => setForm({ ...form, address_building: e.target.value })} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nr lokalu</Label>
                  <Input value={form.address_local} onChange={(e) => setForm({ ...form, address_local: e.target.value })} className="h-10" />
                </div>
              </div>
              <div className="grid grid-cols-[120px_1fr_1fr] gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Kod pocztowy</Label>
                  <Input value={form.address_postal_code} onChange={(e) => setForm({ ...form, address_postal_code: e.target.value })} placeholder="00-000" className="h-10 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Miasto</Label>
                  <Input value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Kraj</Label>
                  <Input value={form.address_country} onChange={(e) => setForm({ ...form, address_country: e.target.value })} className="h-10" />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section: Notes */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Uwagi</h3>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Dodatkowe informacje o kontrahencie..." />
          </div>
        </div>

        {/* Footer - sticky */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-10 px-6">Anuluj</Button>
          <Button type="submit" disabled={saveMutation.isPending} className="h-10 px-8">
            {saveMutation.isPending ? "Zapisywanie..." : isEdit ? "Zapisz zmiany" : "Dodaj kontrahenta"}
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
