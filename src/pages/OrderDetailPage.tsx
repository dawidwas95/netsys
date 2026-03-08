import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Send, Clock, User, Monitor, Plus, Trash2,
  DollarSign, TrendingUp, TrendingDown, Percent, FileDown, Printer,
  CheckCircle, AlertTriangle, Save, Archive, XCircle, PenLine, MessageSquare,
} from "lucide-react";
import { generateOrderPDF } from "@/lib/generateOrderPDF";
import { generateIntakePDF, generatePickupPDF } from "@/lib/pdfProtocols";
import { sendOrderNotification } from "@/lib/notifications";
import { toast } from "sonner";
import SignatureCanvas from "@/components/SignatureCanvas";
import OrderQRCode from "@/components/OrderQRCode";
import { useState, useMemo, useCallback } from "react";
import {
  ORDER_STATUS_LABELS, ORDER_PRIORITY_LABELS, SERVICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS, INTAKE_CHANNEL_LABELS, DEVICE_CATEGORY_LABELS,
  type OrderStatus, type OrderPriority, type IntakeChannel,
  type PaymentMethod, type DeviceCategory,
} from "@/types/database";
import { OrderStatusBadge } from "@/pages/DashboardPage";
import {
  FormSection, ClientSection, DeviceSection, OrderDataSection,
  DescriptionSection, DiagnosisSection, FinanceSection, PaymentSection,
} from "@/components/order/OrderFormSections";
import { OrderPhotoGallery } from "@/components/OrderPhotoGallery";
import { cn } from "@/lib/utils";
import { OrderItemsSection } from "@/components/order/OrderItemsSection";
import CustomerMessagesStaff from "@/components/CustomerMessagesStaff";
import { TechnicianAssignment } from "@/components/TechnicianAssignment";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

interface OrderItem {
  id: string;
  order_id: string;
  inventory_item_id: string | null;
  item_name_snapshot: string;
  quantity: number;
  sale_net: number;
  purchase_net: number;
  total_sale_net: number;
  total_purchase_net: number;
  created_at: string;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDirty, setEditDirty] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any> | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*, clients(display_name, phone, email, address_city, address_street, address_postal_code, company_name, first_name, last_name, nip), devices(manufacturer, model, serial_number, device_category, imei)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: myRoles = [] } = useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user?.id);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const isAdmin = myRoles.some((r: any) => r.role === "ADMIN" || r.role === "MANAGER");

  const { data: linkedStats } = useQuery({
    queryKey: ["order-linked-stats", id],
    queryFn: async () => {
      const [cashRes, docsRes] = await Promise.all([
        supabase.from("cash_transactions").select("id, transaction_type, amount, gross_amount", { count: "exact" }).eq("related_order_id", id!),
        supabase.from("documents").select("id", { count: "exact" }).eq("related_order_id", id!),
      ]);
      if (cashRes.error) throw cashRes.error;
      if (docsRes.error) throw docsRes.error;
      return {
        cashCount: cashRes.count ?? 0,
        docCount: docsRes.count ?? 0,
        cashRows: cashRes.data ?? [],
      };
    },
    enabled: !!id,
  });

  // Profiles for comment authors
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, first_name, last_name, email");
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p: any) => {
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
      map[p.user_id] = name || p.email || "Użytkownik";
    });
    return map;
  }, [profiles]);

  const currentForm = useMemo(() => {
    if (editForm) return editForm;
    if (!order) return {};
    return {
      client_id: order.client_id,
      device_id: order.device_id,
      service_type: order.service_type,
      priority: order.priority,
      intake_channel: order.intake_channel,
      estimated_completion_date: order.estimated_completion_date,
      problem_description: order.problem_description,
      client_description: order.client_description,
      accessories_received: order.accessories_received,
      visual_condition: order.visual_condition,
      lock_code: order.lock_code,
      internal_notes: order.internal_notes,
      status: order.status,
      diagnosis: order.diagnosis,
      repair_description: order.repair_description,
      labor_net: order.labor_net?.toString() ?? "",
      parts_net: order.parts_net?.toString() ?? "",
      extra_cost_net: order.extra_cost_net?.toString() ?? "",
      payment_method: order.payment_method ?? "",
      is_paid: order.is_paid,
      sales_document_type: order.sales_document_type ?? "NONE",
      sales_document_number: order.sales_document_number ?? "",
    };
  }, [order, editForm]);

  const handleFieldChange = useCallback((field: string, value: any) => {
    setEditForm((prev) => ({ ...(prev ?? currentForm), [field]: value }));
    setEditDirty(true);
  }, [currentForm]);

  const { data: orderItems = [] } = useQuery({
    queryKey: ["order-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_items")
        .select("*")
        .eq("order_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrderItem[];
    },
    enabled: !!id,
  });

  const { data: comments } = useQuery({
    queryKey: ["order-comments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_order_comments")
        .select("*")
        .eq("order_id", id!)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: logs } = useQuery({
    queryKey: ["order-logs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("entity_type", "service_order")
        .eq("entity_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const financials = useMemo(() => {
    const laborNet = parseFloat(currentForm.labor_net) || 0;
    const partsCost = parseFloat(currentForm.parts_net) || 0;
    const extraCost = parseFloat(currentForm.extra_cost_net) || 0;
    const itemsRevenue = orderItems.reduce((s, i) => s + i.total_sale_net, 0);
    const itemsCost = orderItems.reduce((s, i) => s + i.total_purchase_net, 0);
    const totalCost = partsCost + extraCost + itemsCost;
    const revenue = laborNet + itemsRevenue;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const vatRate = 0.23;
    const revenueGross = revenue * (1 + vatRate);
    const totalCostGross = totalCost * (1 + vatRate);
    const profitGross = revenueGross - totalCostGross;
    return { laborNet, partsCost, extraCost, totalCost, itemsRevenue, itemsCost, revenue, profit, margin, revenueGross, totalCostGross, profitGross };
  }, [currentForm, orderItems]);

  const updateOrder = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (updates.status === "COMPLETED" && order?.status !== "COMPLETED") {
        updates.completed_at = new Date().toISOString();
      }
      const laborNet = parseFloat(updates.labor_net ?? currentForm.labor_net ?? 0) || 0;
      const itemsRevenue = orderItems.reduce((s, i) => s + i.total_sale_net, 0);
      const revenue = laborNet + itemsRevenue;
      updates.total_net = revenue;
      updates.total_gross = revenue * 1.23;
      updates.labor_net = parseFloat(updates.labor_net) || 0;
      updates.parts_net = parseFloat(updates.parts_net) || 0;
      updates.extra_cost_net = parseFloat(updates.extra_cost_net) || 0;
      if (updates.is_paid && !order?.paid_at) {
        updates.paid_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("service_orders")
        .update({ ...updates, updated_by: user?.id })
        .eq("id", id!);
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        entity_type: "service_order", entity_id: id!, action_type: updates.status !== order?.status ? "STATUS_CHANGE" : "UPDATE",
        new_value_json: updates, user_id: user?.id,
        // @ts-ignore
        entity_name: order?.order_number || "",
        description: updates.status !== order?.status
          ? `Zmiana statusu: ${order?.status} → ${updates.status}`
          : "Edycja zlecenia",
      });
      const shouldCreateCash = updates.status === "COMPLETED" || (updates.is_paid && order?.status === "COMPLETED");
      if (shouldCreateCash) {
        const merged = { ...order, ...updates };
        if (merged.payment_method === "CASH" && merged.is_paid && revenue > 0) {
          const { data: existing } = await supabase
            .from("cash_transactions").select("id")
            .eq("related_order_id", id!).eq("source_type", "SERVICE_ORDER").limit(1);
          const grossRevenue = revenue * 1.23;
          const vatAmount = revenue * 0.23;
          if (!existing?.length) {
            await supabase.from("cash_transactions").insert({
              transaction_type: "IN" as any, source_type: "SERVICE_ORDER" as any,
              related_order_id: id!, amount: grossRevenue, gross_amount: grossRevenue,
              vat_amount: vatAmount, payment_method: "CASH",
              description: `Zlecenie ${order?.order_number} — płatność gotówką`,
              transaction_date: new Date().toISOString().split("T")[0], user_id: user?.id,
            });
          }
        }
      }
    },
    onSuccess: (_, updates) => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["order-logs", id] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      setEditForm(null);
      setEditDirty(false);
      toast.success("Zlecenie zaktualizowane");

      // Send notification if status changed to READY_FOR_RETURN or COMPLETED
      const newStatus = updates.status;
      if (
        newStatus &&
        (newStatus === "READY_FOR_RETURN" || newStatus === "COMPLETED") &&
        order?.status !== newStatus
      ) {
        const deviceName = order?.devices
          ? `${order.devices.manufacturer ?? ""} ${order.devices.model ?? ""}`.trim()
          : undefined;
        sendOrderNotification({
          orderId: id!,
          orderNumber: order?.order_number ?? "",
          clientId: order?.client_id ?? "",
          clientEmail: (order?.clients as any)?.email,
          clientName: (order?.clients as any)?.display_name,
          deviceName,
          eventType: newStatus as "READY_FOR_RETURN" | "COMPLETED",
        }).then((result) => {
          if (result?.success) {
            toast.success("Powiadomienie wysłane do klienta");
          }
        }).catch(() => {
          // Notification failure is non-blocking
        });
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const safeDeleteOrder = useMutation({
    mutationFn: async () => {
      const hasFinancialLinks = (linkedStats?.cashCount ?? 0) > 0 || (linkedStats?.docCount ?? 0) > 0;

      if (hasFinancialLinks) {
        // create reversing cash corrections for linked service-order cash entries
        const serviceOrderCash = (linkedStats?.cashRows ?? []).filter((r: any) => r);
        for (const t of serviceOrderCash) {
          const baseAmount = Number(t.gross_amount || t.amount || 0);
          if (baseAmount <= 0) continue;
          await supabase.from("cash_transactions").insert({
            transaction_type: t.transaction_type === "IN" ? "OUT" : "IN",
            source_type: "CORRECTION",
            related_order_id: id,
            amount: baseAmount,
            gross_amount: baseAmount,
            vat_amount: 0,
            payment_method: "CASH",
            description: `Korekta do zlecenia ${order?.order_number}`,
            transaction_date: new Date().toISOString().split("T")[0],
            user_id: user?.id,
          });
        }

        // linked records exist -> safe cancellation/archive instead of delete
        const { error: updError } = await supabase
          .from("service_orders")
          .update({
            status: "CANCELLED",
            is_archived: true,
            is_paid: false,
            paid_at: null,
            archive_reason: "Anulowane automatycznie (powiązania finansowe)",
            updated_by: user?.id,
          })
          .eq("id", id!);
        if (updError) throw updError;
        return "cancelled";
      }

      // no links -> admin can soft-delete, others cancel+archive
      if (!isAdmin) {
        const { error: cancelError } = await supabase
          .from("service_orders")
          .update({ status: "CANCELLED", is_archived: true, archive_reason: "Anulowane przez użytkownika", updated_by: user?.id })
          .eq("id", id!);
        if (cancelError) throw cancelError;
        return "cancelled";
      }

      const { error } = await supabase
        .from("service_orders")
        .update({ deleted_at: new Date().toISOString(), updated_by: user?.id })
        .eq("id", id!);
      if (error) throw error;
      return "deleted";
    },
    onSuccess: (mode) => {
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      if (mode === "deleted") toast.success("Zlecenie usunięte");
      else toast.success("Zlecenie anulowane i zarchiwizowane (bezpieczny tryb)");
      navigate("/orders");
    },
    onError: (err: any) => toast.error(err?.message || "Błąd operacji"),
  });

  const safeCancelOrder = useMutation({
    mutationFn: async () => {
      const serviceOrderCash = (linkedStats?.cashRows ?? []).filter((r: any) => r);
      for (const t of serviceOrderCash) {
        const baseAmount = Number(t.gross_amount || t.amount || 0);
        if (baseAmount <= 0) continue;
        await supabase.from("cash_transactions").insert({
          transaction_type: t.transaction_type === "IN" ? "OUT" : "IN",
          source_type: "CORRECTION",
          related_order_id: id,
          amount: baseAmount,
          gross_amount: baseAmount,
          vat_amount: 0,
          payment_method: "CASH",
          description: `Korekta anulowanego zlecenia ${order?.order_number}`,
          transaction_date: new Date().toISOString().split("T")[0],
          user_id: user?.id,
        });
      }

      const { error } = await supabase
        .from("service_orders")
        .update({
          status: "CANCELLED",
          is_archived: true,
          is_paid: false,
          paid_at: null,
          archive_reason: "Anulowane ręcznie",
          updated_by: user?.id,
        })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      toast.success("Zlecenie anulowane z korektą finansową");
      setCancelDialogOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Nie udało się anulować zlecenia"),
  });

  function handleSave() { if (!editForm) return; updateOrder.mutate(editForm); }

  function handleCloseAndSettle() {
    if (!order) return;
    const errors: string[] = [];
    if (financials.revenue <= 0) errors.push("Brak ceny usługi lub pozycji");
    if (!currentForm.payment_method) errors.push("Nie wybrano formy płatności");
    if (errors.length > 0) { toast.error(`Nie można zamknąć zlecenia:\n${errors.join("\n")}`); return; }
    updateOrder.mutate({
      ...currentForm, status: "COMPLETED", is_paid: true,
      paid_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    });
    setCloseDialogOpen(false);
  }

  function handleItemsChanged() {
    queryClient.invalidateQueries({ queryKey: ["order-items", id] });
    queryClient.invalidateQueries({ queryKey: ["order", id] });
  }

  const addComment = useMutation({
    mutationFn: async () => {
      if (!comment.trim()) return;
      const { error } = await supabase.from("service_order_comments").insert({
        order_id: id!, user_id: user?.id, comment: comment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-comments", id] });
      setComment("");
      toast.success("Komentarz dodany");
    },
    onError: (err: any) => toast.error(err.message),
  });

  async function uploadSignature(dataUrl: string, type: "client" | "technician"): Promise<string> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const fileName = `${order!.id}/${type}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("signatures").upload(fileName, blob, { contentType: "image/png", upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("signatures").getPublicUrl(fileName);
    return urlData.publicUrl;
  }

  async function handleSaveSignature(dataUrl: string, type: "client" | "technician") {
    if (!order) return;
    try {
      const url = await uploadSignature(dataUrl, type);
      const update = type === "client"
        ? { client_signature_url: url, client_signed_at: new Date().toISOString() }
        : { technician_signature_url: url, technician_signed_at: new Date().toISOString() };
      const { error } = await supabase.from("service_orders").update(update).eq("id", order.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success(`Podpis ${type === "client" ? "klienta" : "serwisanta"} zapisany`);
    } catch (err: any) {
      toast.error("Błąd zapisu podpisu: " + err.message);
    }
  }

  async function handleClearSignature(type: "client" | "technician") {
    if (!order) return;
    const update = type === "client"
      ? { client_signature_url: null, client_signed_at: null }
      : { technician_signature_url: null, technician_signed_at: null };
    const { error } = await supabase.from("service_orders").update(update).eq("id", order.id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["order", id] });
    toast.success("Podpis usunięty");
  }

  async function handleDownloadPDF() {
    if (!order) return;
    const doc = await generateOrderPDF({ order, orderItems, financials });
    doc.save(`${order.order_number.replace(/\//g, "-")}.pdf`);
    toast.success("PDF pobrany");
  }

  async function handlePrintPDF() {
    if (!order) return;
    const doc = await generateOrderPDF({ order, orderItems, financials });
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url);
    win?.addEventListener("load", () => win.print());
  }

  async function handleIntakePDF() {
    if (!order) return;
    const doc = await generateIntakePDF({ order });
    doc.save(`Przyjęcie-${order.order_number.replace(/\//g, "-")}.pdf`);
    toast.success("Protokół przyjęcia pobrany");
  }

  async function handlePickupPDF() {
    if (!order) return;
    const doc = await generatePickupPDF({ order, orderItems, financials });
    doc.save(`Odbiór-${order.order_number.replace(/\//g, "-")}.pdf`);
    toast.success("Protokół odbioru pobrany");
  }

  if (isLoading) return <p className="text-muted-foreground p-4">Ładowanie...</p>;
  if (!order) return <p className="text-muted-foreground p-4">Zlecenie nie znalezione</p>;

  const isCompleted = order.status === "COMPLETED" || order.status === "ARCHIVED" || order.status === "CANCELLED";

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/orders" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">{order.order_number}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <OrderStatusBadge status={order.status as OrderStatus} />
              <Badge variant="outline">{SERVICE_TYPE_LABELS[order.service_type as keyof typeof SERVICE_TYPE_LABELS]}</Badge>
              <Badge variant="outline">{ORDER_PRIORITY_LABELS[order.priority as OrderPriority]}</Badge>
              {order.is_paid && <Badge className="bg-primary/10 text-primary border-primary/20">Opłacone</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {editDirty && (
            <Button size="sm" onClick={handleSave} disabled={updateOrder.isPending}>
              <Save className="mr-1 h-4 w-4" /> {updateOrder.isPending ? "Zapis..." : "Zapisz zmiany"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <FileDown className="mr-1 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintPDF}>
            <Printer className="mr-1 h-4 w-4" /> Drukuj
          </Button>
          {!isCompleted && (
            <>
              <Button variant="outline" size="sm" onClick={() => setCancelDialogOpen(true)}>
                <XCircle className="mr-1 h-4 w-4" /> Anuluj
              </Button>
              <Button variant="outline" size="sm" onClick={() => setArchiveDialogOpen(true)}>
                <Archive className="mr-1 h-4 w-4" /> Archiwizuj
              </Button>
              <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><CheckCircle className="mr-1 h-4 w-4" /> Zakończ i rozlicz</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Zakończ i rozlicz zlecenie</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span>Przychód brutto:</span><span className="font-mono font-medium">{formatCurrency(financials.revenueGross)}</span></div>
                      <div className="flex justify-between"><span>Koszty brutto:</span><span className="font-mono font-medium">{formatCurrency(financials.totalCostGross)}</span></div>
                      <div className="flex justify-between border-t border-border pt-2"><span className="font-medium">Zysk brutto:</span><span className={cn("font-mono font-medium", financials.profitGross >= 0 ? "text-primary" : "text-destructive")}>{formatCurrency(financials.profitGross)}</span></div>
                      <div className="flex justify-between"><span>Forma płatności:</span><span>{currentForm.payment_method ? PAYMENT_METHOD_LABELS[currentForm.payment_method as PaymentMethod] : <span className="text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Nie wybrano!</span>}</span></div>
                    </div>
                    {financials.revenue <= 0 && (
                      <div className="text-sm text-destructive flex items-center gap-2 p-2 rounded bg-destructive/10">
                        <AlertTriangle className="h-4 w-4" /> Brak kwoty (ustaw cenę usługi lub dodaj pozycje)
                      </div>
                    )}
                    {currentForm.payment_method === "CASH" && financials.revenue > 0 && (
                      <div className="text-sm text-primary flex items-center gap-2 p-2 rounded bg-primary/10">
                        <DollarSign className="h-4 w-4" /> Kwota {formatCurrency(financials.revenueGross)} trafi do kasy gotówkowej
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Anuluj</Button>
                      <Button onClick={handleCloseAndSettle} disabled={financials.revenue <= 0 || !currentForm.payment_method || updateOrder.isPending}>
                        {updateOrder.isPending ? "Zapisywanie..." : "Potwierdź zamknięcie"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Usuń
          </Button>
        </div>
      </div>

      {/* Archive confirmation */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiwizować zlecenie?</AlertDialogTitle>
            <AlertDialogDescription>
              Zlecenie {order.order_number} zostanie przeniesione do archiwum. Można je później przywrócić.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              updateOrder.mutate({ status: "ARCHIVED", is_archived: true, archive_reason: "Zarchiwizowane ręcznie" });
              setArchiveDialogOpen(false);
            }}>
              Archiwizuj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anulować zlecenie?</AlertDialogTitle>
            <AlertDialogDescription>
              Zlecenie {order.order_number} zostanie oznaczone jako anulowane.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nie</AlertDialogCancel>
            <AlertDialogAction onClick={() => safeCancelOrder.mutate()}>
              {safeCancelOrder.isPending ? "Anulowanie..." : "Anuluj zlecenie"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{(linkedStats?.cashCount ?? 0) > 0 || (linkedStats?.docCount ?? 0) > 0 ? "Usunąć / anulować zlecenie?" : "Usunąć zlecenie?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {(linkedStats?.cashCount ?? 0) > 0 || (linkedStats?.docCount ?? 0) > 0
                ? `Wykryto powiązania finansowe (kasa: ${linkedStats?.cashCount ?? 0}, dokumenty: ${linkedStats?.docCount ?? 0}). System wykona bezpieczne anulowanie, archiwizację i korekty finansowe.`
                : isAdmin
                  ? "Brak powiązań finansowych — zlecenie może zostać usunięte."
                  : "Brak uprawnień do trwałego usunięcia. Zlecenie zostanie anulowane i zarchiwizowane."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => safeDeleteOrder.mutate()}>
              {safeDeleteOrder.isPending ? "Przetwarzanie..." : ((linkedStats?.cashCount ?? 0) > 0 || (linkedStats?.docCount ?? 0) > 0 || !isAdmin) ? "Anuluj bezpiecznie" : "Usuń trwale"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          <Tabs defaultValue="edit">
            <TabsList className="flex-wrap">
              <TabsTrigger value="edit">Edycja</TabsTrigger>
              <TabsTrigger value="photos">Zdjęcia</TabsTrigger>
              <TabsTrigger value="comments">Komentarze ({comments?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="customer-messages">
                <MessageSquare className="mr-1 h-3 w-3" />Wiadomości klienta
              </TabsTrigger>
              <TabsTrigger value="history">Historia</TabsTrigger>
              <TabsTrigger value="documents">Dokumenty</TabsTrigger>
              <TabsTrigger value="signatures"><PenLine className="mr-1 h-3 w-3" />Podpisy</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="mt-4 space-y-5">
              <ClientSection clientId={currentForm.client_id} onChange={(v) => { handleFieldChange("client_id", v); handleFieldChange("device_id", undefined); }} />
              <DeviceSection clientId={currentForm.client_id} deviceId={currentForm.device_id} onChange={(v) => handleFieldChange("device_id", v)} />
              <OrderDataSection formData={currentForm} onChange={handleFieldChange} />
              <DescriptionSection formData={currentForm} onChange={handleFieldChange} />
              <DiagnosisSection
                formData={currentForm}
                onChange={handleFieldChange}
                onStatusChange={(v) => {
                  handleFieldChange("status", v);
                  updateOrder.mutate({ status: v });
                }}
              />
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Zdjęcia urządzenia</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderPhotoGallery orderId={id!} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comments" className="mt-4">
              <Card>
                <CardContent className="pt-4 space-y-4">
                  {comments?.map((c: any) => (
                    <div key={c.id} className="border-b border-border pb-3 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {(profileMap[c.user_id] || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium">{profileMap[c.user_id] || "Użytkownik"}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(c.created_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            {" "}
                            {new Date(c.created_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm ml-9">{c.comment}</p>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Textarea placeholder="Dodaj komentarz..." value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="flex-1" />
                    <Button size="icon" onClick={() => addComment.mutate()} disabled={!comment.trim() || addComment.isPending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="customer-messages" className="mt-4">
              <CustomerMessagesStaff orderId={id!} />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardContent className="pt-4">
                  {!logs?.length ? (
                    <p className="text-sm text-muted-foreground">Brak historii</p>
                  ) : (
                    <div className="space-y-3">
                      {logs.map((log: any) => (
                        <div key={log.id} className="flex items-start gap-3 text-sm border-b border-border pb-3 last:border-0">
                          <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <div className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pl-PL")}</div>
                            <Badge variant="outline" className="text-xs mt-0.5">{log.action_type}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Zlecenie serwisowe</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleDownloadPDF}><FileDown className="mr-1 h-4 w-4" /> Pobierz PDF</Button>
                      <Button variant="outline" size="sm" onClick={handlePrintPDF}><Printer className="mr-1 h-4 w-4" /> Drukuj</Button>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">Protokoły</p>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={handleIntakePDF}><FileDown className="mr-1 h-4 w-4" /> Przyjęcie sprzętu</Button>
                      <Button variant="outline" size="sm" onClick={handlePickupPDF}><FileDown className="mr-1 h-4 w-4" /> Odbiór sprzętu</Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">PDF generowany na żywo z aktualnych danych zlecenia. Zawiera kod QR.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signatures" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SignatureCanvas
                  title="Podpis klienta"
                  existingUrl={order?.client_signature_url}
                  signedAt={order?.client_signed_at}
                  onSave={(dataUrl) => handleSaveSignature(dataUrl, "client")}
                  onClear={() => handleClearSignature("client")}
                />
                <SignatureCanvas
                  title="Podpis serwisanta"
                  existingUrl={order?.technician_signature_url}
                  signedAt={order?.technician_signed_at}
                  onSave={(dataUrl) => handleSaveSignature(dataUrl, "technician")}
                  onClear={() => handleClearSignature("technician")}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">Podpisy cyfrowe są automatycznie dołączane do generowanych dokumentów PDF.</p>
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <OrderQRCode
            orderId={order.id}
            orderNumber={order.order_number}
            clientName={(order.clients as any)?.display_name}
            deviceName={order.devices ? `${(order.devices as any).manufacturer || ""} ${(order.devices as any).model || ""}`.trim() || null : null}
            statusToken={(order as any).status_token}
          />
          <FinanceSection formData={currentForm} onChange={handleFieldChange} orderItems={orderItems} />
          <PaymentSection formData={currentForm} onChange={handleFieldChange} />

          {/* Order Items - New Component */}
          <OrderItemsSection
            orderId={id!}
            orderItems={orderItems}
            isCompleted={isCompleted}
            onItemsChanged={handleItemsChanged}
          />

          {editDirty && (
            <Button className="w-full" onClick={handleSave} disabled={updateOrder.isPending}>
              <Save className="mr-1 h-4 w-4" /> {updateOrder.isPending ? "Zapisywanie..." : "Zapisz wszystkie zmiany"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
