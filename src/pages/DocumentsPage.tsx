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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
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
  Plus, Search, FileText, ArrowDownCircle, ArrowUpCircle, Pencil, Trash2, Eye,
  DollarSign, ShoppingCart, Receipt, FileCheck, FileMinus2,
} from "lucide-react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ClientFormDialog } from "@/components/ClientFormDialog";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/types/database";
import { DocumentAttachments } from "@/components/DocumentAttachments";
import { createWarehouseDocument } from "@/lib/warehouseDocuments";

type DocType = "PURCHASE_INVOICE" | "SALES_INVOICE" | "RECEIPT" | "PROFORMA" | "CORRECTION" | "OTHER";
type DocDirection = "INCOME" | "EXPENSE";
type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
type DocItemType = "PRODUCT" | "SERVICE" | "INTERNAL_COST";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  PURCHASE_INVOICE: "Faktura zakupowa",
  SALES_INVOICE: "Faktura sprzedażowa",
  RECEIPT: "Paragon",
  PROFORMA: "Proforma",
  CORRECTION: "Korekta",
  OTHER: "Inny",
};

const DOC_TYPE_SHORT: Record<DocType, string> = {
  PURCHASE_INVOICE: "Zakupowa",
  SALES_INVOICE: "Sprzedażowa",
  RECEIPT: "Paragon",
  PROFORMA: "Proforma",
  CORRECTION: "Korekta",
  OTHER: "Inny",
};

const DOC_TYPE_COLORS: Record<DocType, string> = {
  PURCHASE_INVOICE: "bg-destructive/10 text-destructive",
  SALES_INVOICE: "bg-primary/10 text-primary",
  RECEIPT: "bg-muted text-muted-foreground",
  PROFORMA: "bg-accent text-accent-foreground",
  CORRECTION: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  OTHER: "bg-muted text-muted-foreground",
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

// Type-specific config
const TYPE_CONFIG: Record<string, {
  contractorLabel: string;
  dateLabel: string;
  dueDateLabel: string;
  itemsLabel: string;
  direction: DocDirection;
  showInventoryType: boolean;
  showPayment: boolean;
}> = {
  PURCHASE_INVOICE: { contractorLabel: "Dostawca", dateLabel: "Data zakupu", dueDateLabel: "Termin płatności", itemsLabel: "Pozycje zakupu", direction: "EXPENSE", showInventoryType: true, showPayment: true },
  SALES_INVOICE: { contractorLabel: "Klient", dateLabel: "Data sprzedaży", dueDateLabel: "Termin płatności", itemsLabel: "Pozycje sprzedaży", direction: "INCOME", showInventoryType: false, showPayment: true },
  PROFORMA: { contractorLabel: "Klient", dateLabel: "Data wystawienia", dueDateLabel: "Termin ważności", itemsLabel: "Pozycje", direction: "INCOME", showInventoryType: false, showPayment: false },
  CORRECTION: { contractorLabel: "Kontrahent", dateLabel: "Data wystawienia", dueDateLabel: "Termin płatności", itemsLabel: "Pozycje korekty", direction: "INCOME", showInventoryType: false, showPayment: true },
  RECEIPT: { contractorLabel: "Kontrahent", dateLabel: "Data wystawienia", dueDateLabel: "Termin płatności", itemsLabel: "Pozycje", direction: "INCOME", showInventoryType: false, showPayment: true },
  OTHER: { contractorLabel: "Kontrahent", dateLabel: "Data wystawienia", dueDateLabel: "Termin płatności", itemsLabel: "Pozycje", direction: "INCOME", showInventoryType: false, showPayment: true },
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
  related_document_id: string | null;
  correction_reason: string | null;
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
  related_document_id: "",
  correction_reason: "",
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
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState("ALL");
  const [filterPayment, setFilterPayment] = useState("ALL");
  const [lineItems, setLineItems] = useState<DocumentLineItem[]>([{ ...emptyLineItem }]);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [pzPromptData, setPzPromptData] = useState<{ docId: string; docNumber: string; clientId: string | null; items: any[] } | null>(null);

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
        .select("id, display_name, company_name, first_name, last_name, nip, business_role, address_city, address_street, address_building, address_local, address_postal_code, email, phone")
        .eq("is_active", true)
        .order("display_name");
      return data ?? [];
    },
  });

  const supplierClients = clients.filter((c: any) => c.business_role === "SUPPLIER" || c.business_role === "CUSTOMER_AND_SUPPLIER");
  const customerClients = clients.filter((c: any) => c.business_role === "CUSTOMER" || c.business_role === "CUSTOMER_AND_SUPPLIER");

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items-select"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_items").select("id, name, sku, purchase_net, sale_net").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

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

  const typeConfig = TYPE_CONFIG[form.document_type] || TYPE_CONFIG.OTHER;

  async function loadDocumentItems(docId: string) {
    const { data } = await supabase.from("document_items").select("*").eq("document_id", docId).order("sort_order");
    if (data && data.length > 0) {
      setLineItems(data.map((di: any) => ({
        id: di.id, name: di.name, quantity: di.quantity.toString(), unit: di.unit,
        unit_net: di.unit_net.toString(), vat_rate: di.vat_rate.toString(),
        item_type: (di.item_type || di.description || "SERVICE") as DocItemType,
        inventory_item_id: di.inventory_item_id,
      })));
    } else {
      setLineItems([{ ...emptyLineItem }]);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const netAmount = hasLineItems ? computedFromItems.net : (parseFloat(values.net_amount) || 0);
      const vatRate = parseFloat(values.vat_rate) || 23;
      const vatAmount = hasLineItems ? computedFromItems.vat : netAmount * (vatRate / 100);
      const grossAmount = hasLineItems ? computedFromItems.gross : netAmount + vatAmount;

      const payload: Record<string, unknown> = {
        document_number: values.document_number.trim() || "TEMP",
        document_type: values.document_type,
        direction: (TYPE_CONFIG[values.document_type] || TYPE_CONFIG.OTHER).direction,
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
        related_document_id: values.related_document_id || null,
        correction_reason: values.correction_reason || null,
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
              document_id: docId!, name: item.name, quantity: qty, unit: item.unit || "szt.",
              unit_net: unitNet, vat_rate: vatR, total_net: totalNet, total_vat: totalVat, total_gross: totalGross,
              sort_order: idx, description: item.item_type, item_type: item.item_type, inventory_item_id: item.inventory_item_id || null,
            };
          });
          const { error: itemErr } = await supabase.from("document_items").insert(items);
          if (itemErr) throw itemErr;

          if (values.document_type === "PURCHASE_INVOICE") {
            if (editId) {
              await supabase.from("inventory_movements").delete().eq("source_id", docId!).eq("source_type", "PURCHASE");
            }
            for (const item of items) {
              if (item.item_type === "PRODUCT") {
                let invItemId = item.inventory_item_id;
                if (!invItemId) {
                  const { data: existing } = await supabase.from("inventory_items").select("id").eq("name", item.name).maybeSingle();
                  if (existing) { invItemId = existing.id; }
                  else {
                    const { data: created } = await supabase.from("inventory_items").insert({ name: item.name, purchase_net: item.unit_net, unit: item.unit, vat_rate: item.vat_rate }).select("id").single();
                    if (created) invItemId = created.id;
                  }
                }
                if (invItemId) {
                  await supabase.from("inventory_items").update({ purchase_net: item.unit_net }).eq("id", invItemId);
                  await supabase.from("inventory_movements").insert({
                    item_id: invItemId, movement_type: "IN", quantity: item.quantity,
                    source_type: "PURCHASE", source_id: docId, purchase_net: item.unit_net,
                    notes: `Faktura: ${values.document_number || "auto"}`, created_by: user?.id,
                  });
                }
              }
            }
          }
        }
      }
    },
    onSuccess: (_data, values) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      const docNum = form.document_number || "auto";
      supabase.from("activity_logs").insert({
        entity_type: "document", entity_id: editId || "new", action_type: editId ? "UPDATE" : "CREATE",
        user_id: user?.id, entity_name: docNum,
        description: editId ? `Edycja dokumentu ${docNum}` : `Utworzono dokument ${docNum}`,
      } as any).then();
      toast.success(editId ? "Zaktualizowano dokument" : "Dodano dokument");

      // Check if purchase invoice with product items → prompt PZ
      if (values.document_type === "PURCHASE_INVOICE" && !editId) {
        const productItems = lineItems.filter(i => i.item_type === "PRODUCT" && i.inventory_item_id);
        if (productItems.length > 0) {
          // We need the saved doc id — fetch latest
          supabase.from("documents").select("id, document_number").eq("created_by", user?.id).order("created_at", { ascending: false }).limit(1).single().then(({ data: latestDoc }) => {
            if (latestDoc) {
              setPzPromptData({
                docId: latestDoc.id,
                docNumber: latestDoc.document_number,
                clientId: values.client_id || null,
                items: productItems.map(i => ({
                  inventory_item_id: i.inventory_item_id!,
                  quantity: parseFloat(i.quantity) || 1,
                  price_net: parseFloat(i.unit_net) || 0,
                  notes: i.name,
                })),
              });
            }
          });
        }
      }

      resetForm();
    },
    onError: (err: any) => toast.error(err?.message || "Błąd zapisu"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").update({ deleted_at: new Date().toISOString(), deleted_by: user?.id } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, deletedId) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      supabase.from("activity_logs").insert({ entity_type: "document", entity_id: deletedId, action_type: "DELETE", user_id: user?.id, description: "Usunięto dokument" } as any).then();
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

  function openNewDocument(docType: DocType) {
    const cfg = TYPE_CONFIG[docType] || TYPE_CONFIG.OTHER;
    setForm({ ...emptyForm, document_type: docType, direction: cfg.direction });
    setEditId(null);
    setLineItems([{ ...emptyLineItem }]);
    setTypePickerOpen(false);
    setFormOpen(true);
  }

  async function openEdit(doc: Document) {
    setEditId(doc.id);
    setForm({
      document_number: doc.document_number, document_type: doc.document_type, direction: doc.direction,
      client_id: doc.client_id ?? "", contractor_name: doc.contractor_name ?? "", contractor_nip: doc.contractor_nip ?? "",
      issue_date: doc.issue_date, sale_date: doc.sale_date ?? "", due_date: doc.due_date ?? "",
      received_date: doc.received_date ?? "", net_amount: doc.net_amount.toString(), vat_rate: doc.vat_rate.toString(),
      payment_status: doc.payment_status, payment_method: doc.payment_method ?? "", paid_amount: doc.paid_amount.toString(),
      description: doc.description ?? "", notes: doc.notes ?? "",
      related_document_id: doc.related_document_id ?? "", correction_reason: doc.correction_reason ?? "",
    });
    await loadDocumentItems(doc.id);
    setFormOpen(true);
  }

  async function openPreview(doc: Document) {
    setPreviewDoc(doc);
    const { data } = await supabase.from("document_items").select("*").eq("document_id", doc.id).order("sort_order");
    setPreviewItems(data ?? []);
    setPreviewOpen(true);
  }

  function onClientSelect(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    setForm({
      ...form, client_id: clientId,
      contractor_name: client ? (client.display_name || client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ")) : "",
      contractor_nip: client?.nip ?? "",
    });
  }

  const selectedClient = clients.find((c: any) => c.id === form.client_id);

  function getClientAddress(c: any) {
    if (!c) return "";
    const street = [c.address_street, c.address_building, c.address_local ? `/${c.address_local}` : ""].filter(Boolean).join(" ");
    return [street, [c.address_postal_code, c.address_city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  }

  function onPaymentStatusChange(status: PaymentStatus) {
    const grossTotal = hasLineItems ? computedFromItems.gross : ((parseFloat(form.net_amount) || 0) * (1 + (parseFloat(form.vat_rate) || 23) / 100));
    if (status === "PAID") setForm({ ...form, payment_status: status, paid_amount: grossTotal.toFixed(2) });
    else if (status === "UNPAID") setForm({ ...form, payment_status: status, paid_amount: "0" });
    else setForm({ ...form, payment_status: status });
  }

  function updateLineItem(idx: number, field: keyof DocumentLineItem, value: string) {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setLineItems(updated);
  }

  const derivedDirection = (TYPE_CONFIG[form.document_type] || TYPE_CONFIG.OTHER).direction;
  const relevantClients = derivedDirection === "EXPENSE" ? supplierClients : customerClients;
  const clientOptions = relevantClients.map((c: any) => {
    const name = c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
    const details = [c.nip ? `NIP: ${c.nip}` : "", c.address_city, c.phone].filter(Boolean).join(" · ");
    return { value: c.id, label: name, sublabel: details || undefined };
  });

  // Document options for correction linking
  const correctionDocOptions = docs
    .filter(d => d.document_type !== "CORRECTION")
    .map(d => ({ value: d.id, label: `${d.document_number} — ${d.contractor_name || ""}`, sublabel: `${DOC_TYPE_SHORT[d.document_type]} · ${formatCurrency(d.gross_amount)}` }));

  const relatedDoc = form.related_document_id ? docs.find(d => d.id === form.related_document_id) : null;

  // Filtering
  const filtered = docs.filter((d) => {
    if (filterTab === "PURCHASE" && d.document_type !== "PURCHASE_INVOICE") return false;
    if (filterTab === "SALES" && d.document_type !== "SALES_INVOICE") return false;
    if (filterTab === "PROFORMA" && d.document_type !== "PROFORMA") return false;
    if (filterTab === "CORRECTION" && d.document_type !== "CORRECTION") return false;
    if (filterPayment !== "ALL" && d.payment_status !== filterPayment) return false;
    if (search) {
      const s = search.toLowerCase();
      return d.document_number.toLowerCase().includes(s) || d.contractor_name?.toLowerCase().includes(s) ||
        d.contractor_nip?.toLowerCase().includes(s) || d.description?.toLowerCase().includes(s) ||
        getClientName(d.clients).toLowerCase().includes(s);
    }
    return true;
  });

  const getDirection = (d: Document) => (TYPE_CONFIG[d.document_type] || TYPE_CONFIG.OTHER).direction;
  const totalIncome = docs.filter(d => getDirection(d) === "INCOME").reduce((s, d) => s + d.gross_amount, 0);
  const totalExpense = docs.filter(d => getDirection(d) === "EXPENSE").reduce((s, d) => s + d.gross_amount, 0);
  const totalUnpaid = docs.filter(d => d.payment_status === "UNPAID" || d.payment_status === "OVERDUE").reduce((s, d) => s + (d.gross_amount - d.paid_amount), 0);

  // Preview: find related doc for correction
  const previewRelatedDoc = previewDoc?.related_document_id ? docs.find(d => d.id === previewDoc.related_document_id) : null;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rejestr dokumentów</h1>
          <p className="text-muted-foreground text-sm">Faktury zakupowe, sprzedażowe, proformy i korekty</p>
        </div>
        <Button onClick={() => setTypePickerOpen(true)} className="w-full sm:w-auto min-h-[44px]">
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

      {/* Tabs + Filters */}
      <div className="space-y-3">
        <Tabs value={filterTab} onValueChange={setFilterTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="ALL">Wszystkie</TabsTrigger>
            <TabsTrigger value="PURCHASE">Zakupowe</TabsTrigger>
            <TabsTrigger value="SALES">Sprzedażowe</TabsTrigger>
            <TabsTrigger value="PROFORMA">Proformy</TabsTrigger>
            <TabsTrigger value="CORRECTION">Korekty</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 min-h-[44px]" placeholder="Szukaj po numerze, kontrahencie, NIP..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
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
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Ładowanie...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Brak dokumentów</CardContent></Card>
      ) : (
        <>
          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map(doc => (
              <div key={doc.id} className="mobile-data-card" onClick={() => openPreview(doc)}>
                <div className="mobile-card-header">
                  <div className="flex items-center gap-2">
                    <Badge className={DOC_TYPE_COLORS[doc.document_type]} variant="secondary">
                      {DOC_TYPE_SHORT[doc.document_type]}
                    </Badge>
                    <span className="font-medium font-mono text-sm">{doc.document_number}</span>
                  </div>
                  <Badge className={PAYMENT_STATUS_COLORS[doc.payment_status]} variant="secondary">{PAYMENT_STATUS_LABELS[doc.payment_status]}</Badge>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Kontrahent</span>
                  <span className="text-sm font-medium">{doc.contractor_name || getClientName(doc.clients)}</span>
                </div>
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

          {/* Desktop */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Numer</TableHead>
                  <TableHead>Kontrahent</TableHead>
                  <TableHead>Data</TableHead>
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
                      <Badge className={DOC_TYPE_COLORS[doc.document_type]} variant="secondary">
                        {DOC_TYPE_SHORT[doc.document_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium font-mono text-sm">{doc.document_number}</span>
                    </TableCell>
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
                      <Badge className={PAYMENT_STATUS_COLORS[doc.payment_status]} variant="secondary">{PAYMENT_STATUS_LABELS[doc.payment_status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPreview(doc)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(doc)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(doc.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* ── Type Picker Dialog ── */}
      <Dialog open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Wybierz typ dokumentu</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <Button variant="outline" className="h-auto p-4 justify-start gap-3" onClick={() => openNewDocument("PURCHASE_INVOICE")}>
              <div className="rounded-lg p-2 bg-destructive/10 text-destructive"><ShoppingCart className="h-5 w-5" /></div>
              <div className="text-left"><p className="font-medium">Faktura zakupowa</p><p className="text-xs text-muted-foreground">Zakup towarów i usług od dostawców</p></div>
            </Button>
            <Button variant="outline" className="h-auto p-4 justify-start gap-3" onClick={() => openNewDocument("SALES_INVOICE")}>
              <div className="rounded-lg p-2 bg-primary/10 text-primary"><Receipt className="h-5 w-5" /></div>
              <div className="text-left"><p className="font-medium">Faktura sprzedażowa</p><p className="text-xs text-muted-foreground">Sprzedaż usług i towarów klientom</p></div>
            </Button>
            <Button variant="outline" className="h-auto p-4 justify-start gap-3" onClick={() => openNewDocument("PROFORMA")}>
              <div className="rounded-lg p-2 bg-accent text-accent-foreground"><FileCheck className="h-5 w-5" /></div>
              <div className="text-left"><p className="font-medium">Proforma</p><p className="text-xs text-muted-foreground">Dokument informacyjny przed wystawieniem faktury</p></div>
            </Button>
            <Button variant="outline" className="h-auto p-4 justify-start gap-3" onClick={() => openNewDocument("CORRECTION")}>
              <div className="rounded-lg p-2 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><FileMinus2 className="h-5 w-5" /></div>
              <div className="text-left"><p className="font-medium">Korekta</p><p className="text-xs text-muted-foreground">Korekta do istniejącego dokumentu</p></div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {previewDoc?.document_number}
              {previewDoc && <Badge className={DOC_TYPE_COLORS[previewDoc.document_type]} variant="secondary">{DOC_TYPE_SHORT[previewDoc.document_type]}</Badge>}
            </DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div className="space-y-4">
              {/* Correction reference */}
              {previewDoc.document_type === "CORRECTION" && previewRelatedDoc && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-3 text-sm">
                  <p className="font-medium text-orange-700 dark:text-orange-400">Korekta do: {previewRelatedDoc.document_number}</p>
                  {previewDoc.correction_reason && <p className="text-muted-foreground mt-1">Powód: {previewDoc.correction_reason}</p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Typ dokumentu</p>
                  <p className="font-medium">{DOC_TYPE_LABELS[previewDoc.document_type]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kierunek</p>
                  <p className="font-medium">{DIRECTION_LABELS[(TYPE_CONFIG[previewDoc.document_type] || TYPE_CONFIG.OTHER).direction]}</p>
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
                  <div><p className="text-muted-foreground">Data sprzedaży</p><p className="font-medium">{previewDoc.sale_date}</p></div>
                )}
                {previewDoc.payment_method && (
                  <div><p className="text-muted-foreground">Metoda płatności</p><p className="font-medium">{PAYMENT_METHOD_LABELS[previewDoc.payment_method]}</p></div>
                )}
              </div>

              <Separator />

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
                          <TableCell className="text-xs text-center"><Badge variant="outline" className="text-xs">{pi.description === "PRODUCT" ? "Produkt" : "Usługa"}</Badge></TableCell>
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

              <Separator />
              <DocumentAttachments documentId={previewDoc.id} />

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>Zamknij</Button>
                <Button onClick={() => { setPreviewOpen(false); openEdit(previewDoc); }}><Pencil className="h-4 w-4 mr-1" /> Edytuj</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Form Dialog (Create / Edit) ── */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) resetForm(); else setFormOpen(true); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editId ? "Edytuj dokument" : "Nowy dokument"}
              <Badge className={DOC_TYPE_COLORS[form.document_type]} variant="secondary">{DOC_TYPE_LABELS[form.document_type]}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Top row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Typ dokumentu</Label>
                <Select value={form.document_type} onValueChange={v => {
                  const cfg = TYPE_CONFIG[v] || TYPE_CONFIG.OTHER;
                  setForm({ ...form, document_type: v as DocType, direction: cfg.direction });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map(k => (
                      <SelectItem key={k} value={k}>{DOC_TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Direction auto-derived from document type */}
              <div>
                <Label>Numer dokumentu</Label>
                <Input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} placeholder="np. FV/12/03/2026" />
                <p className="text-xs text-muted-foreground mt-1">Puste = autonumeracja</p>
              </div>
            </div>

            {/* Correction-specific: linked document + reason */}
            {form.document_type === "CORRECTION" && (
              <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10 p-4 space-y-3">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400">Dane korekty</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <Label>Dokument korygowany</Label>
                    <SearchableSelect
                      options={correctionDocOptions}
                      value={form.related_document_id}
                      onChange={v => {
                        const rd = docs.find(d => d.id === v);
                        setForm({
                          ...form, related_document_id: v,
                          client_id: rd?.client_id ?? form.client_id,
                          contractor_name: rd?.contractor_name ?? form.contractor_name,
                          contractor_nip: rd?.contractor_nip ?? form.contractor_nip,
                          direction: rd?.direction ?? form.direction,
                        });
                      }}
                      placeholder="Wybierz dokument..."
                    />
                    {relatedDoc && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {DOC_TYPE_SHORT[relatedDoc.document_type]} · {relatedDoc.contractor_name} · {formatCurrency(relatedDoc.gross_amount)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Powód korekty</Label>
                    <Textarea value={form.correction_reason} onChange={e => setForm({ ...form, correction_reason: e.target.value })} rows={2} placeholder="Np. błąd w cenie, zwrot towaru..." />
                  </div>
                </div>
              </div>
            )}

            {/* Contractor section */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">{typeConfig.contractorLabel}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label>{typeConfig.contractorLabel} z bazy</Label>
                    <SearchableSelect
                      options={clientOptions}
                      value={form.client_id}
                      onChange={onClientSelect}
                      placeholder={`Szukaj ${form.direction === "EXPENSE" ? "dostawcy" : "klienta"}...`}
                      onAddNew={() => setClientDialogOpen(true)}
                      addNewLabel={`Dodaj ${form.direction === "EXPENSE" ? "dostawcę" : "klienta"}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nazwa</Label><Input value={form.contractor_name} onChange={e => setForm({ ...form, contractor_name: e.target.value })} /></div>
                    <div><Label>NIP</Label><Input value={form.contractor_nip} onChange={e => setForm({ ...form, contractor_nip: e.target.value })} /></div>
                  </div>
                </div>
                {selectedClient && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                    <p className="font-medium">{selectedClient.display_name || selectedClient.company_name || [selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(" ")}</p>
                    {selectedClient.nip && <p className="text-muted-foreground">NIP: <span className="font-mono">{selectedClient.nip}</span></p>}
                    {getClientAddress(selectedClient) && <p className="text-muted-foreground">{getClientAddress(selectedClient)}</p>}
                    {selectedClient.email && <p className="text-muted-foreground">{selectedClient.email}</p>}
                    {selectedClient.phone && <p className="text-muted-foreground">{selectedClient.phone}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><Label>{typeConfig.dateLabel} *</Label><Input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} /></div>
              {form.document_type !== "PROFORMA" && (
                <div><Label>Data sprzedaży</Label><Input type="date" value={form.sale_date} onChange={e => setForm({ ...form, sale_date: e.target.value })} /></div>
              )}
              <div><Label>{typeConfig.dueDateLabel}</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              {form.document_type === "PURCHASE_INVOICE" && (
                <div><Label>Data otrzymania</Label><Input type="date" value={form.received_date} onChange={e => setForm({ ...form, received_date: e.target.value })} /></div>
              )}
            </div>

            {/* Line Items */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{typeConfig.itemsLabel}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setLineItems([...lineItems, { ...emptyLineItem }])}>
                  <Plus className="h-3 w-3 mr-1" /> Dodaj pozycję
                </Button>
              </div>
              <div className={`hidden sm:grid gap-2 text-xs font-medium text-muted-foreground ${typeConfig.showInventoryType ? "grid-cols-[1fr_100px_70px_120px_70px_120px_36px]" : "grid-cols-[1fr_70px_120px_70px_120px_36px]"}`}>
                <span>Nazwa</span>
                {typeConfig.showInventoryType && <span>Typ</span>}
                <span>Ilość</span>
                <span>Cena brutto</span>
                <span>VAT%</span>
                <span>Brutto</span>
                <span></span>
              </div>
              {lineItems.map((item, idx) => (
                <div key={idx} className={`grid grid-cols-1 gap-2 items-center ${typeConfig.showInventoryType ? "sm:grid-cols-[1fr_100px_70px_120px_70px_120px_36px]" : "sm:grid-cols-[1fr_70px_120px_70px_120px_36px]"}`}>
                  <Input value={item.name} onChange={e => updateLineItem(idx, "name", e.target.value)} placeholder="Nazwa pozycji" className="h-9 text-sm" />
                  {typeConfig.showInventoryType && (
                    <Select value={item.item_type} onValueChange={v => updateLineItem(idx, "item_type", v)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SERVICE">Usługa</SelectItem>
                        <SelectItem value="PRODUCT">Produkt</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Input type="number" min="0" step="1" value={item.quantity} placeholder="1" onChange={e => updateLineItem(idx, "quantity", e.target.value)} className="h-9 text-sm tabular-nums" />
                  <Input type="number" step="0.01"
                    value={(() => { const net = parseFloat(item.unit_net) || 0; const vat = parseFloat(item.vat_rate) || 23; return net > 0 ? (net * (1 + vat / 100)).toFixed(2) : ""; })()}
                    onChange={e => { const gross = parseFloat(e.target.value) || 0; const vat = parseFloat(item.vat_rate) || 23; updateLineItem(idx, "unit_net", (gross / (1 + vat / 100)).toFixed(2)); }}
                    placeholder="0.00" className="h-9 text-sm tabular-nums" />
                  <Input type="number" min="0" max="100" value={item.vat_rate} placeholder="23" onChange={e => updateLineItem(idx, "vat_rate", e.target.value)} className="h-9 text-sm tabular-nums" />
                  <Input value={formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_net) || 0) * (1 + (parseFloat(item.vat_rate) || 23) / 100))} disabled className="h-9 text-sm bg-muted tabular-nums" />
                  {lineItems.length > 1 ? (
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button>
                  ) : <div />}
                </div>
              ))}
              <div className="border-t border-border pt-3 space-y-1 text-sm max-w-xs ml-auto">
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

            {/* Payment section — hidden for proforma */}
            {typeConfig.showPayment && (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Płatność</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Status płatności</Label>
                    <Select value={form.payment_status} onValueChange={v => onPaymentStatusChange(v as PaymentStatus)}>
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
                  <div>
                    <Label>Kwota opłacona</Label>
                    <Input type="number" step="0.01" value={form.paid_amount}
                      onChange={e => setForm({ ...form, paid_amount: e.target.value })}
                      disabled={form.payment_status === "PAID" || form.payment_status === "UNPAID"}
                      className={form.payment_status === "PAID" || form.payment_status === "UNPAID" ? "bg-muted" : ""}
                    />
                    {(() => {
                      const grossTotal = hasLineItems ? computedFromItems.gross : ((parseFloat(form.net_amount) || 0) * (1 + (parseFloat(form.vat_rate) || 23) / 100));
                      const paid = parseFloat(form.paid_amount) || 0;
                      const remaining = Math.max(0, grossTotal - paid);
                      return remaining > 0 ? (
                        <p className="text-xs text-muted-foreground mt-1 tabular-nums">Pozostało: <span className="font-medium text-destructive">{formatCurrency(remaining)}</span></p>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Opis</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Notatki</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            </div>

            {/* Attachments */}
            <div className="rounded-lg border border-border p-4">
              <DocumentAttachments documentId={editId} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>Anuluj</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.issue_date || (!hasLineItems && !form.net_amount) || saveMutation.isPending}>
                {saveMutation.isPending ? "Zapisywanie..." : editId ? "Zapisz zmiany" : "Dodaj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ClientFormDialog
        externalOpen={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={(clientId) => {
          qc.invalidateQueries({ queryKey: ["clients-select-with-role"] });
          setTimeout(() => onClientSelect(clientId), 300);
        }}
      />

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

      {/* PZ auto-create prompt */}
      <AlertDialog open={!!pzPromptData} onOpenChange={v => { if (!v) setPzPromptData(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Utworzyć dokument PZ?</AlertDialogTitle>
            <AlertDialogDescription>
              Faktura zakupowa {pzPromptData?.docNumber} zawiera {pzPromptData?.items?.length} pozycji magazynowych.
              Czy chcesz automatycznie utworzyć dokument PZ (Przyjęcie Zewnętrzne) dla tych pozycji?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPzPromptData(null)}>Nie, pomiń</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!pzPromptData) return;
              try {
                await createWarehouseDocument({
                  document_type: "PZ",
                  client_id: pzPromptData.clientId,
                  linked_invoice_id: pzPromptData.docId,
                  notes: `Auto z faktury ${pzPromptData.docNumber}`,
                  created_by: user?.id || null,
                  items: pzPromptData.items,
                });
                qc.invalidateQueries({ queryKey: ["warehouse-documents"] });
                toast.success("Utworzono dokument PZ");
              } catch (e) {
                toast.error("Nie udało się utworzyć PZ");
              }
              setPzPromptData(null);
            }}>
              Tak, utwórz PZ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
