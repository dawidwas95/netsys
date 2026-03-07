import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { DEVICE_CATEGORY_LABELS, type DeviceCategory } from "@/types/database";

interface DeviceFormDialogProps {
  clientId?: string;
  onCreated?: (deviceId: string) => void;
  trigger?: React.ReactNode;
}

const emptyForm = {
  client_id: "",
  device_category: "OTHER" as DeviceCategory,
  manufacturer: "",
  model: "",
  serial_number: "",
  imei: "",
  description: "",
  notes: "",
};

export function DeviceFormDialog({ clientId, onCreated, trigger }: DeviceFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, client_id: clientId ?? "" });
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, display_name, company_name, first_name, last_name")
        .eq("is_active", true)
        .order("display_name");
      return data ?? [];
    },
    enabled: !clientId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("devices").insert({
        client_id: form.client_id || null,
        device_category: form.device_category,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        imei: form.imei || null,
        description: form.description || null,
        notes: form.notes || null,
        created_by: user?.id,
      }).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["client-devices"] });
      toast.success("Urządzenie dodane");
      onCreated?.(data.id);
      setForm({ ...emptyForm, client_id: clientId ?? "" });
      setOpen(false);
    },
    onError: () => toast.error("Błąd dodawania urządzenia"),
  });

  function getClientLabel(c: any) {
    return c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) setForm({ ...emptyForm, client_id: clientId ?? "" });
    }}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="mr-2 h-4 w-4" />Dodaj urządzenie</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nowe urządzenie</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!clientId && (
            <div>
              <Label>Klient</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Wybierz klienta" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{getClientLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Kategoria *</Label>
            <Select value={form.device_category} onValueChange={(v) => setForm({ ...form, device_category: v as DeviceCategory })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(DEVICE_CATEGORY_LABELS) as DeviceCategory[]).map((k) => (
                  <SelectItem key={k} value={k}>{DEVICE_CATEGORY_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Producent</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
            <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Numer seryjny</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
            <div><Label>IMEI</Label><Input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} placeholder="Dla telefonów" /></div>
          </div>
          <div><Label>Opis</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Notatki</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Zapisywanie..." : "Dodaj urządzenie"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
