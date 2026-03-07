import { useState, useEffect } from "react";
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
import { Plus, Cpu } from "lucide-react";
import { toast } from "sonner";
import { DEVICE_CATEGORY_LABELS, type DeviceCategory, type Device } from "@/types/database";

interface DeviceFormDialogProps {
  clientId?: string;
  onCreated?: (deviceId: string) => void;
  onUpdated?: () => void;
  trigger?: React.ReactNode;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  editDevice?: Device | null;
}

const RAM_TYPES = ["DDR1", "DDR2", "DDR3", "DDR4", "DDR5"] as const;
const STORAGE_TYPES = ["HDD", "SSD", "NVMe"] as const;

const emptyForm = {
  client_id: "",
  device_category: "OTHER" as DeviceCategory,
  manufacturer: "",
  model: "",
  serial_number: "",
  imei: "",
  description: "",
  notes: "",
  cpu: "",
  ram_gb: "",
  ram_type: "",
  gpu: "",
  storage1_type: "",
  storage1_size: "",
  storage2_type: "",
  storage2_size: "",
  operating_system: "",
  motherboard: "",
  psu: "",
  specification_notes: "",
};

function deviceToForm(d: Device, clientId?: string) {
  return {
    client_id: d.client_id ?? clientId ?? "",
    device_category: d.device_category as DeviceCategory,
    manufacturer: d.manufacturer ?? "",
    model: d.model ?? "",
    serial_number: d.serial_number ?? "",
    imei: d.imei ?? "",
    description: d.description ?? "",
    notes: d.notes ?? "",
    cpu: d.cpu ?? "",
    ram_gb: d.ram_gb?.toString() ?? "",
    ram_type: d.ram_type ?? "",
    gpu: d.gpu ?? "",
    storage1_type: d.storage1_type ?? "",
    storage1_size: d.storage1_size ?? "",
    storage2_type: d.storage2_type ?? "",
    storage2_size: d.storage2_size ?? "",
    operating_system: d.operating_system ?? "",
    motherboard: d.motherboard ?? "",
    psu: d.psu ?? "",
    specification_notes: d.specification_notes ?? "",
  };
}

export function DeviceFormDialog({ clientId, onCreated, onUpdated, trigger, externalOpen, onOpenChange, editDevice }: DeviceFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (externalOpen !== undefined) {
      onOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };

  const isEdit = !!editDevice;
  const [form, setForm] = useState({ ...emptyForm, client_id: clientId ?? "" });
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm(editDevice ? deviceToForm(editDevice, clientId) : { ...emptyForm, client_id: clientId ?? "" });
    }
  }, [open, editDevice, clientId]);

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
    enabled: !clientId && !isEdit,
  });

  const showSpecs = form.device_category === "DESKTOP" || form.device_category === "LAPTOP";

  const saveMutation = useMutation({
    mutationFn: async () => {
      const insertData: Record<string, any> = {
        client_id: form.client_id || null,
        device_category: form.device_category,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        imei: form.imei || null,
        description: form.description || null,
        notes: form.notes || null,
      };

      if (showSpecs) {
        insertData.cpu = form.cpu || null;
        insertData.ram_gb = form.ram_gb ? parseInt(form.ram_gb) : null;
        insertData.ram_type = form.ram_type || null;
        insertData.gpu = form.gpu || null;
        insertData.storage1_type = form.storage1_type || null;
        insertData.storage1_size = form.storage1_size || null;
        insertData.storage2_type = form.storage2_type || null;
        insertData.storage2_size = form.storage2_size || null;
        insertData.operating_system = form.operating_system || null;
        insertData.motherboard = form.motherboard || null;
        insertData.psu = form.psu || null;
        insertData.specification_notes = form.specification_notes || null;
      }

      if (isEdit) {
        const { error } = await supabase
          .from("devices")
          .update({ ...insertData, updated_by: user?.id })
          .eq("id", editDevice!.id);
        if (error) throw error;
        return { id: editDevice!.id };
      } else {
        const { data, error } = await supabase.from("devices").insert({ ...insertData, created_by: user?.id }).select("id").single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["client-devices"] });
      qc.invalidateQueries({ queryKey: ["client-devices-select"] });
      toast.success(isEdit ? "Urządzenie zaktualizowane" : "Urządzenie dodane");
      if (isEdit) {
        onUpdated?.();
      } else {
        onCreated?.(data.id);
      }
      setOpen(false);
    },
    onError: (err: any) => {
      console.error("Device save error:", err);
      toast.error(err?.message || "Błąd zapisu urządzenia");
    },
  });

  function getClientLabel(c: any) {
    return c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    saveMutation.mutate();
  };

  const dialogContent = (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
      <DialogHeader><DialogTitle>{isEdit ? "Edytuj urządzenie" : "Nowe urządzenie"}</DialogTitle></DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!clientId && !isEdit && (
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

        {showSpecs && (
          <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Cpu className="h-4 w-4" /> Specyfikacja techniczna
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Procesor</Label><Input value={form.cpu} onChange={(e) => setForm({ ...form, cpu: e.target.value })} placeholder="np. Intel i7-12700" className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Karta graficzna</Label><Input value={form.gpu} onChange={(e) => setForm({ ...form, gpu: e.target.value })} placeholder="np. RTX 3060" className="h-8 text-sm" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">RAM (GB)</Label><Input type="number" value={form.ram_gb} onChange={(e) => setForm({ ...form, ram_gb: e.target.value })} placeholder="16" className="h-8 text-sm" /></div>
              <div>
                <Label className="text-xs">Typ RAM</Label>
                <Select value={form.ram_type} onValueChange={(v) => setForm({ ...form, ram_type: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>{RAM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Płyta główna</Label><Input value={form.motherboard} onChange={(e) => setForm({ ...form, motherboard: e.target.value })} placeholder="np. ASUS B660" className="h-8 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dysk 1 — typ</Label>
                <Select value={form.storage1_type} onValueChange={(v) => setForm({ ...form, storage1_type: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>{STORAGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Dysk 1 — pojemność</Label><Input value={form.storage1_size} onChange={(e) => setForm({ ...form, storage1_size: e.target.value })} placeholder="np. 512 GB" className="h-8 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dysk 2 — typ</Label>
                <Select value={form.storage2_type} onValueChange={(v) => setForm({ ...form, storage2_type: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>{STORAGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Dysk 2 — pojemność</Label><Input value={form.storage2_size} onChange={(e) => setForm({ ...form, storage2_size: e.target.value })} placeholder="np. 1 TB" className="h-8 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">System operacyjny</Label><Input value={form.operating_system} onChange={(e) => setForm({ ...form, operating_system: e.target.value })} placeholder="np. Windows 11 Pro" className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Zasilacz</Label><Input value={form.psu} onChange={(e) => setForm({ ...form, psu: e.target.value })} placeholder="np. 650W" className="h-8 text-sm" /></div>
            </div>
            <div><Label className="text-xs">Dodatkowa specyfikacja / uwagi</Label><Textarea value={form.specification_notes} onChange={(e) => setForm({ ...form, specification_notes: e.target.value })} rows={2} className="text-sm" /></div>
          </div>
        )}

        <div><Label>Opis</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><Label>Notatki</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Zapisywanie..." : isEdit ? "Zapisz zmiany" : "Dodaj urządzenie"}
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
        {trigger ?? <Button><Plus className="mr-2 h-4 w-4" />Dodaj urządzenie</Button>}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
