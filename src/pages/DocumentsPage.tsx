import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGusLookup } from "@/hooks/useGusLookup";
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
  DollarSign, ShoppingCart, Receipt, FileCheck, FileMinus2, CalendarDays,
  Building2, MapPin, Mail, Phone as PhoneIcon, Hash, Paperclip, ScanLine, Globe, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ClientFormDialog } from "@/components/ClientFormDialog";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/types/database";
import { DocumentAttachments, useDocumentAttachmentCounts, uploadPendingFiles, type DocumentAttachmentsHandle } from "@/components/DocumentAttachments";
import { createWarehouseDocument } from "@/lib/warehouseDocuments";
import { OcrImportDialog, type OcrExtractedData } from "@/components/OcrImportDialog";

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
  PURCHASE_INVOICE: { contractorLabel: "Sprzedawca", dateLabel: "Data zakupu", dueDateLabel: "Termin płatności", itemsLabel: "Pozycje zakupu", direction: "EXPENSE", showInventoryType: true, showPayment: true },
  SALES_INVOICE: { contractorLabel: "Nabywca", dateLabel: "Data sprzedaży", dueDateLabel: "Termin płatności", itemsLabel: "Pozycje sprzedaży", direction: "INCOME", showInventoryType: true, showPayment: true },
  PROFORMA: { contractorLabel: "Nabywca", dateLabel: "Data wystawienia", dueDateLabel: "Termin ważności", itemsLabel: "Pozycje", direction: "INCOME", showInventoryType: true, showPayment: false },
  CORRECTION: { contractorLabel: "Kontrahent", dateLabel: "Data wystawienia", dueDateLabel: "Termin płatności", itemsLabel: "Pozycje korekty", direction: "INCOME", showInventoryType: true, showPayment: true },
  RECEIPT: { contractorLabel: "Kontrahent", dateLabel: "Data wystawienia", dueDateLabel: "Termin płatności", itemsLabel: "Pozycje", direction: "INCOME", showInventoryType: true, showPayment: true },
  OTHER: { contractorLabel: "Kontrahent", dateLabel: "Data wystawienia", dueDateLabel: "Termin płatności", itemsLabel: "Pozycje", direction: "INCOME", showInventoryType: true, showPayment: true },
};

interface Document {
  id: string;
  document_number: string;
  document_type: DocType;
  direction: DocDirection;
  client_id: string | null;
  contractor_name: string | null;
  contractor_nip: string | null;
  contractor_street: string | null;
  contractor_building: string | null;
  contractor_local: string | null;
  contractor_postal_code: string | null;
  contractor_city: string | null;
  contractor_country: string | null;
  contractor_email: string | null;
  contractor_phone: string | null;
  buyer_name: string | null;
  buyer_nip: string | null;
  buyer_street: string | null;
  buyer_building: string | null;
  buyer_local: string | null;
  buyer_postal_code: string | null;
  buyer_city: string | null;
  buyer_country: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
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
  contractor_street: "",
  contractor_building: "",
  contractor_local: "",
  contractor_postal_code: "",
  contractor_city: "",
  contractor_country: "Polska",
  contractor_email: "",
  contractor_phone: "",
  buyer_name: "",
  buyer_nip: "",
  buyer_street: "",
  buyer_building: "",
  buyer_local: "",
  buyer_postal_code: "",
  buyer_city: "",
  buyer_country: "Polska",
  buyer_email: "",
  buyer_phone: "",
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
  const [clientInitialData, setClientInitialData] = useState<Record<string, string> | null>(null);
  const [pzPromptData, setPzPromptData] = useState<{ docId: string; docNumber: string; clientId: string | null; items: any[] } | null>(null);
  const attachmentsRef = useRef<DocumentAttachmentsHandle>(null);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrSourceFile, setOcrSourceFile] = useState<File | null>(null);

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

  const { data: attachmentCounts = {} } = useDocumentAttachmentCounts();

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

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
        buyer_name: values.buyer_name || null,
        buyer_nip: values.buyer_nip || null,
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
      return docId;
    },
    onSuccess: (docId, values) => {
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

      // Upload pending attachment files
      if (docId && attachmentsRef.current) {
        const pending = attachmentsRef.current.getPendingFiles();
        if (pending.length > 0) {
          uploadPendingFiles(docId, pending, user?.id).then(() => {
            qc.invalidateQueries({ queryKey: ["document-attachments", docId] });
            qc.invalidateQueries({ queryKey: ["document-attachment-counts"] });
            toast.success(`Przesłano ${pending.length} załącznik(ów)`);
          }).catch(() => {
            toast.error("Błąd przesyłania załączników");
          });
          attachmentsRef.current.clearPending();
        }
      }

      // Auto-attach OCR source file
      if (docId && ocrSourceFile) {
        uploadPendingFiles(docId, [ocrSourceFile], user?.id).then(() => {
          qc.invalidateQueries({ queryKey: ["document-attachments", docId] });
          qc.invalidateQueries({ queryKey: ["document-attachment-counts"] });
        }).catch(() => {});
        setOcrSourceFile(null);
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
    const buyerDefaults = (docType === "PURCHASE_INVOICE" && companySettings)
      ? { buyer_name: companySettings.company_name || "", buyer_nip: companySettings.nip || "" }
      : {};
    setForm({ ...emptyForm, document_type: docType, direction: cfg.direction, ...buyerDefaults });
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
      buyer_name: doc.buyer_name ?? "", buyer_nip: doc.buyer_nip ?? "",
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

  /** Normalize NIP: strip "PL" prefix, dashes, spaces → digits only */
  function normalizeNip(nip: string | null | undefined): string {
    if (!nip) return "";
    return nip.replace(/^PL/i, "").replace(/[\s\-]/g, "");
  }

  function handleOcrData(data: OcrExtractedData) {
    const docType = (data.document_type as DocType) || "PURCHASE_INVOICE";
    const cfg = TYPE_CONFIG[docType] || TYPE_CONFIG.OTHER;
    const isPurchase = docType === "PURCHASE_INVOICE";

    const rawContractorNip = isPurchase ? data.seller_nip : data.buyer_nip;
    const contractorNip = normalizeNip(rawContractorNip);

    setForm({
      ...emptyForm,
      document_type: docType,
      direction: cfg.direction,
      document_number: data.document_number || "",
      issue_date: data.issue_date || new Date().toISOString().split("T")[0],
      sale_date: data.sale_date || "",
      due_date: data.due_date || "",
      contractor_name: isPurchase ? (data.seller_name || "") : (data.buyer_name || ""),
      contractor_nip: contractorNip,
      buyer_name: isPurchase ? (data.buyer_name || "") : (data.seller_name || ""),
      buyer_nip: normalizeNip(isPurchase ? data.buyer_nip : data.seller_nip),
      net_amount: data.net_amount != null ? data.net_amount.toString() : "",
      vat_rate: data.net_amount && data.vat_amount
        ? ((data.vat_amount / data.net_amount) * 100).toFixed(0)
        : "23",
      payment_method: data.payment_method || "",
      payment_status: "UNPAID",
      paid_amount: "",
    });

    // Match contractor by normalized NIP
    if (contractorNip) {
      const match = clients.find((c: any) => normalizeNip(c.nip) === contractorNip);
      if (match) {
        setForm(prev => ({
          ...prev,
          client_id: match.id,
          contractor_name: match.display_name || match.company_name || [match.first_name, match.last_name].filter(Boolean).join(" ") || prev.contractor_name,
        }));
        toast.success(`Znaleziono kontrahenta na podstawie NIP: ${match.display_name || match.company_name}`, { duration: 5000 });
      } else {
        // NIP not found — offer to create new contractor
        const ocrName = isPurchase ? data.seller_name : data.buyer_name;
        toast.info(
          `Nie znaleziono kontrahenta z NIP ${contractorNip}`,
          {
            duration: 8000,
            action: {
              label: "Dodaj kontrahenta",
              onClick: () => {
                setClientInitialData({
                  client_type: "BUSINESS",
                  business_role: isPurchase ? "SUPPLIER" : "CUSTOMER",
                  company_name: ocrName || "",
                  nip: contractorNip,
                });
                setClientDialogOpen(true);
              },
            },
          }
        );
      }
    }

    // If buyer not detected for purchase invoices, prefill from company settings
    if (isPurchase && !data.buyer_name && companySettings) {
      setForm(prev => ({
        ...prev,
        buyer_name: companySettings.company_name || "",
        buyer_nip: normalizeNip(companySettings.nip),
      }));
    }

    // Set line items if available
    if (data.line_items?.length > 0) {
      setLineItems(data.line_items.map(item => ({
        name: item.name || "",
        quantity: (item.quantity || 1).toString(),
        unit: item.unit || "szt.",
        unit_net: (item.unit_net || 0).toString(),
        vat_rate: (item.vat_rate || 23).toString(),
        item_type: "SERVICE" as DocItemType,
      })));
    } else {
      setLineItems([{ ...emptyLineItem }]);
    }

    setOcrSourceFile(data.sourceFile);
    setEditId(null);
    setFormOpen(true);
  }

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
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setOcrOpen(true)} className="w-full sm:w-auto min-h-[44px]">
            <ScanLine className="mr-2 h-4 w-4" />OCR import
          </Button>
          <Button onClick={() => setTypePickerOpen(true)} className="w-full sm:w-auto min-h-[44px]">
            <Plus className="mr-2 h-4 w-4" />Dodaj dokument
          </Button>
        </div>
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
                    {attachmentCounts[doc.id] && <Paperclip className="h-3 w-3 text-muted-foreground" />}
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
                      {attachmentCounts[doc.id] && <span className="inline-flex ml-1.5" title={`${attachmentCounts[doc.id]} załącznik(ów)`}><Paperclip className="h-3 w-3 text-muted-foreground" /></span>}
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
                  <p className="text-muted-foreground">{(TYPE_CONFIG[previewDoc.document_type] || TYPE_CONFIG.OTHER).contractorLabel}</p>
                  <p className="font-medium">{previewDoc.contractor_name || getClientName(previewDoc.clients)}</p>
                  {previewDoc.contractor_nip && <p className="text-xs text-muted-foreground">NIP: {previewDoc.contractor_nip}</p>}
                </div>
                {(previewDoc.buyer_name || previewDoc.buyer_nip) && (
                  <div>
                    <p className="text-muted-foreground">Nabywca</p>
                    <p className="font-medium">{previewDoc.buyer_name || "—"}</p>
                    {previewDoc.buyer_nip && <p className="text-xs text-muted-foreground">NIP: {previewDoc.buyer_nip}</p>}
                  </div>
                )}
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
                          <TableCell className="text-xs text-center"><Badge variant="outline" className="text-xs">{(pi.item_type || pi.description) === "PRODUCT" ? "Produkt" : (pi.item_type || pi.description) === "INTERNAL_COST" ? "Koszt" : "Usługa"}</Badge></TableCell>
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

      {/* ── Form Dialog (Create / Edit) — Wide Professional Layout ── */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) resetForm(); else setFormOpen(true); }}>
        <DialogContent className="max-w-[95vw] w-[1280px] max-h-[95vh] overflow-hidden p-0">
          <div className="flex flex-col h-full max-h-[95vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">{editId ? "Edytuj dokument" : "Nowy dokument"}</h2>
                <Badge className={DOC_TYPE_COLORS[form.document_type]} variant="secondary">{DOC_TYPE_LABELS[form.document_type]}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select value={form.document_type} onValueChange={v => {
                  const cfg = TYPE_CONFIG[v] || TYPE_CONFIG.OTHER;
                  setForm({ ...form, document_type: v as DocType, direction: cfg.direction });
                }}>
                  <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map(k => (
                      <SelectItem key={k} value={k}>{DOC_TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Body: 2-column layout */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0">

                {/* LEFT: Main form content */}
                <div className="p-6 space-y-6 border-r border-border">

                  {/* Section: Document Number */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Numer dokumentu
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Numer zewnętrzny / wewnętrzny</Label>
                        <Input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} placeholder="np. FV/12/03/2026 lub puste = auto" className="h-10" />
                        <p className="text-[11px] text-muted-foreground">Pozostaw puste dla automatycznej numeracji</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Correction-specific */}
                  {form.document_type === "CORRECTION" && (
                    <>
                      <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10 p-5 space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "hsl(var(--warning))" }}>
                          <FileMinus2 className="h-4 w-4" />
                          Dane korekty
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Dokument korygowany</Label>
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
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Powód korekty</Label>
                            <Textarea value={form.correction_reason} onChange={e => setForm({ ...form, correction_reason: e.target.value })} rows={3} placeholder="Np. błąd w cenie, zwrot towaru..." />
                          </div>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Section: Contractor */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {typeConfig.contractorLabel}
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-end gap-3">
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{typeConfig.contractorLabel} z bazy</Label>
                          <SearchableSelect
                            options={clientOptions}
                            value={form.client_id}
                            onChange={onClientSelect}
                            placeholder={`Szukaj po nazwie, NIP, mieście...`}
                            onAddNew={() => setClientDialogOpen(true)}
                            addNewLabel={`+ Dodaj kontrahenta`}
                          />
                        </div>
                      </div>

                      {/* Contractor detail card */}
                      {selectedClient ? (
                        <div className="rounded-lg border-l-4 border-l-primary border border-border bg-muted/20 p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-base">{selectedClient.display_name || selectedClient.company_name || [selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(" ")}</p>
                                {selectedClient.nip && (
                                  <p className="text-sm text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                                    <Hash className="h-3 w-3" />NIP: {selectedClient.nip}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setForm({ ...form, client_id: "", contractor_name: "", contractor_nip: "" })}>
                              Zmień
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {getClientAddress(selectedClient) && (
                              <div className="flex items-start gap-2 text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span>{getClientAddress(selectedClient)}</span>
                              </div>
                            )}
                            {selectedClient.email && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                <span>{selectedClient.email}</span>
                              </div>
                            )}
                            {selectedClient.phone && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <PhoneIcon className="h-3.5 w-3.5 shrink-0" />
                                <span>{selectedClient.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Building2 className="h-6 w-6 opacity-40" />
                          <p className="text-sm">Wybierz kontrahenta z bazy lub wpisz dane ręcznie</p>
                        </div>
                      )}

                      {/* Manual override fields */}
                      {!selectedClient && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Nazwa kontrahenta</Label>
                            <Input value={form.contractor_name} onChange={e => setForm({ ...form, contractor_name: e.target.value })} className="h-10" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">NIP</Label>
                            <Input value={form.contractor_nip} onChange={e => setForm({ ...form, contractor_nip: e.target.value })} placeholder="000-000-00-00" className="h-10 font-mono" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section: Nabywca (Buyer) */}
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Nabywca
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Nazwa nabywcy</Label>
                        <Input value={form.buyer_name} onChange={e => setForm({ ...form, buyer_name: e.target.value })} placeholder="np. W3-Support" className="h-10" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">NIP nabywcy</Label>
                        <Input value={form.buyer_nip} onChange={e => setForm({ ...form, buyer_nip: e.target.value })} placeholder="000-000-00-00" className="h-10 font-mono" />
                      </div>
                    </div>
                    {companySettings && !form.buyer_name && (
                      <Button type="button" variant="link" size="sm" className="text-xs mt-1 h-auto p-0"
                        onClick={() => setForm({ ...form, buyer_name: companySettings.company_name || "", buyer_nip: companySettings.nip || "" })}>
                        Użyj: {companySettings.company_name}
                      </Button>
                    )}
                  </div>

                  <Separator />

                  {/* Section: Dates & Payment */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      Data i forma zapłaty
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{typeConfig.dateLabel} *</Label>
                        <Input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} className="h-10" />
                      </div>
                      {form.document_type !== "PROFORMA" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Data sprzedaży</Label>
                          <Input type="date" value={form.sale_date} onChange={e => setForm({ ...form, sale_date: e.target.value })} className="h-10" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{typeConfig.dueDateLabel}</Label>
                        <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="h-10" />
                      </div>
                      {form.document_type === "PURCHASE_INVOICE" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Data otrzymania</Label>
                          <Input type="date" value={form.received_date} onChange={e => setForm({ ...form, received_date: e.target.value })} className="h-10" />
                        </div>
                      )}
                    </div>
                    {/* Payment row */}
                    {typeConfig.showPayment && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Metoda płatności</Label>
                          <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                            <SelectTrigger className="h-10"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(k => (
                                <SelectItem key={k} value={k}>{PAYMENT_METHOD_LABELS[k]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Status płatności</Label>
                          <Select value={form.payment_status} onValueChange={v => onPaymentStatusChange(v as PaymentStatus)}>
                            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map(k => (
                                <SelectItem key={k} value={k}>{PAYMENT_STATUS_LABELS[k]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Kwota opłacona</Label>
                          <Input type="number" step="0.01" value={form.paid_amount}
                            onChange={e => setForm({ ...form, paid_amount: e.target.value })}
                            disabled={form.payment_status === "PAID" || form.payment_status === "UNPAID"}
                            className={`h-10 font-mono tabular-nums ${form.payment_status === "PAID" || form.payment_status === "UNPAID" ? "bg-muted" : ""}`}
                          />
                          {(() => {
                            const grossTotal = hasLineItems ? computedFromItems.gross : ((parseFloat(form.net_amount) || 0) * (1 + (parseFloat(form.vat_rate) || 23) / 100));
                            const paid = parseFloat(form.paid_amount) || 0;
                            const remaining = Math.max(0, grossTotal - paid);
                            return remaining > 0 ? (
                              <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">Pozostało: <span className="font-medium text-destructive">{formatCurrency(remaining)}</span></p>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Section: Line Items */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        {typeConfig.itemsLabel}
                        {hasLineItems && <Badge variant="secondary" className="text-xs ml-1">{lineItems.filter(i => i.name.trim()).length}</Badge>}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setLineItems([...lineItems, { ...emptyLineItem, item_type: "SERVICE" }])}>
                          <Plus className="h-3 w-3 mr-1" /> Usługa
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setLineItems([...lineItems, { ...emptyLineItem, item_type: "PRODUCT" }])}>
                          <Plus className="h-3 w-3 mr-1" /> Towar
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setLineItems([...lineItems, { ...emptyLineItem, item_type: "INTERNAL_COST" }])}>
                          <Plus className="h-3 w-3 mr-1" /> Koszt
                        </Button>
                      </div>
                    </div>
                    {/* Items header */}
                    <div className="hidden sm:grid grid-cols-[1fr_110px_70px_110px_65px_120px_36px] gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2 px-2 pb-2 border-b border-border">
                      <span>Nazwa pozycji</span>
                      <span>Typ</span>
                      <span className="text-center">Ilość</span>
                      <span className="text-right">Cena brutto</span>
                      <span className="text-center">VAT%</span>
                      <span className="text-right">Wartość brutto</span>
                      <span></span>
                    </div>
                    <div className="space-y-1">
                      {lineItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_70px_110px_65px_120px_36px] gap-2 items-center rounded-md border border-border/50 p-2 sm:p-1.5 sm:px-2 sm:border-0 hover:bg-muted/30 transition-colors">
                          <Input value={item.name} onChange={e => updateLineItem(idx, "name", e.target.value)} placeholder="Nazwa pozycji" className="h-9 text-sm" />
                          <Select value={item.item_type} onValueChange={v => updateLineItem(idx, "item_type", v)}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PRODUCT">Produkt mag.</SelectItem>
                              <SelectItem value="SERVICE">Usługa</SelectItem>
                              <SelectItem value="INTERNAL_COST">Koszt wewn.</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input type="number" min="0" step="1" value={item.quantity} placeholder="1" onChange={e => updateLineItem(idx, "quantity", e.target.value)} className="h-9 text-sm tabular-nums text-center" />
                          <Input type="number" step="0.01"
                            value={(() => { const net = parseFloat(item.unit_net) || 0; const vat = parseFloat(item.vat_rate) || 23; return net > 0 ? (net * (1 + vat / 100)).toFixed(2) : ""; })()}
                            onChange={e => { const gross = parseFloat(e.target.value) || 0; const vat = parseFloat(item.vat_rate) || 23; updateLineItem(idx, "unit_net", (gross / (1 + vat / 100)).toFixed(2)); }}
                            placeholder="0.00" className="h-9 text-sm tabular-nums text-right" />
                          <Input type="number" min="0" max="100" value={item.vat_rate} placeholder="23" onChange={e => updateLineItem(idx, "vat_rate", e.target.value)} className="h-9 text-sm tabular-nums text-center" />
                          <Input value={formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_net) || 0) * (1 + (parseFloat(item.vat_rate) || 23) / 100))} disabled className="h-9 text-sm bg-muted/50 tabular-nums font-medium text-right" />
                          {lineItems.length > 1 ? (
                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button>
                          ) : <div />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fallback manual entry */}
                  {!hasLineItems && (
                    <>
                      <Separator />
                      <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">Kwoty ręczne (jeśli brak pozycji)</p>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Brutto</Label>
                            <Input type="number" step="0.01" className="h-10 font-mono tabular-nums"
                              value={(() => { const net = parseFloat(form.net_amount) || 0; const vat = parseFloat(form.vat_rate) || 23; return net > 0 ? (net * (1 + vat / 100)).toFixed(2) : ""; })()}
                              onChange={e => { const gross = parseFloat(e.target.value) || 0; const vat = parseFloat(form.vat_rate) || 23; setForm({ ...form, net_amount: (gross / (1 + vat / 100)).toFixed(2) }); }}
                            />
                            <p className="text-[11px] text-muted-foreground tabular-nums">netto: {(parseFloat(form.net_amount) || 0).toFixed(2)} zł</p>
                          </div>
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Stawka VAT (%)</Label><Input type="number" value={form.vat_rate} onChange={e => setForm({ ...form, vat_rate: e.target.value })} className="h-10" /></div>
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Netto</Label><Input value={formatCurrency(parseFloat(form.net_amount) || 0)} disabled className="h-10 bg-muted font-mono" /></div>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* Section: Description & Notes */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Opis i notatki</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Opis</Label>
                        <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Krótki opis dokumentu" className="h-10" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Notatki wewnętrzne</Label>
                        <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Notatki widoczne tylko dla pracowników" />
                      </div>
                    </div>
                  </div>

                  {/* Section: Attachments */}
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        Załączniki
                      </h3>
                      <DocumentAttachments ref={attachmentsRef} documentId={editId} />
                    </div>
                  </>
                </div>

                {/* RIGHT: Summary Panel */}
                <div className="p-6 bg-muted/30 space-y-5 lg:sticky lg:top-0">
                  {/* Summary totals */}
                  <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Razem</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Netto</span>
                        <span className="font-mono tabular-nums font-medium text-base">{formatCurrency(hasLineItems ? computedFromItems.net : (parseFloat(form.net_amount) || 0))}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">VAT</span>
                        <span className="font-mono tabular-nums text-base">{formatCurrency(hasLineItems ? computedFromItems.vat : ((parseFloat(form.net_amount) || 0) * (parseFloat(form.vat_rate) || 23) / 100))}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">Brutto</span>
                        <span className="font-mono tabular-nums font-bold text-xl text-primary">{formatCurrency(hasLineItems ? computedFromItems.gross : ((parseFloat(form.net_amount) || 0) * (1 + (parseFloat(form.vat_rate) || 23) / 100)))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment status card */}
                  {typeConfig.showPayment && (
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-sm">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Płatność</h3>
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Status</span>
                          <Badge className={PAYMENT_STATUS_COLORS[form.payment_status as PaymentStatus]} variant="secondary">{PAYMENT_STATUS_LABELS[form.payment_status as PaymentStatus]}</Badge>
                        </div>
                        {form.payment_method && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Metoda</span>
                            <span className="text-sm font-medium">{PAYMENT_METHOD_LABELS[form.payment_method as PaymentMethod] || form.payment_method}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Zapłacono</span>
                          <span className="font-mono tabular-nums font-medium">{formatCurrency(parseFloat(form.paid_amount) || 0)}</span>
                        </div>
                        {(() => {
                          const grossTotal = hasLineItems ? computedFromItems.gross : ((parseFloat(form.net_amount) || 0) * (1 + (parseFloat(form.vat_rate) || 23) / 100));
                          const paid = parseFloat(form.paid_amount) || 0;
                          const remaining = Math.max(0, grossTotal - paid);
                          return remaining > 0 ? (
                            <div className="flex justify-between items-center rounded-md bg-destructive/10 px-3 py-2">
                              <span className="text-sm font-medium text-destructive">Pozostało</span>
                              <span className="font-mono tabular-nums font-bold text-destructive">{formatCurrency(remaining)}</span>
                            </div>
                          ) : grossTotal > 0 ? (
                            <div className="flex justify-between items-center rounded-md bg-primary/10 px-3 py-2">
                              <span className="text-sm font-medium text-primary">Opłacono w całości</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Items breakdown */}
                  {hasLineItems && (
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-sm">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                        Pozycje <span className="text-muted-foreground font-normal">({lineItems.filter(i => i.name.trim()).length})</span>
                      </h3>
                      <div className="space-y-1.5 text-xs max-h-[200px] overflow-y-auto">
                        {lineItems.filter(i => i.name.trim()).map((item, idx) => {
                          const gross = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_net) || 0) * (1 + (parseFloat(item.vat_rate) || 23) / 100);
                          return (
                            <div key={idx} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Badge variant="outline" className="text-[9px] shrink-0 px-1.5 py-0.5">
                                  {item.item_type === "PRODUCT" ? "MAG" : item.item_type === "INTERNAL_COST" ? "KOSZT" : "USŁ"}
                                </Badge>
                                <span className="truncate">{item.name}</span>
                              </div>
                              <span className="font-mono tabular-nums ml-2 shrink-0 font-medium">{formatCurrency(gross)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Direction info */}
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-sm">
                      {derivedDirection === "EXPENSE" ? (
                        <ArrowUpCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4 text-primary" />
                      )}
                      <span className="font-medium">{DIRECTION_LABELS[derivedDirection]}</span>
                      <span className="text-muted-foreground text-xs">(auto)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card">
              <p className="text-xs text-muted-foreground">
                {hasLineItems ? `${lineItems.filter(i => i.name.trim()).length} pozycji` : "Brak pozycji"}
                {form.document_number && ` · ${form.document_number}`}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={resetForm} className="h-10 px-6">Anuluj</Button>
                <Button onClick={() => saveMutation.mutate(form)} disabled={!form.issue_date || (!hasLineItems && !form.net_amount) || saveMutation.isPending} className="h-10 px-8">
                  {saveMutation.isPending ? "Zapisywanie..." : editId ? "Zapisz zmiany" : "Dodaj dokument"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ClientFormDialog
        externalOpen={clientDialogOpen}
        onOpenChange={(v) => { setClientDialogOpen(v); if (!v) setClientInitialData(null); }}
        initialData={clientInitialData}
        onCreated={(clientId) => {
          qc.invalidateQueries({ queryKey: ["clients-select-with-role"] });
          setClientInitialData(null);
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

      {/* OCR Import Dialog */}
      <OcrImportDialog open={ocrOpen} onOpenChange={setOcrOpen} onDataExtracted={handleOcrData} />
    </div>
  );
}
