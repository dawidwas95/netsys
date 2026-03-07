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
  Phone, Mail, MapPin, Plus, Info, TrendingUp, TrendingDown, Percent, Hash,
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

// ── Helpers ──
function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

// ── Section wrapper ──
export function FormSection({ icon: Icon, title, children, className, accent }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
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

// ── Client Info Preview ──
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

// ── Device Info Preview ──
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

// ═══════════════════════════════════════════
// SECTION 1: CLIENT
// ═══════════════════════════════════════════
export function ClientSection({ clientId, onChange }: {
  clientId?: string;
  onChange: (clientId: string | undefined) => void;
}) {
  const queryClient = useQueryClient();
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, display_name, company_name, first_name, last_name, phone, email, nip, address_city, address_street, address_postal_code")
        .eq("is_active", true)
        .order("display_name");
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
        <SearchableSelect
          options={clientOptions}
          value={clientId ?? ""}
          onChange={(v) => onChange(v || undefined)}
          placeholder="Wpisz nazwisko, firmę, telefon, NIP..."
          onAddNew={() => setClientDialogOpen(true)}
          addNewLabel="Dodaj nowego klienta"
        />
      </div>
      <ClientPreview client={selectedClient} />

      {/* Separate dialog — not inside the dropdown */}
      <ClientFormDialog
        externalOpen={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={(id) => {
          queryClient.invalidateQueries({ queryKey: ["clients-select"] });
          onChange(id);
        }}
      />
    </FormSection>
  );
}

// ═══════════════════════════════════════════
// SECTION 2: DEVICE
// ═══════════════════════════════════════════
export function DeviceSection({ clientId, deviceId, onChange }: {
  clientId?: string;
  deviceId?: string;
  onChange: (deviceId: string | undefined) => void;
}) {
  const queryClient = useQueryClient();
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);

  const { data: devices = [] } = useQuery({
    queryKey: ["client-devices-select", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("devices")
        .select("id, device_category, manufacturer, model, serial_number, imei")
        .eq("client_id", clientId!)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
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
    return (
      <FormSection icon={Monitor} title="Urządzenie">
        <p className="text-sm text-muted-foreground py-2">Najpierw wybierz klienta</p>
      </FormSection>
    );
  }

  return (
    <FormSection icon={Monitor} title="Urządzenie">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Wyszukaj urządzenie klienta</Label>
        <SearchableSelect
          options={deviceOptions}
          value={deviceId ?? ""}
          onChange={(v) => onChange(v || undefined)}
          placeholder="Wpisz producenta, model, S/N, IMEI..."
          onAddNew={() => setDeviceDialogOpen(true)}
          addNewLabel="Dodaj nowe urządzenie"
        />
      </div>
      <DevicePreview device={selectedDevice} />

      {/* Separate dialog — not inside the dropdown */}
      <DeviceFormDialog
        clientId={clientId}
        externalOpen={deviceDialogOpen}
        onOpenChange={setDeviceDialogOpen}
        onCreated={(id) => {
          queryClient.invalidateQueries({ queryKey: ["client-devices-select", clientId] });
          onChange(id);
        }}
      />
    </FormSection>
  );
}

// ═══════════════════════════════════════════
// SECTION 3: ORDER DATA
// ═══════════════════════════════════════════
export function OrderDataSection({ formData, onChange }: {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
}) {
  return (
    <FormSection icon={ClipboardList} title="Dane zlecenia">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Typ serwisu</Label>
          <Select value={formData.service_type ?? "COMPUTER_SERVICE"} onValueChange={(v) => onChange("service_type", v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(SERVICE_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Priorytet</Label>
          <Select value={formData.priority ?? "NORMAL"} onValueChange={(v) => onChange("priority", v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ORDER_PRIORITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kanał zgłoszenia</Label>
          <Select value={formData.intake_channel ?? "IN_PERSON"} onValueChange={(v) => onChange("intake_channel", v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(INTAKE_CHANNEL_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
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

// ═══════════════════════════════════════════
// SECTION 4: DESCRIPTION
// ═══════════════════════════════════════════
export function DescriptionSection({ formData, onChange }: {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
}) {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Akcesoria przekazane</Label>
            <Input value={formData.accessories_received ?? ""} onChange={(e) => onChange("accessories_received", e.target.value)} placeholder="np. ładowarka, torba, kabel" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stan wizualny</Label>
            <Input value={formData.visual_condition ?? ""} onChange={(e) => onChange("visual_condition", e.target.value)} placeholder="np. zarysowania, pęknięcia" className="h-9" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Kod blokady / hasło</Label>
            <Input value={formData.lock_code ?? ""} onChange={(e) => onChange("lock_code", e.target.value)} placeholder="PIN, wzór, hasło" className="h-9" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Notatki wewnętrzne</Label>
          <Textarea rows={2} value={formData.internal_notes ?? ""} onChange={(e) => onChange("internal_notes", e.target.value)} placeholder="Notatki widoczne tylko dla serwisu" />
        </div>
      </div>
    </FormSection>
  );
}

// ═══════════════════════════════════════════
// SECTION 5: DIAGNOSIS & REPAIR (edit mode only)
// ═══════════════════════════════════════════
export function DiagnosisSection({ formData, onChange, onStatusChange }: {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
  onStatusChange?: (status: string) => void;
}) {
  return (
    <FormSection icon={Wrench} title="Diagnostyka i naprawa">
      {onStatusChange && (
        <div className="space-y-1">
          <Label className="text-xs">Status zlecenia</Label>
          <Select value={formData.status ?? "NEW"} onValueChange={onStatusChange}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Diagnoza</Label>
        <Textarea rows={3} value={formData.diagnosis ?? ""} onChange={(e) => onChange("diagnosis", e.target.value)} placeholder="Wynik diagnostyki, ustalenia" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Opis wykonanych prac / naprawy</Label>
        <Textarea rows={3} value={formData.repair_description ?? ""} onChange={(e) => onChange("repair_description", e.target.value)} placeholder="Jakie prace zostały wykonane?" />
      </div>
    </FormSection>
  );
}

// ═══════════════════════════════════════════
// SECTION 6: FINANCE
// ═══════════════════════════════════════════
export function FinanceSection({ formData, onChange, orderItems = [] }: {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
  orderItems?: any[];
}) {
  const laborNet = parseFloat(formData.labor_net) || 0;
  const partsCost = parseFloat(formData.parts_net) || 0;
  const extraCost = parseFloat(formData.extra_cost_net) || 0;
  const itemsRevenue = orderItems.reduce((s: number, i: any) => s + (i.total_sale_net || 0), 0);
  const itemsCost = orderItems.reduce((s: number, i: any) => s + (i.total_purchase_net || 0), 0);
  const totalCost = partsCost + extraCost + itemsCost;
  const revenue = laborNet + itemsRevenue;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return (
    <FormSection icon={DollarSign} title="Finanse" accent>
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-md border border-border p-2.5 text-center">
          <TrendingUp className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
          <p className="text-[10px] text-muted-foreground uppercase">Przychód</p>
          <p className="text-base font-bold font-mono text-primary">{formatCurrency(revenue)}</p>
        </div>
        <div className="rounded-md border border-border p-2.5 text-center">
          <TrendingDown className="h-3.5 w-3.5 mx-auto mb-0.5 text-destructive" />
          <p className="text-[10px] text-muted-foreground uppercase">Koszt</p>
          <p className="text-base font-bold font-mono text-destructive">{formatCurrency(totalCost)}</p>
        </div>
        <div className="rounded-md border border-border p-2.5 text-center">
          <DollarSign className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
          <p className="text-[10px] text-muted-foreground uppercase">Zysk</p>
          <p className={cn("text-base font-bold font-mono", profit >= 0 ? "text-primary" : "text-destructive")}>{formatCurrency(profit)}</p>
        </div>
        <div className="rounded-md border border-border p-2.5 text-center">
          <Percent className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground uppercase">Marża</p>
          <p className={cn("text-base font-bold font-mono", margin >= 0 ? "text-primary" : "text-destructive")}>{margin.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cena usługi / naprawy (netto)</Label>
          <Input type="number" step="0.01" value={formData.labor_net ?? ""} onChange={(e) => onChange("labor_net", e.target.value)} placeholder="0.00" className="h-9 font-mono" />
          <p className="text-[10px] text-muted-foreground">Kwota sprzedaży dla klienta</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Koszt części (netto)</Label>
          <Input type="number" step="0.01" value={formData.parts_net ?? ""} onChange={(e) => onChange("parts_net", e.target.value)} placeholder="0.00" className="h-9 font-mono" />
          <p className="text-[10px] text-muted-foreground">Twój koszt zakupu</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Koszt dodatkowy (netto)</Label>
          <Input type="number" step="0.01" value={formData.extra_cost_net ?? ""} onChange={(e) => onChange("extra_cost_net", e.target.value)} placeholder="0.00" className="h-9 font-mono" />
          <p className="text-[10px] text-muted-foreground">Inne koszty własne</p>
        </div>
      </div>
    </FormSection>
  );
}

// ═══════════════════════════════════════════
// SECTION 7: PAYMENT
// ═══════════════════════════════════════════
export function PaymentSection({ formData, onChange }: {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
}) {
  return (
    <FormSection icon={CreditCard} title="Płatność i rozliczenie">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Forma płatności</Label>
          <Select value={formData.payment_method ?? ""} onValueChange={(v) => onChange("payment_method", v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
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
          <Checkbox
            checked={!!formData.is_paid}
            onCheckedChange={(v) => onChange("is_paid", !!v)}
          />
          <span className="text-sm font-medium">Zapłacono</span>
        </label>
      </div>
    </FormSection>
  );
}
