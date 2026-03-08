import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, FileText, ArrowDownCircle, ArrowUpCircle, Pencil, Trash2, Eye, X,
  DollarSign, Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ClientFormDialog } from "@/components/ClientFormDialog";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/types/database";
import { DocumentAttachments } from "@/components/DocumentAttachments";

type DocType = "PURCHASE_INVOICE" | "SALES_INVOICE" | "RECEIPT" | "PROFORMA" | "CORRECTION" | "OTHER";
type DocDirection = "INCOME" | "EXPENSE";
type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
type DocItemType = "PRODUCT" | "SERVICE";

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
  item_type: DocItemType;
  inventory_item_id?: string | null;
}

const emptyLineItem: DocumentLineItem = { name: "", quantity: "1", unit: "szt.", unit_net: "0", vat_rate: "23", item_type: "SERVICE" };

const emptyForm = {
  document_number: "",
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
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterDirection, setFilterDirection] = useState("ALL");
  const [filterPayment, setFilterPayment] = useState("ALL");
  const [lineItems, setLineItems] = useState<DocumentLineItem[]>([{ ...emptyLineItem }]);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, clients(display_name, company_name, first_name, last_name)")
        .eq("is_archived", false)
        .is("deleted_at", null)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Document[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select-with-role"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, display_name, company_name, first_name, last_name, nip, business_role")
        .eq("is_active", true)
        .order("display_name");
      return data ?? [];
    },
  });

  // For purchase documents, filter to suppliers only
  const supplierClients = clients.filter((c: any) =>
    c.business_role === "SUPPLIER" || c.business_role === "CUSTOMER_AND_SUPPLIER"
  );
  const customerClients = clients.filter((c: any) =>
    c.business_role === "CUSTOMER" || c.business_role === "CUSTOMER_AND_SUPPLIER"
  );

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items-select"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_items").select("id, name, sku, purchase_net, sale_net").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  // ── Computed totals from line items ──
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

  // ── Load items when editing ──
  async function loadDocumentItems(docId: string) {
    const { data } = await supabase
      .from("document_items")
      .select("*")
      .eq("document_id", docId)
      .order("sort_order");
    if (data && data.length > 0) {
      setLineItems(data.map((di: any) => ({
        id: di.id,
        name: di.name,
        quantity: di.quantity.toString(),
        unit: di.unit,
        unit_net: di.unit_net.toString(),
        vat_rate: di.vat_rate.toString(),
        item_type: (di.description === "PRODUCT" ? "PRODUCT" : "SERVICE") as DocItemType,
        inventory_item_id: di.inventory_item_id,
      })));
    } else {
      setLineItems([{ ...emptyLineItem }]);
    }
  }

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const netAmount = hasLineItems ? computedFromItems.net : (parseFloat(values.net_amount) || 0);
      const vatRate = parseFloat(values.vat_rate) || 23;
      const vatAmount = hasLineItems ? computedFromItems.vat : netAmount * (vatRate / 100);
      const grossAmount = hasLineItems ? computedFromItems.gross : netAmount + vatAmount;

      const payload: Record<string, unknown> = {
        document_number: values.document_number.trim() || "TEMP",
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
      if (docId) {
        await supabase.from("document_items").delete().eq("document_id", docId);
        const validItems = lineItems.filter(i => i.name.trim());
        if (validItems.length) {
          const items = validItems.map((item, idx) => {
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
              description: item.item_type, // Store PRODUCT/SERVICE in description field
              inventory_item_id: item.inventory_item_id || null,
            };
          });
          const { error: itemErr } = await supabase.from("document_items").insert(items);
          if (itemErr) throw itemErr;

          // ── Inventory integration for purchase invoices ──
          if (values.document_type === "PURCHASE_INVOICE") {
            // When editing, first reverse old movements linked to this document
            if (editId) {
              // Delete old movements — the DELETE trigger on inventory_movements
              // will automatically reverse the stock changes
              await supabase.from("inventory_movements").delete().eq("source_id", docId!).eq("source_type", "PURCHASE");
            }

            for (const item of items) {
              if (item.description === "PRODUCT") {
                // Find or create inventory item
                let invItemId = item.inventory_item_id;
                if (!invItemId) {
                  const { data: existing } = await supabase
                    .from("inventory_items")
                    .select("id")
                    .eq("name", item.name)
                    .maybeSingle();
                  if (existing) {
                    invItemId = existing.id;
                  } else {
                    const { data: created } = await supabase
                      .from("inventory_items")
                      .insert({ name: item.name, purchase_net: item.unit_net, unit: item.unit, vat_rate: item.vat_rate })
                      .select("id")
                      .single();
                    if (created) invItemId = created.id;
                  }
                }
                if (invItemId) {
                  await supabase.from("inventory_items").update({ purchase_net: item.unit_net }).eq("id", invItemId);
                  // Create fresh IN movement (trigger will increase stock)
                  await supabase.from("inventory_movements").insert({
                    item_id: invItemId,
                    movement_type: "IN",
                    quantity: item.quantity,
                    source_type: "PURCHASE",
                    source_id: docId,
                    purchase_net: item.unit_net,
                    notes: `Faktura: ${values.document_number || "auto"}`,
                    created_by: user?.id,
                  });
                }
              }
            }
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      // Audit log for document save
      const docNum = form.document_number || "auto";
      supabase.from("activity_logs").insert({
        entity_type: "document", entity_id: editId || "new", action_type: editId ? "UPDATE" : "CREATE",
        user_id: user?.id,
        // @ts-ignore
        entity_name: docNum,
        description: editId ? `Edycja dokumentu ${docNum}` : `Utworzono dokument ${docNum}`,
      }).then();
      toast.success(editId ? "Zaktualizowano dokument" : "Dodano dokument");
      resetForm();
    },
    onError: (err: any) => toast.error(err?.message || "Błąd zapisu"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete instead of hard delete
      const { error } = await supabase.from("documents")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, deletedId) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      supabase.from("activity_logs").insert({
        entity_type: "document", entity_id: deletedId, action_type: "DELETE",
        user_id: user?.id,
        // @ts-ignore
        description: "Usunięto dokument",
      }).then();
      toast.success("Usunięto dokument");
      setDeleteConfirm(null);
    },
  });

  function resetForm() {
    setForm(emptyForm);
    setEditId(null);
    setFormOpen(false);
    setLineItems([{ ...emptyLineItem }]);
  }

  async function openEdit(doc: Document) {
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
    await loadDocumentItems(doc.id);
    setFormOpen(true);
  }

  async function openPreview(doc: Document) {
    setPreviewDoc(doc);
    const { data } = await supabase
      .from("document_items")
      .select("*")
      .eq("document_id", doc.id)
      .order("sort_order");
    setPreviewItems(data ?? []);
    setPreviewOpen(true);
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

  function onDocTypeChange(docType: DocType) {
    const direction: DocDirection = docType === "PURCHASE_INVOICE" ? "EXPENSE" : "INCOME";
    setForm({ ...form, document_type: docType, direction });
  }

  function updateLineItem(idx: number, field: keyof DocumentLineItem, value: string) {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setLineItems(updated);
  }

  // Use filtered client list based on document direction
  const relevantClients = form.direction === "EXPENSE" ? supplierClients : customerClients;
  const clientOptions = relevantClients.map((c: any) => ({
    value: c.id,
    label: c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
    sublabel: c.nip ? `NIP: ${c.nip}` : undefined,
  }));

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

  const totalIncome = docs.filter(d => d.direction === "INCOME").reduce((s, d) => s + d.gross_amount, 0);
  const totalExpense = docs.filter(d => d.direction === "EXPENSE").reduce((s, d) => s + d.gross_amount, 0);
  const totalUnpaid = docs.filter(d => d.payment_status === "UNPAID" || d.payment_status === "OVERDUE").reduce((s, d) => s + (d.gross_amount - d.paid_amount), 0);

  const computedVat = (parseFloat(form.net_amount) || 0) * ((parseFloat(form.vat_rate) || 23) / 100);
  const computedGross = (parseFloat(form.net_amount) || 0) + computedVat;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rejestr dokumentów</h1>
          <p className="text-muted-foreground text-sm">Ewidencja faktur zakupowych i sprzedażowych</p>
        </div>
        <Button onClick={() => { resetForm(); setFormOpen(true); }} className="w-full sm:w-auto min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" />Dodaj dokument
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2 bg-primary/10 text-primary"><ArrowDownCircle className="h-5 w-5" /></div>
            <div><p className="text-xl sm:text-2xl font-bold tabular-nums">{formatCurrency(totalIncome)}</p><p className="text-sm text-muted-foreground">Przychody (brutto)</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2 bg-destructive/10 text-destructive"><ArrowUpCircle className="h-5 w-5" /></div>
            <div><p className="text-xl sm:text-2xl font-bold tabular-nums">{formatCurrency(totalExpense)}</p><p className="text-sm text-muted-foreground">Wydatki (brutto)</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2 bg-accent text-accent-foreground"><DollarSign className="h-5 w-5" /></div>
            <div><p className="text-xl sm:text-2xl font-bold tabular-nums">{formatCurrency(totalUnpaid)}</p><p className="text-sm text-muted-foreground">Do zapłaty</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 min-h-[44px]" placeholder="Szukaj po numerze, kontrahencie..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterDirection} onValueChange={setFilterDirection}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie kierunki</SelectItem>
            <SelectItem value="INCOME">Przychody</SelectItem>
            <SelectItem value="EXPENSE">Wydatki</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie statusy</SelectItem>
            {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map(k => (
              <SelectItem key={k} value={k}>{PAYMENT_STATUS_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table (desktop) / Cards (mobile) */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Ładowanie...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Brak dokumentów</CardContent></Card>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="space-y-3 md:hidden">
            {filtered.map(doc => (
              <div key={doc.id} className="mobile-data-card" onClick={() => openPreview(doc)}>
                <div className="mobile-card-header">
                  <div className="flex items-center gap-2">
                    {doc.direction === "INCOME" ? <ArrowDownCircle className="h-4 w-4 text-primary shrink-0" /> : <ArrowUpCircle className="h-4 w-4 text-destructive shrink-0" />}
                    <span className="font-medium font-mono text-sm">{doc.document_number}</span>
                  </div>
                  <Badge className={PAYMENT_STATUS_COLORS[doc.payment_status]} variant="secondary">
                    {PAYMENT_STATUS_LABELS[doc.payment_status]}
                  </Badge>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Typ</span>
                  <span className="text-sm">{DOC_TYPE_LABELS[doc.document_type]}</span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Kontrahent</span>
                  <span className="text-sm font-medium">{doc.contractor_name || getClientName(doc.clients)}</span>
                </div>
                {doc.contractor_nip && (
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">NIP</span>
                    <span className="text-sm font-mono">{doc.contractor_nip}</span>
                  </div>
                )}
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Brutto</span>
                  <span className="text-sm font-medium font-mono">{formatCurrency(doc.gross_amount)}</span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Data</span>
                  <span className="text-sm">{doc.issue_date}</span>
                </div>
                <div className="mobile-card-actions" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => openPreview(doc)}><Eye className="h-4 w-4 mr-1" />Podgląd</Button>
                  <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => openEdit(doc)}><Pencil className="h-4 w-4 mr-1" />Edytuj</Button>
                  <Button variant="ghost" size="sm" className="min-h-[44px] text-destructive" onClick={() => setDeleteConfirm(doc.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numer</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Kontrahent</TableHead>
                  <TableHead>Data wyst.</TableHead>
                  <TableHead>Termin</TableHead>
                  <TableHead className="text-right w-[120px]">Netto</TableHead>
                  <TableHead className="text-right w-[120px]">Brutto</TableHead>
                  <TableHead>Płatność</TableHead>
                  <TableHead className="w-[110px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(doc => (
                  <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openPreview(doc)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {doc.direction === "INCOME" ? <ArrowDownCircle className="h-4 w-4 text-primary shrink-0" /> : <ArrowUpCircle className="h-4 w-4 text-destructive shrink-0" />}
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
                    <TableCell className="text-right font-mono text-sm tabular-nums">{formatCurrency(doc.net_amount)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium tabular-nums">{formatCurrency(doc.gross_amount)}</TableCell>
                    <TableCell>
                      <Badge className={PAYMENT_STATUS_COLORS[doc.payment_status]} variant="secondary">
                        {PAYMENT_STATUS_LABELS[doc.payment_status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPreview(doc)} title="Podgląd"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(doc)} title="Edytuj"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(doc.id)} title="Usuń"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
      {/* ── Preview Dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {previewDoc?.document_number}
            </DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Typ dokumentu</p>
                  <p className="font-medium">{DOC_TYPE_LABELS[previewDoc.document_type]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kierunek</p>
                  <p className="font-medium">{DIRECTION_LABELS[previewDoc.direction]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kontrahent</p>
                  <p className="font-medium">{previewDoc.contractor_name || getClientName(previewDoc.clients)}</p>
                  {previewDoc.contractor_nip && <p className="text-xs text-muted-foreground">NIP: {previewDoc.contractor_nip}</p>}
                </div>
                <div>
                  <p className="text-muted-foreground">Status płatności</p>
                  <Badge className={PAYMENT_STATUS_COLORS[previewDoc.payment_status]} variant="secondary">{PAYMENT_STATUS_LABELS[previewDoc.payment_status]}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Data wystawienia</p>
                  <p className="font-medium">{previewDoc.issue_date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Termin płatności</p>
                  <p className="font-medium">{previewDoc.due_date || "—"}</p>
                </div>
                {previewDoc.sale_date && (
                  <div>
                    <p className="text-muted-foreground">Data sprzedaży</p>
                    <p className="font-medium">{previewDoc.sale_date}</p>
                  </div>
                )}
                {previewDoc.payment_method && (
                  <div>
                    <p className="text-muted-foreground">Metoda płatności</p>
                    <p className="font-medium">{PAYMENT_METHOD_LABELS[previewDoc.payment_method]}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Items */}
              {previewItems.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Pozycje dokumentu</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nazwa</TableHead>
                        <TableHead className="w-[60px] text-center">Typ</TableHead>
                        <TableHead className="w-[60px] text-right">Ilość</TableHead>
                        <TableHead className="w-[100px] text-right">Cena netto</TableHead>
                        <TableHead className="w-[60px] text-right">VAT%</TableHead>
                        <TableHead className="w-[110px] text-right">Brutto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewItems.map((pi: any) => (
                        <TableRow key={pi.id}>
                          <TableCell className="text-sm">{pi.name}</TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge variant="outline" className="text-xs">{pi.description === "PRODUCT" ? "Produkt" : "Usługa"}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{pi.quantity}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{formatCurrency(pi.unit_net)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{pi.vat_rate}%</TableCell>
                          <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(pi.total_gross)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Separator />

              {/* Totals */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Netto</span><span className="font-mono tabular-nums">{formatCurrency(previewDoc.net_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span className="font-mono tabular-nums">{formatCurrency(previewDoc.vat_amount)}</span></div>
                <div className="flex justify-between font-bold text-base"><span>Brutto</span><span className="font-mono tabular-nums">{formatCurrency(previewDoc.gross_amount)}</span></div>
                {previewDoc.paid_amount > 0 && (
                  <div className="flex justify-between pt-1 border-t border-border"><span className="text-muted-foreground">Zapłacono</span><span className="font-mono tabular-nums">{formatCurrency(previewDoc.paid_amount)}</span></div>
                )}
              </div>

              {(previewDoc.description || previewDoc.notes) && (
                <>
                  <Separator />
                  {previewDoc.description && <div><p className="text-sm text-muted-foreground">Opis</p><p className="text-sm">{previewDoc.description}</p></div>}
                  {previewDoc.notes && <div><p className="text-sm text-muted-foreground">Notatki</p><p className="text-sm whitespace-pre-wrap">{previewDoc.notes}</p></div>}
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>Zamknij</Button>
                <Button onClick={() => { setPreviewOpen(false); openEdit(previewDoc); }}>
                  <Pencil className="h-4 w-4 mr-1" /> Edytuj
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Form Dialog (Create / Edit) ── */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) resetForm(); else setFormOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edytuj dokument" : "Nowy dokument"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Typ dokumentu *</Label>
                <Select value={form.document_type} onValueChange={v => onDocTypeChange(v as DocType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map(k => (
                      <SelectItem key={k} value={k}>{DOC_TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kierunek</Label>
                <Select value={form.direction} onValueChange={v => setForm({ ...form, direction: v as DocDirection })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">Przychód</SelectItem>
                    <SelectItem value="EXPENSE">Wydatek</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Numer dokumentu</Label>
                <Input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} placeholder="np. FV/12/03/2026" />
                <p className="text-xs text-muted-foreground mt-1">Puste = autonumeracja</p>
              </div>
            </div>

            {/* Contractor */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Kontrahent</p>
              <div>
                <Label>Klient z bazy</Label>
                <SearchableSelect
                  options={clientOptions}
                  value={form.client_id}
                  onChange={onClientSelect}
                  placeholder="Wybierz klienta..."
                  onAddNew={() => setClientDialogOpen(true)}
                  addNewLabel="Dodaj kontrahenta"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nazwa kontrahenta</Label><Input value={form.contractor_name} onChange={e => setForm({ ...form, contractor_name: e.target.value })} /></div>
                <div><Label>NIP</Label><Input value={form.contractor_nip} onChange={e => setForm({ ...form, contractor_nip: e.target.value })} /></div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data wystawienia *</Label><Input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} /></div>
              <div><Label>Data sprzedaży</Label><Input type="date" value={form.sale_date} onChange={e => setForm({ ...form, sale_date: e.target.value })} /></div>
              <div><Label>Termin płatności</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              <div><Label>Data otrzymania</Label><Input type="date" value={form.received_date} onChange={e => setForm({ ...form, received_date: e.target.value })} /></div>
            </div>

            {/* Line Items */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Pozycje dokumentu</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setLineItems([...lineItems, { ...emptyLineItem }])}>
                  <Plus className="h-3 w-3 mr-1" /> Dodaj pozycję
                </Button>
              </div>
              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_80px_100px_70px_100px_36px] gap-2 text-xs font-medium text-muted-foreground">
                <span>Nazwa</span>
                <span>Typ</span>
                <span>Ilość</span>
                <span>Cena brutto</span>
                <span>VAT%</span>
                <span>Brutto</span>
                <span></span>
              </div>
              {lineItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_80px_100px_70px_100px_36px] gap-2 items-center">
                  <Input value={item.name} onChange={e => updateLineItem(idx, "name", e.target.value)} placeholder="Nazwa pozycji" className="h-9 text-sm" />
                  <Select value={item.item_type} onValueChange={v => updateLineItem(idx, "item_type", v)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SERVICE">Usługa</SelectItem>
                      <SelectItem value="PRODUCT">Produkt</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min="0" step="1" value={item.quantity} placeholder="1" onChange={e => updateLineItem(idx, "quantity", e.target.value)} className="h-9 text-sm tabular-nums" />
                  <Input type="number" step="0.01"
                    value={(() => { const net = parseFloat(item.unit_net) || 0; const vat = parseFloat(item.vat_rate) || 23; return net > 0 ? (net * (1 + vat / 100)).toFixed(2) : ""; })()}
                    onChange={e => { const gross = parseFloat(e.target.value) || 0; const vat = parseFloat(item.vat_rate) || 23; updateLineItem(idx, "unit_net", (gross / (1 + vat / 100)).toFixed(2)); }}
                    placeholder="0.00" className="h-9 text-sm tabular-nums" />
                  <Input type="number" min="0" max="100" value={item.vat_rate} placeholder="23" onChange={e => updateLineItem(idx, "vat_rate", e.target.value)} className="h-9 text-sm tabular-nums" />
                  <Input value={formatCurrency(
                    (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_net) || 0) * (1 + (parseFloat(item.vat_rate) || 23) / 100)
                  )} disabled className="h-9 text-sm bg-muted tabular-nums" />
                  {lineItems.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {lineItems.length <= 1 && <div />}
                </div>
              ))}
              {/* Summary */}
              <div className="border-t border-border pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Suma netto</span><span className="font-mono font-medium tabular-nums">{formatCurrency(computedFromItems.net)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Suma VAT</span><span className="font-mono tabular-nums">{formatCurrency(computedFromItems.vat)}</span></div>
                <div className="flex justify-between font-bold"><span>Suma brutto</span><span className="font-mono tabular-nums">{formatCurrency(computedFromItems.gross)}</span></div>
              </div>
            </div>

            {/* Fallback manual entry */}
            {!hasLineItems && (
              <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Kwoty ręczne (jeśli brak pozycji)</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Brutto</Label>
                    <Input type="number" step="0.01"
                      value={(() => { const net = parseFloat(form.net_amount) || 0; const vat = parseFloat(form.vat_rate) || 23; return net > 0 ? (net * (1 + vat / 100)).toFixed(2) : ""; })()}
                      onChange={e => { const gross = parseFloat(e.target.value) || 0; const vat = parseFloat(form.vat_rate) || 23; setForm({ ...form, net_amount: (gross / (1 + vat / 100)).toFixed(2) }); }}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">netto: {(parseFloat(form.net_amount) || 0).toFixed(2)} zł</p>
                  </div>
                  <div><Label>Stawka VAT (%)</Label><Input type="number" value={form.vat_rate} onChange={e => setForm({ ...form, vat_rate: e.target.value })} /></div>
                  <div><Label>Netto</Label><Input value={formatCurrency(parseFloat(form.net_amount) || 0)} disabled className="bg-muted" /></div>
                </div>
              </div>
            )}

            {/* Payment */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Status płatności</Label>
                <Select value={form.payment_status} onValueChange={v => setForm({ ...form, payment_status: v as PaymentStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map(k => (
                      <SelectItem key={k} value={k}>{PAYMENT_STATUS_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Metoda płatności</Label>
                <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(k => (
                      <SelectItem key={k} value={k}>{PAYMENT_METHOD_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Zapłacono</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={e => setForm({ ...form, paid_amount: e.target.value })} /></div>
            </div>

            <div><Label>Opis</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Notatki</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>

            {/* Attachments */}
            <div className="rounded-lg border border-border p-4">
              <DocumentAttachments documentId={editId} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>Anuluj</Button>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={!form.issue_date || (!hasLineItems && !form.net_amount) || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Zapisywanie..." : editId ? "Zapisz zmiany" : "Dodaj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Inline Client Create Dialog ── */}
      <ClientFormDialog
        externalOpen={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={(clientId) => {
          qc.invalidateQueries({ queryKey: ["clients-select-with-role"] });
          // Auto-select after short delay for data to refresh
          setTimeout(() => {
            onClientSelect(clientId);
          }, 300);
        }}
      />

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={v => { if (!v) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć dokument?</AlertDialogTitle>
            <AlertDialogDescription>Ta operacja jest nieodwracalna. Pozycje dokumentu zostaną również usunięte.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
