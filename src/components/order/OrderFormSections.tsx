import { useState, useMemo } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  User, Monitor, ClipboardList, Wrench, DollarSign, CreditCard,
  Phone, Mail, MapPin, Info, TrendingUp, TrendingDown, Percent, Plus, X,
  Eye, EyeOff, Shield,
} from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ClientFormDialog } from "@/components/ClientFormDialog";
import { DeviceFormDialog } from "@/components/DeviceFormDialog";
import {
  ORDER_STATUS_LABELS, ORDER_PRIORITY_LABELS, SERVICE_TYPE_LABELS,
  INTAKE_CHANNEL_LABELS, PAYMENT_METHOD_LABELS, DEVICE_CATEGORY_LABELS,
  type OrderStatus, type OrderPriority, type ServiceType,
  type IntakeChannel, type PaymentMethod, type DeviceCategory,
} from "@/types/database";
import { cn } from "@/lib/utils";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

export function FormSection({ icon: Icon, title, children, className, accent }: {
  icon: React.ElementType; title: string; children: React.ReactNode; className?: string; accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border border-border bg-card p-5 space-y-4",
      accent && "border-primary/30 bg-primary/[0.02]",
      className,
    )}>
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Icon className={cn("h-4 w-4", accent ? "text-primary" : "text-muted-foreground")} />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ClientPreview({ client }: { client: any }) {
  if (!client) return null;
  return (
    <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1 mt-2">
      <div className="font-medium flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-muted-foreground" />
        {client.display_name || client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ")}
      </div>
      {client.phone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" />{client.phone}</div>}
      {client.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" />{client.email}</div>}
      {(client.address_street || client.address_city) && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {[client.address_street, client.address_postal_code, client.address_city].filter(Boolean).join(", ")}
        </div>
      )}
    </div>
  );
}

function DevicePreview({ device }: { device: any }) {
  if (!device) return null;
  return (
    <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1 mt-2">
      <div className="font-medium flex items-center gap-1.5">
        <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
        {device.manufacturer} {device.model}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs">{DEVICE_CATEGORY_LABELS[device.device_category as DeviceCategory] || device.device_category}</Badge>
        {device.serial_number && <span className="text-xs text-muted-foreground font-mono">S/N: {device.serial_number}</span>}
        {device.imei && <span className="text-xs text-muted-foreground font-mono">IMEI: {device.imei}</span>}
      </div>
    </div>
  );
}

// ═══ CLIENT SECTION ═══
export function ClientSection({ clientId, onChange }: { clientId?: string; onChange: (clientId: string | undefined) => void; }) {
  const queryClient = useQueryClient();
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data } = await supabase.from("clients")
        .select("id, display_name, company_name, first_name, last_name, phone, email, nip, address_city, address_street, address_postal_code")
        .eq("is_active", true).order("display_name");
      return data ?? [];
    },
  });
  const selectedClient = clients.find((c: any) => c.id === clientId);
  const clientOptions = clients.map((c: any) => ({
    value: c.id,
    label: c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
    sublabel: [c.phone, c.nip, c.address_city].filter(Boolean).join(" · "),
  }));

  return (
    <FormSection icon={User} title="Klient">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Wyszukaj klienta *</Label>
        <SearchableSelect options={clientOptions} value={clientId ?? ""} onChange={(v) => onChange(v || undefined)} placeholder="Wpisz nazwisko, firmę, telefon, NIP..." onAddNew={() => setClientDialogOpen(true)} addNewLabel="Dodaj nowego klienta" />
      </div>
      <ClientPreview client={selectedClient} />
      <ClientFormDialog externalOpen={clientDialogOpen} onOpenChange={setClientDialogOpen} onCreated={(id) => { queryClient.invalidateQueries({ queryKey: ["clients-select"] }); onChange(id); }} />
    </FormSection>
  );
}

// ═══ DEVICE SECTION ═══
export function DeviceSection({ clientId, deviceId, onChange }: { clientId?: string; deviceId?: string; onChange: (deviceId: string | undefined) => void; }) {
  const queryClient = useQueryClient();
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const { data: devices = [] } = useQuery({
    queryKey: ["client-devices-select", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("devices").select("id, device_category, manufacturer, model, serial_number, imei").eq("client_id", clientId!).eq("is_archived", false).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!clientId,
  });
  const selectedDevice = devices.find((d: any) => d.id === deviceId);
  const deviceOptions = devices.map((d: any) => ({
    value: d.id,
    label: `${DEVICE_CATEGORY_LABELS[d.device_category as DeviceCategory] || d.device_category} — ${d.manufacturer || ""} ${d.model || ""}`.trim(),
    sublabel: [d.serial_number && `S/N: ${d.serial_number}`, d.imei && `IMEI: ${d.imei}`].filter(Boolean).join(" · "),
  }));

  if (!clientId) {
    return (<FormSection icon={Monitor} title="Urządzenie"><p className="text-sm text-muted-foreground py-2">Najpierw wybierz klienta</p></FormSection>);
  }

  return (
    <FormSection icon={Monitor} title="Urządzenie">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Wyszukaj urządzenie klienta</Label>
        <SearchableSelect options={deviceOptions} value={deviceId ?? ""} onChange={(v) => onChange(v || undefined)} placeholder="Wpisz producenta, model, S/N, IMEI..." onAddNew={() => setDeviceDialogOpen(true)} addNewLabel="Dodaj nowe urządzenie" />
      </div>
      <DevicePreview device={selectedDevice} />
      <DeviceFormDialog clientId={clientId} externalOpen={deviceDialogOpen} onOpenChange={setDeviceDialogOpen} onCreated={(id) => { queryClient.invalidateQueries({ queryKey: ["client-devices-select", clientId] }); onChange(id); }} />
    </FormSection>
  );
}

// ═══ ORDER DATA SECTION ═══
export function OrderDataSection({ formData, onChange }: { formData: Record<string, any>; onChange: (field: string, value: any) => void; }) {
  return (
    <FormSection icon={ClipboardList} title="Dane zlecenia">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Typ serwisu</Label>
          <Select value={formData.service_type ?? "COMPUTER_SERVICE"} onValueChange={(v) => onChange("service_type", v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(SERVICE_TYPE_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Priorytet</Label>
          <Select value={formData.priority ?? "NORMAL"} onValueChange={(v) => onChange("priority", v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(ORDER_PRIORITY_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kanał zgłoszenia</Label>
          <Select value={formData.intake_channel ?? "IN_PERSON"} onValueChange={(v) => onChange("intake_channel", v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(INTAKE_CHANNEL_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Przewidywana data zakończenia</Label>
          <Input type="date" value={formData.estimated_completion_date ?? ""} onChange={(e) => onChange("estimated_completion_date", e.target.value || null)} className="h-9" />
        </div>
      </div>
    </FormSection>
  );
}

// ═══ ACCESSORY CHECKLIST ═══
const DEFAULT_ACCESSORIES = [
  "Ładowarka",
  "Kabel zasilający",
  "Torba / pokrowiec",
  "Etui / case",
  "Karta SIM",
  "Karta pamięci",
];

export function parseAccessories(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // legacy plain text – split by comma
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function AccessoryChecklist({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = parseAccessories(value);
  const [customInput, setCustomInput] = useState("");

  const customItems = selected.filter((s) => !DEFAULT_ACCESSORIES.includes(s));

  const toggle = (item: string) => {
    const next = selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item];
    onChange(JSON.stringify(next));
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    onChange(JSON.stringify([...selected, trimmed]));
    setCustomInput("");
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Akcesoria przekazane z urządzeniem</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {DEFAULT_ACCESSORIES.map((acc) => (
          <label key={acc} className="flex items-center gap-2 text-sm cursor-pointer rounded-md border border-border px-3 py-2 hover:bg-muted/50 transition-colors">
            <Checkbox checked={selected.includes(acc)} onCheckedChange={() => toggle(acc)} />
            {acc}
          </label>
        ))}
        {customItems.map((acc) => (
          <label key={acc} className="flex items-center gap-2 text-sm cursor-pointer rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
            <Checkbox checked onCheckedChange={() => toggle(acc)} />
            <span className="flex-1 truncate">{acc}</span>
            <button type="button" onClick={() => toggle(acc)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Inne akcesorium..."
          className="h-8 text-sm flex-1"
        />
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={addCustom} disabled={!customInput.trim()}>
          <Plus className="h-3 w-3 mr-1" /> Dodaj
        </Button>
      </div>
    </div>
  );
}

// ═══ LOCK CODE FIELD (internal, masked) ═══
function LockCodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1">
      <Label className="text-xs flex items-center gap-1.5">
        <Shield className="h-3 w-3 text-destructive" />
        Kod odblokowania urządzenia
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1 border-destructive/30 text-destructive">tylko serwis</Badge>
      </Label>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="PIN, wzór, hasło urządzenia"
          className="h-9 pr-9 font-mono"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">Pole wewnętrzne — nie pojawia się na dokumentach klienta</p>
    </div>
  );
}

// ═══ DESCRIPTION SECTION ═══
export function DescriptionSection({ formData, onChange }: { formData: Record<string, any>; onChange: (field: string, value: any) => void; }) {
  return (
    <FormSection icon={Info} title="Opis zgłoszenia">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Opis problemu</Label>
          <Textarea rows={3} value={formData.problem_description ?? ""} onChange={(e) => onChange("problem_description", e.target.value)} placeholder="Co się stało? Jaki jest problem?" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Opis klienta</Label>
          <Textarea rows={2} value={formData.client_description ?? ""} onChange={(e) => onChange("client_description", e.target.value)} placeholder="Co klient powiedział / jak opisał problem" />
        </div>
        <AccessoryChecklist value={formData.accessories_received ?? ""} onChange={(v) => onChange("accessories_received", v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Stan wizualny</Label><Input value={formData.visual_condition ?? ""} onChange={(e) => onChange("visual_condition", e.target.value)} placeholder="np. zarysowania, pęknięcia" className="h-9" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LockCodeField value={formData.lock_code ?? ""} onChange={(v) => onChange("lock_code", v)} />
        </div>
        <div className="space-y-1"><Label className="text-xs">Notatki wewnętrzne</Label><Textarea rows={2} value={formData.internal_notes ?? ""} onChange={(e) => onChange("internal_notes", e.target.value)} placeholder="Notatki widoczne tylko dla serwisu" /></div>
      </div>
    </FormSection>
  );
}

// ═══ DIAGNOSIS SECTION ═══
export function DiagnosisSection({ formData, onChange, onStatusChange }: { formData: Record<string, any>; onChange: (field: string, value: any) => void; onStatusChange?: (status: string) => void; }) {
  return (
    <FormSection icon={Wrench} title="Diagnostyka i naprawa">
      {onStatusChange && (
        <div className="space-y-1">
          <Label className="text-xs">Status zlecenia</Label>
          <Select value={formData.status ?? "NEW"} onValueChange={onStatusChange}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1"><Label className="text-xs">Diagnoza</Label><Textarea rows={3} value={formData.diagnosis ?? ""} onChange={(e) => onChange("diagnosis", e.target.value)} placeholder="Wynik diagnostyki, ustalenia" /></div>
      <div className="space-y-1"><Label className="text-xs">Opis wykonanych prac / naprawy</Label><Textarea rows={3} value={formData.repair_description ?? ""} onChange={(e) => onChange("repair_description", e.target.value)} placeholder="Jakie prace zostały wykonane?" /></div>
    </FormSection>
  );
}

// ═══ FINANCE SECTION — brutto-first ═══
export function FinanceSection({ formData, onChange, orderItems = [] }: { formData: Record<string, any>; onChange: (field: string, value: any) => void; orderItems?: any[]; }) {
  const laborNet = parseFloat(formData.labor_net) || 0;
  const partsCost = parseFloat(formData.parts_net) || 0;
  const extraCost = parseFloat(formData.extra_cost_net) || 0;
  const itemsRevenue = orderItems.reduce((s: number, i: any) => s + (i.total_sale_net || 0), 0);
  const itemsCost = orderItems.reduce((s: number, i: any) => s + (i.total_purchase_net || 0), 0);
  const totalCost = partsCost + extraCost + itemsCost;
  const revenue = laborNet + itemsRevenue;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const vatRate = 0.23;
  const revenueGross = revenue * (1 + vatRate);
  const totalCostGross = totalCost * (1 + vatRate);
  const profitGross = revenueGross - totalCostGross;

  // Convert gross input to net for storage
  const handleGrossChange = (field: string, grossStr: string) => {
    const gross = parseFloat(grossStr) || 0;
    const net = gross / 1.23;
    onChange(field, net.toFixed(2));
  };

  const laborGross = laborNet * 1.23;
  const partsGross = partsCost * 1.23;
  const extraGross = extraCost * 1.23;

  return (
    <FormSection icon={DollarSign} title="Finanse" accent>
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border p-3 text-center">
          <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-muted-foreground uppercase">Przychód brutto</p>
          <p className="text-lg font-bold font-mono text-primary tabular-nums">{formatCurrency(revenueGross)}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">netto: {formatCurrency(revenue)}</p>
        </div>
        <div className="rounded-md border border-border p-3 text-center">
          <TrendingDown className="h-4 w-4 mx-auto mb-1 text-destructive" />
          <p className="text-[10px] text-muted-foreground uppercase">Koszt brutto</p>
          <p className="text-lg font-bold font-mono text-destructive tabular-nums">{formatCurrency(totalCostGross)}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">netto: {formatCurrency(totalCost)}</p>
        </div>
        <div className="rounded-md border border-border p-3 text-center">
          <DollarSign className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-muted-foreground uppercase">Zysk brutto</p>
          <p className={cn("text-lg font-bold font-mono tabular-nums", profitGross >= 0 ? "text-primary" : "text-destructive")}>{formatCurrency(profitGross)}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">netto: {formatCurrency(profit)}</p>
        </div>
        <div className="rounded-md border border-border p-3 text-center">
          <Percent className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground uppercase">Marża</p>
          <p className={cn("text-lg font-bold font-mono tabular-nums", margin >= 0 ? "text-primary" : "text-destructive")}>{margin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Input fields - brutto first */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Cena usługi brutto</Label>
          <Input
            type="number" step="0.01" className="h-9 font-mono tabular-nums"
            value={laborGross ? laborGross.toFixed(2) : ""}
            onChange={(e) => handleGrossChange("labor_net", e.target.value)}
            placeholder="0.00"
          />
          <p className="text-[10px] text-muted-foreground tabular-nums">netto: {formatCurrency(laborNet)} · VAT: {formatCurrency(laborNet * vatRate)}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Koszt części brutto</Label>
          <Input
            type="number" step="0.01" className="h-9 font-mono tabular-nums"
            value={partsGross ? partsGross.toFixed(2) : ""}
            onChange={(e) => handleGrossChange("parts_net", e.target.value)}
            placeholder="0.00"
          />
          <p className="text-[10px] text-muted-foreground tabular-nums">netto: {formatCurrency(partsCost)} · VAT: {formatCurrency(partsCost * vatRate)}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Koszt dodatkowy brutto</Label>
          <Input
            type="number" step="0.01" className="h-9 font-mono tabular-nums"
            value={extraGross ? extraGross.toFixed(2) : ""}
            onChange={(e) => handleGrossChange("extra_cost_net", e.target.value)}
            placeholder="0.00"
          />
          <p className="text-[10px] text-muted-foreground tabular-nums">netto: {formatCurrency(extraCost)} · VAT: {formatCurrency(extraCost * vatRate)}</p>
        </div>
      </div>
    </FormSection>
  );
}

// ═══ PAYMENT SECTION ═══
export function PaymentSection({ formData, onChange }: { formData: Record<string, any>; onChange: (field: string, value: any) => void; }) {
  return (
    <FormSection icon={CreditCard} title="Płatność i rozliczenie">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Forma płatności</Label>
          <Select value={formData.payment_method ?? ""} onValueChange={(v) => onChange("payment_method", v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
            <SelectContent>{Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Typ dokumentu</Label>
          <Select value={formData.sales_document_type ?? "NONE"} onValueChange={(v) => onChange("sales_document_type", v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">Brak</SelectItem>
              <SelectItem value="RECEIPT">Paragon</SelectItem>
              <SelectItem value="INVOICE">Faktura</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nr dokumentu</Label>
          <Input value={formData.sales_document_number ?? ""} onChange={(e) => onChange("sales_document_number", e.target.value)} placeholder="Opcjonalnie" className="h-9" />
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={!!formData.is_paid} onCheckedChange={(v) => onChange("is_paid", !!v)} />
          <span className="text-sm font-medium">Zapłacono</span>
        </label>
      </div>
    </FormSection>
  );
}
