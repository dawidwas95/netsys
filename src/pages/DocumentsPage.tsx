import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Search, FileText, ArrowDownCircle, ArrowUpCircle, Pencil, Trash2, Calendar, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/types/database";

type DocType = "PURCHASE_INVOICE" | "SALES_INVOICE" | "RECEIPT" | "PROFORMA" | "CORRECTION" | "OTHER";
type DocDirection = "INCOME" | "EXPENSE";
type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  PURCHASE_INVOICE: "Faktura zakupowa",
  SALES_INVOICE: "Faktura sprzedażowa",
  RECEIPT: "Paragon",
  PROFORMA: "Proforma",
  CORRECTION: "Korekta",
  OTHER: "Inny",
};

const DIRECTION_LABELS: Record<DocDirection, string> = {
  INCOME: "Przychód",
  EXPENSE: "Wydatek",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Nieopłacona",
  PARTIALLY_PAID: "Częściowo",
  PAID: "Opłacona",
  OVERDUE: "Przeterminowana",
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  UNPAID: "bg-muted text-muted-foreground",
  PARTIALLY_PAID: "bg-accent text-accent-foreground",
  PAID: "bg-primary/10 text-primary",
  OVERDUE: "bg-destructive/10 text-destructive",
};

interface Document {
  id: string;
  document_number: string;
  document_type: DocType;
  direction: DocDirection;
  client_id: string | null;
  contractor_name: string | null;
  contractor_nip: string | null;
  issue_date: string;
  sale_date: string | null;
  due_date: string | null;
  received_date: string | null;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  vat_rate: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  paid_amount: number;
  description: string | null;
  notes: string | null;
  created_at: string;
  clients?: { display_name: string | null; company_name: string | null; first_name: string | null; last_name: string | null } | null;
}

interface DocumentLineItem {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  unit_net: string;
  vat_rate: string;
}

const emptyLineItem: DocumentLineItem = { name: "", quantity: "1", unit: "szt.", unit_net: "0", vat_rate: "23" };

const emptyForm = {
  document_number: "TEMP",
  document_type: "SALES_INVOICE" as DocType,
  direction: "INCOME" as DocDirection,
  client_id: "",
  contractor_name: "",
  contractor_nip: "",
  issue_date: new Date().toISOString().split("T")[0],
  sale_date: "",
  due_date: "",
  received_date: "",
  net_amount: "",
  vat_rate: "23",
  payment_status: "UNPAID" as PaymentStatus,
  payment_method: "" as string,
  paid_amount: "",
  description: "",
  notes: "",
};

function getClientName(c: Document["clients"]) {
  if (!c) return "—";
  return c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterDirection, setFilterDirection] = useState("ALL");
  const [filterPayment, setFilterPayment] = useState("ALL");
  const [lineItems, setLineItems] = useState<DocumentLineItem[]>([{ ...emptyLineItem }]);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, clients(display_name, company_name, first_name, last_name)")
        .eq("is_archived", false)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Document[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, display_name, company_name, first_name, last_name, nip")
        .eq("is_active", true)
        .order("display_name");
      return data ?? [];
    },
  });

  // Computed from line items
  const computedFromItems = lineItems.reduce((acc, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const unitNet = parseFloat(item.unit_net) || 0;
    const vatRate = parseFloat(item.vat_rate) || 23;
    const totalNet = qty * unitNet;
    const totalVat = totalNet * (vatRate / 100);
    const totalGross = totalNet + totalVat;
    return { net: acc.net + totalNet, vat: acc.vat + totalVat, gross: acc.gross + totalGross };
  }, { net: 0, vat: 0, gross: 0 });

  const hasLineItems = lineItems.some(i => i.name.trim() !== "");

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      // If line items exist, compute from them; otherwise use manual entry
      const netAmount = hasLineItems ? computedFromItems.net : (parseFloat(values.net_amount) || 0);
      const vatRate = parseFloat(values.vat_rate) || 23;
      const vatAmount = hasLineItems ? computedFromItems.vat : netAmount * (vatRate / 100);
      const grossAmount = hasLineItems ? computedFromItems.gross : netAmount + vatAmount;

      const payload: Record<string, unknown> = {
        document_number: values.document_number,
        document_type: values.document_type,
        direction: values.direction,
        client_id: values.client_id || null,
        contractor_name: values.contractor_name || null,
        contractor_nip: values.contractor_nip || null,
        issue_date: values.issue_date,
        sale_date: values.sale_date || null,
        due_date: values.due_date || null,
        received_date: values.received_date || null,
        net_amount: netAmount,
        vat_amount: vatAmount,
        vat_rate: vatRate,
        gross_amount: grossAmount,
        payment_status: values.payment_status,
        payment_method: values.payment_method || null,
        paid_amount: parseFloat(values.paid_amount) || 0,
        description: values.description || null,
        notes: values.notes || null,
      };

      let docId = editId;
      if (editId) {
        payload.updated_by = user?.id;
        const { error } = await supabase.from("documents").update(payload as any).eq("id", editId);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { data, error } = await supabase.from("documents").insert(payload as any).select("id").single();
        if (error) throw error;
        docId = data.id;
      }

      // Save line items
      if (docId && hasLineItems) {
        // Delete old items
        await supabase.from("document_items").delete().eq("document_id", docId);
        // Insert new items
        const items = lineItems.filter(i => i.name.trim()).map((item, idx) => {
          const qty = parseFloat(item.quantity) || 1;
          const unitNet = parseFloat(item.unit_net) || 0;
          const vatR = parseFloat(item.vat_rate) || 23;
          const totalNet = qty * unitNet;
          const totalVat = totalNet * (vatR / 100);
          const totalGross = totalNet + totalVat;
          return {
            document_id: docId!,
            name: item.name,
            quantity: qty,
            unit: item.unit || "szt.",
            unit_net: unitNet,
            vat_rate: vatR,
            total_net: totalNet,
            total_vat: totalVat,
            total_gross: totalGross,
            sort_order: idx,
          };
        });
        if (items.length) {
          const { error: itemErr } = await supabase.from("document_items").insert(items);
          if (itemErr) throw itemErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success(editId ? "Zaktualizowano dokument" : "Dodano dokument");
      resetForm();
    },
    onError: (err: any) => toast.error(err?.message || "Błąd zapisu"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Usunięto dokument");
    },
  });

  function resetForm() {
    setForm(emptyForm);
    setEditId(null);
    setOpen(false);
  }

  function openEdit(doc: Document) {
    setEditId(doc.id);
    setForm({
      document_number: doc.document_number,
      document_type: doc.document_type,
      direction: doc.direction,
      client_id: doc.client_id ?? "",
      contractor_name: doc.contractor_name ?? "",
      contractor_nip: doc.contractor_nip ?? "",
      issue_date: doc.issue_date,
      sale_date: doc.sale_date ?? "",
      due_date: doc.due_date ?? "",
      received_date: doc.received_date ?? "",
      net_amount: doc.net_amount.toString(),
      vat_rate: doc.vat_rate.toString(),
      payment_status: doc.payment_status,
      payment_method: doc.payment_method ?? "",
      paid_amount: doc.paid_amount.toString(),
      description: doc.description ?? "",
      notes: doc.notes ?? "",
    });
    setOpen(true);
  }

  function onClientSelect(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    setForm({
      ...form,
      client_id: clientId,
      contractor_name: client ? (client.display_name || client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ")) : "",
      contractor_nip: client?.nip ?? "",
    });
  }

  // Auto-set direction based on document type
  function onDocTypeChange(docType: DocType) {
    const direction: DocDirection = docType === "PURCHASE_INVOICE" ? "EXPENSE" : "INCOME";
    setForm({ ...form, document_type: docType, direction });
  }

  const filtered = docs.filter((d) => {
    if (filterDirection !== "ALL" && d.direction !== filterDirection) return false;
    if (filterPayment !== "ALL" && d.payment_status !== filterPayment) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        d.document_number.toLowerCase().includes(s) ||
        d.contractor_name?.toLowerCase().includes(s) ||
        d.contractor_nip?.toLowerCase().includes(s) ||
        d.description?.toLowerCase().includes(s) ||
        getClientName(d.clients).toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalIncome = docs.filter((d) => d.direction === "INCOME").reduce((s, d) => s + d.gross_amount, 0);
  const totalExpense = docs.filter((d) => d.direction === "EXPENSE").reduce((s, d) => s + d.gross_amount, 0);
  const totalUnpaid = docs.filter((d) => d.payment_status === "UNPAID" || d.payment_status === "OVERDUE").reduce((s, d) => s + (d.gross_amount - d.paid_amount), 0);

  const computedVat = (parseFloat(form.net_amount) || 0) * ((parseFloat(form.vat_rate) || 23) / 100);
  const computedGross = (parseFloat(form.net_amount) || 0) + computedVat;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rejestr dokumentów</h1>
          <p className="text-muted-foreground">Ewidencja faktur zakupowych i sprzedażowych</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Dodaj dokument</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Edytuj dokument" : "Nowy dokument"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Typ dokumentu *</Label>
                  <Select value={form.document_type} onValueChange={(v) => onDocTypeChange(v as DocType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((k) => (
                        <SelectItem key={k} value={k}>{DOC_TYPE_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Kierunek</Label>
                  <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v as DocDirection })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCOME">Przychód</SelectItem>
                      <SelectItem value="EXPENSE">Wydatek</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Kontrahent</p>
                <div>
                  <Label>Klient z bazy</Label>
                  <Select value={form.client_id} onValueChange={onClientSelect}>
                    <SelectTrigger><SelectValue placeholder="Wybierz lub wpisz ręcznie" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Nazwa kontrahenta</Label><Input value={form.contractor_name} onChange={(e) => setForm({ ...form, contractor_name: e.target.value })} /></div>
                  <div><Label>NIP</Label><Input value={form.contractor_nip} onChange={(e) => setForm({ ...form, contractor_nip: e.target.value })} /></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data wystawienia *</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
                <div><Label>Data sprzedaży</Label><Input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} /></div>
                <div><Label>Termin płatności</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                <div><Label>Data otrzymania</Label><Input type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} /></div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Kwoty</p>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Netto *</Label><Input type="number" step="0.01" value={form.net_amount} onChange={(e) => setForm({ ...form, net_amount: e.target.value })} /></div>
                  <div><Label>Stawka VAT (%)</Label><Input type="number" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} /></div>
                  <div>
                    <Label>Brutto</Label>
                    <Input value={formatCurrency(computedGross)} disabled className="bg-muted" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Status płatności</Label>
                  <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as PaymentStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((k) => (
                        <SelectItem key={k} value={k}>{PAYMENT_STATUS_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Metoda płatności</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
                        <SelectItem key={k} value={k}>{PAYMENT_METHOD_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Zapłacono</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} /></div>
              </div>

              <div><Label>Opis</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Notatki</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetForm}>Anuluj</Button>
                <Button onClick={() => saveMutation.mutate(form)} disabled={!form.issue_date || !form.net_amount || saveMutation.isPending}>
                  {saveMutation.isPending ? "Zapisywanie..." : editId ? "Zapisz zmiany" : "Dodaj"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2 bg-primary/10 text-primary"><ArrowDownCircle className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{formatCurrency(totalIncome)}</p><p className="text-sm text-muted-foreground">Przychody (brutto)</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2 bg-destructive/10 text-destructive"><ArrowUpCircle className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{formatCurrency(totalExpense)}</p><p className="text-sm text-muted-foreground">Wydatki (brutto)</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2 bg-accent text-accent-foreground"><DollarSign className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{formatCurrency(totalUnpaid)}</p><p className="text-sm text-muted-foreground">Do zapłaty</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Szukaj po numerze, kontrahencie..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterDirection} onValueChange={setFilterDirection}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie kierunki</SelectItem>
            <SelectItem value="INCOME">Przychody</SelectItem>
            <SelectItem value="EXPENSE">Wydatki</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie statusy</SelectItem>
            {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((k) => (
              <SelectItem key={k} value={k}>{PAYMENT_STATUS_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Ładowanie...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Brak dokumentów</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numer</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Kontrahent</TableHead>
                <TableHead>Data wyst.</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead className="text-right">Netto</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
                <TableHead>Płatność</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {doc.direction === "INCOME" ? (
                        <ArrowDownCircle className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className="font-medium font-mono text-sm">{doc.document_number}</span>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-sm">{DOC_TYPE_LABELS[doc.document_type]}</span></TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{doc.contractor_name || getClientName(doc.clients)}</p>
                      {doc.contractor_nip && <p className="text-xs text-muted-foreground">NIP: {doc.contractor_nip}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{doc.issue_date}</TableCell>
                  <TableCell className="text-sm">{doc.due_date || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(doc.net_amount)}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(doc.gross_amount)}</TableCell>
                  <TableCell>
                    <Badge className={PAYMENT_STATUS_COLORS[doc.payment_status]} variant="secondary">
                      {PAYMENT_STATUS_LABELS[doc.payment_status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(doc)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(doc.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
