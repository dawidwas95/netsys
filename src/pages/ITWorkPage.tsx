import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, FileText, Filter } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  ADMINISTRATION: "Administracja",
  NETWORK: "Sieci",
  MONITORING: "Monitoring",
  ERP: "ERP",
  HELPDESK: "Helpdesk",
  IMPLEMENTATION: "Wdrożenie",
  MAINTENANCE: "Konserwacja",
  OTHER: "Inne",
};

const BILLING_STATUS_LABELS: Record<string, string> = {
  UNBILLED: "Nierozliczone",
  BILLED: "Rozliczone",
  CANCELLED: "Anulowane",
};

const STATUS_COLORS: Record<string, string> = {
  UNBILLED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  BILLED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function ITWorkPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("UNBILLED");

  // Queries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["it_work_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_work_entries")
        .select("*, clients(display_name, company_name, first_name, last_name)")
        .is("deleted_at", null)
        .order("work_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, display_name, company_name, first_name, last_name, client_type")
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return data;
    },
  });

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter((e: any) => {
      if (filterClient !== "all" && e.client_id !== filterClient) return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      return true;
    });
  }, [entries, filterClient, filterStatus]);

  const selectedTotal = useMemo(() => {
    return filtered
      .filter((e: any) => selectedIds.includes(e.id))
      .reduce((sum: number, e: any) => sum + Number(e.amount_net || 0), 0);
  }, [filtered, selectedIds]);

  // Add entry mutation
  const addEntry = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("it_work_entries").insert({
        ...data,
        entry_number: "TEMP",
        assigned_user_id: user?.id,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["it_work_entries"] });
      setAddOpen(false);
      toast.success("Dodano wpis pracy IT");
    },
    onError: () => toast.error("Błąd dodawania wpisu"),
  });

  // Create billing batch
  const createBatch = useMutation({
    mutationFn: async (data: { clientId: string; invoiceNumber: string; notes: string }) => {
      const selectedEntries = filtered.filter((e: any) => selectedIds.includes(e.id) && e.status === "UNBILLED");
      if (selectedEntries.length === 0) throw new Error("Brak pozycji");

      const totalNet = selectedEntries.reduce((s: number, e: any) => s + Number(e.amount_net || 0), 0);
      const totalGross = totalNet * 1.23;
      const dates = selectedEntries.map((e: any) => e.work_date).sort();

      const batchNumber = `BILL/${new Date().getFullYear()}/${String(Date.now()).slice(-4)}`;

      const { data: batch, error: batchErr } = await supabase
        .from("billing_batches")
        .insert({
          batch_number: batchNumber,
          client_id: data.clientId,
          period_from: dates[0],
          period_to: dates[dates.length - 1],
          total_net: totalNet,
          total_gross: totalGross,
          invoice_number: data.invoiceNumber || null,
          notes: data.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();
      if (batchErr) throw batchErr;

      // Insert batch items
      const items = selectedEntries.map((e: any) => ({
        batch_id: batch.id,
        it_work_entry_id: e.id,
      }));
      const { error: itemsErr } = await supabase.from("billing_batch_items").insert(items);
      if (itemsErr) throw itemsErr;

      // Update entries status
      for (const entry of selectedEntries) {
        await supabase
          .from("it_work_entries")
          .update({ status: "BILLED" as any, billing_batch_id: batch.id, updated_by: user?.id })
          .eq("id", entry.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["it_work_entries"] });
      setSelectedIds([]);
      setBillingOpen(false);
      toast.success("Utworzono rozliczenie zbiorcze");
    },
    onError: (e) => toast.error("Błąd: " + e.message),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllUnbilled = () => {
    const unbilledIds = filtered.filter((e: any) => e.status === "UNBILLED").map((e: any) => e.id);
    setSelectedIds(unbilledIds);
  };

  const clientName = (e: any) => {
    const c = e.clients;
    if (!c) return "—";
    return c.display_name || c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prace IT</h1>
          <p className="text-sm text-muted-foreground">Rejestr prac informatycznych i rozliczenia</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button variant="secondary" onClick={() => setBillingOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Rozlicz ({selectedIds.length}) — {selectedTotal.toFixed(2)} zł
            </Button>
          )}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Dodaj pracę</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nowy wpis pracy IT</DialogTitle></DialogHeader>
              <AddEntryForm clients={clients} onSubmit={(d) => addEntry.mutate(d)} loading={addEntry.isPending} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Klient</Label>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy klienci</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.display_name || c.company_name || `${c.first_name} ${c.last_name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="UNBILLED">Nierozliczone</SelectItem>
                  <SelectItem value="BILLED">Rozliczone</SelectItem>
                  <SelectItem value="CANCELLED">Anulowane</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filterStatus === "UNBILLED" && (
              <Button variant="outline" size="sm" onClick={selectAllUnbilled}>
                Zaznacz wszystkie nierozliczone
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Numer</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Kategoria</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="text-right">Godziny</TableHead>
                <TableHead className="text-right">Kwota netto</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Ładowanie...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Brak wpisów</TableCell></TableRow>
              ) : (
                filtered.map((e: any) => (
                  <TableRow key={e.id} className={selectedIds.includes(e.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      {e.status === "UNBILLED" && (
                        <Checkbox
                          checked={selectedIds.includes(e.id)}
                          onCheckedChange={() => toggleSelect(e.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.entry_number}</TableCell>
                    <TableCell className="text-sm">{format(new Date(e.work_date), "dd.MM.yyyy")}</TableCell>
                    <TableCell className="font-medium text-sm">{clientName(e)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {SERVICE_CATEGORY_LABELS[e.service_category] || e.service_category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{e.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(e.billable_hours).toFixed(1)}h</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{Number(e.amount_net).toFixed(2)} zł</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[e.status] || ""}>
                        {BILLING_STATUS_LABELS[e.status] || e.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Billing Dialog */}
      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Utwórz rozliczenie zbiorcze</DialogTitle></DialogHeader>
          <BillingForm
            selectedCount={selectedIds.length}
            totalNet={selectedTotal}
            clientId={filterClient !== "all" ? filterClient : filtered.find((e: any) => selectedIds.includes(e.id))?.client_id}
            onSubmit={(d) => createBatch.mutate(d)}
            loading={createBatch.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddEntryForm({ clients, onSubmit, loading }: { clients: any[]; onSubmit: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    client_id: "",
    work_date: new Date().toISOString().split("T")[0],
    service_category: "OTHER",
    description: "",
    work_hours: "1",
    billable_hours: "1",
    hourly_rate: "150",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.description) {
      toast.error("Wypełnij wymagane pola");
      return;
    }
    const hours = parseFloat(form.billable_hours) || 0;
    const rate = parseFloat(form.hourly_rate) || 0;
    onSubmit({
      client_id: form.client_id,
      work_date: form.work_date,
      service_category: form.service_category,
      description: form.description,
      work_hours: parseFloat(form.work_hours) || 0,
      billable_hours: hours,
      hourly_rate: rate,
      amount_net: hours * rate,
      amount_gross: hours * rate * 1.23,
      notes: form.notes || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Klient *</Label>
          <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
            <SelectTrigger><SelectValue placeholder="Wybierz klienta" /></SelectTrigger>
            <SelectContent>
              {clients.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.display_name || c.company_name || `${c.first_name} ${c.last_name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Data pracy</Label>
          <Input type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Kategoria</Label>
        <Select value={form.service_category} onValueChange={(v) => setForm({ ...form, service_category: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(SERVICE_CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Opis pracy *</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Godziny pracy</Label>
          <Input type="number" step="0.5" value={form.work_hours} onChange={(e) => setForm({ ...form, work_hours: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Godziny do rozliczenia</Label>
          <Input type="number" step="0.5" value={form.billable_hours} onChange={(e) => setForm({ ...form, billable_hours: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Stawka netto (zł/h)</Label>
          <Input type="number" step="1" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
        </div>
      </div>

      <div className="bg-muted/50 rounded p-3 text-sm">
        Kwota netto: <strong>{((parseFloat(form.billable_hours) || 0) * (parseFloat(form.hourly_rate) || 0)).toFixed(2)} zł</strong>
      </div>

      <div className="space-y-1">
        <Label>Notatki</Label>
        <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Zapisywanie..." : "Dodaj wpis"}
      </Button>
    </form>
  );
}

function BillingForm({ selectedCount, totalNet, clientId, onSubmit, loading }: {
  selectedCount: number;
  totalNet: number;
  clientId?: string;
  onSubmit: (d: { clientId: string; invoiceNumber: string; notes: string }) => void;
  loading: boolean;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded p-4 space-y-1 text-sm">
        <div>Zaznaczonych pozycji: <strong>{selectedCount}</strong></div>
        <div>Suma netto: <strong>{totalNet.toFixed(2)} zł</strong></div>
        <div>Suma brutto (23% VAT): <strong>{(totalNet * 1.23).toFixed(2)} zł</strong></div>
      </div>

      <div className="space-y-1">
        <Label>Numer faktury</Label>
        <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="np. FV/2026/001" />
      </div>

      <div className="space-y-1">
        <Label>Notatki</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <Button
        className="w-full"
        disabled={loading || !clientId}
        onClick={() => onSubmit({ clientId: clientId!, invoiceNumber, notes })}
      >
        {loading ? "Tworzenie..." : "Utwórz rozliczenie"}
      </Button>

      {!clientId && (
        <p className="text-xs text-destructive">Wybierz klienta w filtrach lub zaznacz pozycje jednego klienta.</p>
      )}
    </div>
  );
}
