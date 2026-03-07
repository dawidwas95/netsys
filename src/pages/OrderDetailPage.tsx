import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  ArrowLeft, Send, Clock, User, Monitor, Plus, Trash2,
  DollarSign, TrendingUp, TrendingDown, Percent, FileDown, Printer,
} from "lucide-react";
import { generateOrderPDF } from "@/lib/generateOrderPDF";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  ORDER_STATUS_LABELS,
  ORDER_PRIORITY_LABELS,
  SERVICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  INTAKE_CHANNEL_LABELS,
  type OrderStatus,
  type OrderPriority,
  type IntakeChannel,
  type PaymentMethod,
} from "@/types/database";
import { OrderStatusBadge } from "@/pages/DashboardPage";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", quantity: "1", sale_net: "", purchase_net: "" });

  // Financial edit state
  const [editingFinance, setEditingFinance] = useState(false);
  const [financeForm, setFinanceForm] = useState({
    labor_net: "",
    parts_net: "",
    extra_cost_net: "",
    payment_method: "" as string,
    is_paid: false,
  });

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*, clients(display_name, phone, email), devices(manufacturer, model, serial_number, device_category, imei)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

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

  // === Financial calculations ===
  const financials = useMemo(() => {
    if (!order) return { laborNet: 0, partsCost: 0, extraCost: 0, totalCost: 0, itemsRevenue: 0, itemsCost: 0, revenue: 0, profit: 0, margin: 0 };

    const laborNet = Number(order.labor_net || 0);
    const partsCost = Number(order.parts_net || 0);
    const extraCost = Number(order.extra_cost_net || 0);

    const itemsRevenue = orderItems.reduce((s, i) => s + i.total_sale_net, 0);
    const itemsCost = orderItems.reduce((s, i) => s + i.total_purchase_net, 0);

    const totalCost = partsCost + extraCost + itemsCost;
    const revenue = laborNet + itemsRevenue;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return { laborNet, partsCost, extraCost, totalCost, itemsRevenue, itemsCost, revenue, profit, margin };
  }, [order, orderItems]);

  // === Mutations ===
  const updateOrder = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (updates.status === "COMPLETED") {
        updates.completed_at = new Date().toISOString();
      }

      // Recalculate totals before saving
      const laborNet = Number(updates.labor_net ?? order?.labor_net ?? 0);
      const partsCost = Number(updates.parts_net ?? order?.parts_net ?? 0);
      const extraCost = Number(updates.extra_cost_net ?? order?.extra_cost_net ?? 0);
      const itemsRevenue = orderItems.reduce((s, i) => s + i.total_sale_net, 0);
      const itemsCost = orderItems.reduce((s, i) => s + i.total_purchase_net, 0);
      const revenue = laborNet + itemsRevenue;
      const totalCost = partsCost + extraCost + itemsCost;

      updates.total_net = revenue;
      updates.total_gross = revenue * 1.23; // VAT 23%

      const { error } = await supabase
        .from("service_orders")
        .update({ ...updates, updated_by: user?.id })
        .eq("id", id!);
      if (error) throw error;

      // Log activity
      await supabase.from("activity_logs").insert({
        entity_type: "service_order",
        entity_id: id!,
        action_type: "update",
        new_value_json: updates,
        user_id: user?.id,
      });

      // Auto cash entry on COMPLETED + CASH + is_paid
      if (updates.status === "COMPLETED") {
        const currentOrder = { ...order, ...updates };
        if (currentOrder.payment_method === "CASH" && currentOrder.is_paid && revenue > 0) {
          await supabase.from("cash_transactions").insert({
            transaction_type: "IN" as any,
            source_type: "SERVICE_ORDER" as any,
            related_order_id: id!,
            amount: revenue,
            description: `Zlecenie ${order?.order_number} — płatność gotówką`,
            transaction_date: new Date().toISOString().split("T")[0],
            user_id: user?.id,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["order-logs", id] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-order-stats"] });
      toast.success("Zlecenie zaktualizowane");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(newItem.quantity) || 1;
      const saleNet = parseFloat(newItem.sale_net) || 0;
      const purchaseNet = parseFloat(newItem.purchase_net) || 0;

      const { error } = await supabase.from("service_order_items").insert({
        order_id: id!,
        item_name_snapshot: newItem.name,
        quantity: qty,
        sale_net: saleNet,
        purchase_net: purchaseNet,
        total_sale_net: qty * saleNet,
        total_purchase_net: qty * purchaseNet,
        created_by: user?.id,
      });
      if (error) throw error;

      // Recalculate order totals
      const newItemsRevenue = financials.itemsRevenue + qty * saleNet;
      const newItemsCost = financials.itemsCost + qty * purchaseNet;
      const revenue = financials.laborNet + newItemsRevenue;
      const totalCost = financials.partsCost + financials.extraCost + newItemsCost;

      await supabase.from("service_orders").update({
        total_net: revenue,
        total_gross: revenue * 1.23,
        updated_by: user?.id,
      }).eq("id", id!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-items", id] });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      setNewItem({ name: "", quantity: "1", sale_net: "", purchase_net: "" });
      setItemDialogOpen(false);
      toast.success("Dodano pozycję");
    },
    onError: () => toast.error("Błąd dodawania pozycji"),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("service_order_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-items", id] });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Usunięto pozycję");
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!comment.trim()) return;
      const { error } = await supabase.from("service_order_comments").insert({
        order_id: id!,
        user_id: user?.id,
        comment: comment.trim(),
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

  function startEditFinance() {
    if (!order) return;
    setFinanceForm({
      labor_net: (order.labor_net ?? 0).toString(),
      parts_net: (order.parts_net ?? 0).toString(),
      extra_cost_net: (order.extra_cost_net ?? 0).toString(),
      payment_method: order.payment_method ?? "",
      is_paid: order.is_paid,
    });
    setEditingFinance(true);
  }

  function saveFinance() {
    const updates: Record<string, any> = {
      labor_net: parseFloat(financeForm.labor_net) || 0,
      parts_net: parseFloat(financeForm.parts_net) || 0,
      extra_cost_net: parseFloat(financeForm.extra_cost_net) || 0,
      payment_method: financeForm.payment_method || null,
      is_paid: financeForm.is_paid,
    };
    if (financeForm.is_paid && !order?.paid_at) {
      updates.paid_at = new Date().toISOString();
    }
    updateOrder.mutate(updates);
    setEditingFinance(false);
  }

  function handleDownloadPDF() {
    if (!order) return;
    const doc = generateOrderPDF({ order, orderItems, financials });
    doc.save(`${order.order_number.replace(/\//g, "-")}.pdf`);
    toast.success("PDF pobrany");
  }

  function handlePrintPDF() {
    if (!order) return;
    const doc = generateOrderPDF({ order, orderItems, financials });
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url);
    win?.addEventListener("load", () => win.print());
  }

  if (isLoading) return <p className="text-muted-foreground p-4">Ładowanie...</p>;
  if (!order) return <p className="text-muted-foreground p-4">Zlecenie nie znalezione</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/orders" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">{order.order_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <OrderStatusBadge status={order.status as OrderStatus} />
              <Badge variant="outline">{SERVICE_TYPE_LABELS[order.service_type as keyof typeof SERVICE_TYPE_LABELS]}</Badge>
              <Badge variant="outline">{ORDER_PRIORITY_LABELS[order.priority as OrderPriority]}</Badge>
              {order.is_paid && <Badge className="bg-primary/10 text-primary">Opłacone</Badge>}
            </div>
          </div>
        </div>
        <Select
          value={order.status}
          onValueChange={(v) => {
            const updates: any = { status: v };
            if (v === "COMPLETED") updates.completed_at = new Date().toISOString();
            updateOrder.mutate(updates);
          }}
        >
          <SelectTrigger className="w-48"><SelectValue placeholder="Zmień status" /></SelectTrigger>
          <SelectContent>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Klient</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-medium">{(order as any).clients?.display_name}</div>
            {(order as any).clients?.phone && <div className="text-muted-foreground">{(order as any).clients.phone}</div>}
            {(order as any).clients?.email && <div className="text-muted-foreground">{(order as any).clients.email}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Urządzenie</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {(order as any).devices ? (
              <>
                <div className="font-medium flex items-center gap-1">
                  <Monitor className="h-4 w-4" />
                  {(order as any).devices.manufacturer} {(order as any).devices.model}
                </div>
                {(order as any).devices.serial_number && (
                  <div className="font-mono text-muted-foreground">S/N: {(order as any).devices.serial_number}</div>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Nie przypisano</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Informacje</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Przyjęto: {new Date(order.received_at).toLocaleDateString("pl-PL")}</div>
            {order.intake_channel && <div>Kanał: {INTAKE_CHANNEL_LABELS[order.intake_channel as IntakeChannel]}</div>}
            {order.payment_method && <div>Płatność: {PAYMENT_METHOD_LABELS[order.payment_method as PaymentMethod]}</div>}
          </CardContent>
        </Card>
      </div>

      {/* ========== FINANCIAL SECTION ========== */}
      <Card className="border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Sekcja finansowa
          </CardTitle>
          {!editingFinance && (
            <Button variant="outline" size="sm" onClick={startEditFinance}>Edytuj</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border border-border p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Przychód</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(financials.revenue)}</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <TrendingDown className="h-4 w-4 mx-auto mb-1 text-destructive" />
              <p className="text-xs text-muted-foreground">Koszt całkowity</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(financials.totalCost)}</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <DollarSign className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Zysk</p>
              <p className={`text-lg font-bold ${financials.profit >= 0 ? "text-primary" : "text-destructive"}`}>
                {formatCurrency(financials.profit)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <Percent className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Marża</p>
              <p className={`text-lg font-bold ${financials.margin >= 0 ? "text-primary" : "text-destructive"}`}>
                {financials.margin.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Finance edit form */}
          {editingFinance ? (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Cena naprawy / usługi (netto)</Label>
                  <Input
                    type="number" step="0.01"
                    value={financeForm.labor_net}
                    onChange={(e) => setFinanceForm({ ...financeForm, labor_net: e.target.value })}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Kwota sprzedaży dla klienta</p>
                </div>
                <div>
                  <Label>Koszt części (netto)</Label>
                  <Input
                    type="number" step="0.01"
                    value={financeForm.parts_net}
                    onChange={(e) => setFinanceForm({ ...financeForm, parts_net: e.target.value })}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Twój koszt zakupu części</p>
                </div>
                <div>
                  <Label>Koszt dodatkowy (netto)</Label>
                  <Input
                    type="number" step="0.01"
                    value={financeForm.extra_cost_net}
                    onChange={(e) => setFinanceForm({ ...financeForm, extra_cost_net: e.target.value })}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Inne koszty własne</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Metoda płatności</Label>
                  <Select value={financeForm.payment_method} onValueChange={(v) => setFinanceForm({ ...financeForm, payment_method: v })}>
                    <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
                        <SelectItem key={k} value={k}>{PAYMENT_METHOD_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={financeForm.is_paid}
                      onCheckedChange={(v) => setFinanceForm({ ...financeForm, is_paid: !!v })}
                    />
                    <span className="text-sm font-medium">Opłacone</span>
                  </label>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <p className="font-medium text-muted-foreground">Podgląd:</p>
                <div className="grid grid-cols-4 gap-2">
                  <div>Cena usługi: <span className="font-mono font-medium">{formatCurrency(parseFloat(financeForm.labor_net) || 0)}</span></div>
                  <div>Koszt części: <span className="font-mono font-medium">{formatCurrency(parseFloat(financeForm.parts_net) || 0)}</span></div>
                  <div>Koszt dodatkowy: <span className="font-mono font-medium">{formatCurrency(parseFloat(financeForm.extra_cost_net) || 0)}</span></div>
                  <div>
                    Zysk z usługi:{" "}
                    <span className={`font-mono font-medium ${(parseFloat(financeForm.labor_net) || 0) - (parseFloat(financeForm.parts_net) || 0) - (parseFloat(financeForm.extra_cost_net) || 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                      {formatCurrency((parseFloat(financeForm.labor_net) || 0) - (parseFloat(financeForm.parts_net) || 0) - (parseFloat(financeForm.extra_cost_net) || 0))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingFinance(false)}>Anuluj</Button>
                <Button onClick={saveFinance} disabled={updateOrder.isPending}>Zapisz finanse</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <p className="font-medium text-muted-foreground">Przychody</p>
                <div className="flex justify-between"><span>Cena usługi:</span><span className="font-mono">{formatCurrency(financials.laborNet)}</span></div>
                <div className="flex justify-between"><span>Sprzedane pozycje:</span><span className="font-mono">{formatCurrency(financials.itemsRevenue)}</span></div>
                <div className="flex justify-between border-t border-border pt-1 font-medium"><span>Razem przychód:</span><span className="font-mono">{formatCurrency(financials.revenue)}</span></div>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-muted-foreground">Koszty</p>
                <div className="flex justify-between"><span>Koszt części:</span><span className="font-mono">{formatCurrency(financials.partsCost)}</span></div>
                <div className="flex justify-between"><span>Koszt dodatkowy:</span><span className="font-mono">{formatCurrency(financials.extraCost)}</span></div>
                <div className="flex justify-between"><span>Koszty pozycji:</span><span className="font-mono">{formatCurrency(financials.itemsCost)}</span></div>
                <div className="flex justify-between border-t border-border pt-1 font-medium"><span>Razem koszty:</span><span className="font-mono">{formatCurrency(financials.totalCost)}</span></div>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-muted-foreground">Wynik</p>
                <div className="flex justify-between font-medium"><span>Zysk:</span><span className={`font-mono ${financials.profit >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(financials.profit)}</span></div>
                <div className="flex justify-between font-medium"><span>Marża:</span><span className={`font-mono ${financials.margin >= 0 ? "text-primary" : "text-destructive"}`}>{financials.margin.toFixed(1)}%</span></div>
                <div className="flex justify-between"><span>Płatność:</span><span>{order.payment_method ? PAYMENT_METHOD_LABELS[order.payment_method as PaymentMethod] : "—"}</span></div>
                <div className="flex justify-between"><span>Status:</span><span>{order.is_paid ? "✅ Opłacone" : "⏳ Nieopłacone"}</span></div>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">Pozycje zlecenia (sprzedane części/produkty)</h3>
              <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><Plus className="mr-1 h-3 w-3" />Dodaj pozycję</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Dodaj pozycję</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nazwa pozycji *</Label>
                      <Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="np. Dysk SSD 256GB" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Ilość</Label>
                        <Input type="number" min="1" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} />
                      </div>
                      <div>
                        <Label>Cena sprzedaży (netto)</Label>
                        <Input type="number" step="0.01" value={newItem.sale_net} onChange={(e) => setNewItem({ ...newItem, sale_net: e.target.value })} placeholder="0.00" />
                      </div>
                      <div>
                        <Label>Cena zakupu (netto)</Label>
                        <Input type="number" step="0.01" value={newItem.purchase_net} onChange={(e) => setNewItem({ ...newItem, purchase_net: e.target.value })} placeholder="0.00" />
                      </div>
                    </div>
                    {(parseFloat(newItem.sale_net) > 0 || parseFloat(newItem.purchase_net) > 0) && (
                      <div className="rounded-lg bg-muted p-3 text-sm">
                        <div className="grid grid-cols-3 gap-2">
                          <div>Sprzedaż: <span className="font-mono font-medium">{formatCurrency((parseFloat(newItem.quantity) || 1) * (parseFloat(newItem.sale_net) || 0))}</span></div>
                          <div>Zakup: <span className="font-mono font-medium">{formatCurrency((parseFloat(newItem.quantity) || 1) * (parseFloat(newItem.purchase_net) || 0))}</span></div>
                          <div>Zysk: <span className={`font-mono font-medium ${((parseFloat(newItem.sale_net) || 0) - (parseFloat(newItem.purchase_net) || 0)) >= 0 ? "text-primary" : "text-destructive"}`}>
                            {formatCurrency((parseFloat(newItem.quantity) || 1) * ((parseFloat(newItem.sale_net) || 0) - (parseFloat(newItem.purchase_net) || 0)))}
                          </span></div>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Anuluj</Button>
                      <Button onClick={() => addItemMutation.mutate()} disabled={!newItem.name || addItemMutation.isPending}>Dodaj</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {orderItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazwa</TableHead>
                    <TableHead className="text-right">Ilość</TableHead>
                    <TableHead className="text-right">Cena sprzedaży</TableHead>
                    <TableHead className="text-right">Cena zakupu</TableHead>
                    <TableHead className="text-right">Sprzedaż ×</TableHead>
                    <TableHead className="text-right">Zakup ×</TableHead>
                    <TableHead className="text-right">Zysk</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item) => {
                    const itemProfit = item.total_sale_net - item.total_purchase_net;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_name_snapshot}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(item.sale_net)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(item.purchase_net)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(item.total_sale_net)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(item.total_purchase_net)}</TableCell>
                        <TableCell className={`text-right font-mono text-sm font-medium ${itemProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                          {formatCurrency(itemProfit)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItemMutation.mutate(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell colSpan={4}>Suma pozycji</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(financials.itemsRevenue)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(financials.itemsCost)}</TableCell>
                    <TableCell className={`text-right font-mono ${financials.itemsRevenue - financials.itemsCost >= 0 ? "text-primary" : "text-destructive"}`}>
                      {formatCurrency(financials.itemsRevenue - financials.itemsCost)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                Brak pozycji. Dodaj sprzedane części lub produkty.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Szczegóły</TabsTrigger>
          <TabsTrigger value="comments">Komentarze ({comments?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">Historia</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          {order.problem_description && (
            <Card><CardHeader><CardTitle className="text-sm">Opis problemu</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{order.problem_description}</CardContent></Card>
          )}
          {order.client_description && (
            <Card><CardHeader><CardTitle className="text-sm">Opis klienta</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{order.client_description}</CardContent></Card>
          )}
          {order.diagnosis && (
            <Card><CardHeader><CardTitle className="text-sm">Diagnoza</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{order.diagnosis}</CardContent></Card>
          )}
          {order.repair_description && (
            <Card><CardHeader><CardTitle className="text-sm">Wykonane prace</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{order.repair_description}</CardContent></Card>
          )}
          {order.accessories_received && (
            <Card><CardHeader><CardTitle className="text-sm">Akcesoria</CardTitle></CardHeader>
              <CardContent className="text-sm">{order.accessories_received}</CardContent></Card>
          )}
          {order.visual_condition && (
            <Card><CardHeader><CardTitle className="text-sm">Stan wizualny</CardTitle></CardHeader>
              <CardContent className="text-sm">{order.visual_condition}</CardContent></Card>
          )}
          {order.internal_notes && (
            <Card><CardHeader><CardTitle className="text-sm">Notatki wewnętrzne</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{order.internal_notes}</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {comments?.map((c: any) => (
                <div key={c.id} className="border-b pb-3 last:border-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <User className="h-3 w-3" />
                    <span>·</span>
                    <Clock className="h-3 w-3" />
                    {new Date(c.created_at).toLocaleString("pl-PL")}
                  </div>
                  <p className="text-sm">{c.comment}</p>
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

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {!logs?.length ? (
                <p className="text-sm text-muted-foreground">Brak historii</p>
              ) : (
                <div className="space-y-3">
                  {logs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3 text-sm border-b pb-3 last:border-0">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("pl-PL")}
                        </div>
                        <div className="mt-0.5">
                          <Badge variant="outline" className="text-xs">{log.action_type}</Badge>
                          {log.new_value_json && (
                            <pre className="text-xs text-muted-foreground mt-1 bg-muted p-1 rounded overflow-x-auto">
                              {JSON.stringify(log.new_value_json, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
