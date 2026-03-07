import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CLIENT_TYPE_LABELS, type ClientType } from "@/types/database";

interface ClientFormDialogProps {
  onCreated?: (clientId: string) => void;
  trigger?: React.ReactNode;
}

const emptyForm = {
  client_type: "PRIVATE" as ClientType,
  first_name: "",
  last_name: "",
  company_name: "",
  phone: "",
  email: "",
  nip: "",
  address_street: "",
  address_city: "",
  address_postal_code: "",
};

export function ClientFormDialog({ onCreated, trigger }: ClientFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const { user } = useAuth();
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const displayName = form.client_type === "COMPANY"
        ? form.company_name
        : [form.first_name, form.last_name].filter(Boolean).join(" ");

      const { data, error } = await supabase.from("clients").insert({
        client_type: form.client_type,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        company_name: form.company_name || null,
        display_name: displayName || null,
        phone: form.phone || null,
        email: form.email || null,
        nip: form.nip || null,
        address_street: form.address_street || null,
        address_city: form.address_city || null,
        address_postal_code: form.address_postal_code || null,
        created_by: user?.id,
      }).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clients-select"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Klient dodany");
      onCreated?.(data.id);
      setForm({ ...emptyForm });
      setOpen(false);
    },
    onError: () => toast.error("Błąd dodawania klienta"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm({ ...emptyForm }); }}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm"><Plus className="mr-1 h-4 w-4" />Dodaj klienta</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nowy klient</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
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
          {form.client_type === "COMPANY" && (
            <div>
              <Label>Nazwa firmy *</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Imię</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Nazwisko</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          {form.client_type === "COMPANY" && (
            <div><Label>NIP</Label><Input value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} /></div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2"><Label>Ulica</Label><Input value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} /></div>
            <div><Label>Kod pocztowy</Label><Input value={form.address_postal_code} onChange={(e) => setForm({ ...form, address_postal_code: e.target.value })} /></div>
          </div>
          <div><Label>Miasto</Label><Input value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Zapisywanie..." : "Dodaj klienta"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
