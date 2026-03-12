import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  CheckCircle, AlertCircle, Users, TrendingUp, TrendingDown,
  Clock, DollarSign, Wallet, Percent, AlertTriangle, Package, ShoppingCart, CalendarDays, Filter,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/types/database";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

type PeriodPreset = "today" | "week" | "month" | "quarter" | "year" | "custom";

function usePeriodRange() {
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case "today":
        return { from: todayStart, to: now };
      case "week": {
        const d = new Date(todayStart);
        d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
        return { from: d, to: now };
      }
      case "month":
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
      case "quarter": {
        const qm = Math.floor(now.getMonth() / 3) * 3;
        return { from: new Date(now.getFullYear(), qm, 1), to: now };
      }
      case "year":
        return { from: new Date(now.getFullYear(), 0, 1), to: now };
      case "custom": {
        const f = customFrom ? new Date(customFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
        const t = customTo ? new Date(customTo + "T23:59:59") : now;
        return { from: f, to: t };
      }
    }
  }, [preset, customFrom, customTo]);

  return { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const period = usePeriodRange();
  const { range } = period;

  const periodLabel = {
    today: "dziś",
    week: "tydzień",
    month: "miesiąc",
    quarter: "kwartał",
    year: "rok",
    custom: "okres",
  }[period.preset];

  const { data: orderStats } = useQuery({
    queryKey: ["dashboard-order-stats", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("service_orders")
        .select("status, created_at, completed_at");

      const newInPeriod = orders?.filter((o) => {
        const d = new Date(o.created_at);
        return d >= range.from && d <= range.to;
      }).length ?? 0;

      const active = orders?.filter((o) => !["COMPLETED", "ARCHIVED", "CANCELLED"].includes(o.status)).length ?? 0;

      const completedPeriod = orders?.filter(
        (o) => o.status === "COMPLETED" && o.completed_at && new Date(o.completed_at) >= range.from && new Date(o.completed_at) <= range.to
      ) ?? [];

      return { newInPeriod, active, completedPeriodCount: completedPeriod.length };
    },
  });

  const { data: financialStats } = useQuery({
    queryKey: ["dashboard-financial-stats", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data: completedOrders } = await supabase
        .from("service_orders")
        .select("id, labor_net, parts_net, extra_cost_net, total_net, total_gross, is_paid, payment_method, completed_at")
        .eq("status", "COMPLETED")
        .eq("is_paid", true)
        .gte("completed_at", range.from.toISOString())
        .lte("completed_at", range.to.toISOString());

      if (!completedOrders?.length) return { revenue: 0, cost: 0, profit: 0, margin: 0, revenueGross: 0, costGross: 0, profitGross: 0 };

      const orderIds = completedOrders.map((o) => o.id);

      const { data: items } = await supabase
        .from("service_order_items")
        .select("order_id, total_sale_net, total_purchase_net")
        .in("order_id", orderIds);

      let revenue = 0;
      let cost = 0;

      for (const o of completedOrders) {
        const laborNet = Number(o.labor_net || 0);
        const partsCost = Number(o.parts_net || 0);
        const extraCost = Number(o.extra_cost_net || 0);

        const orderItems = items?.filter((i) => i.order_id === o.id) ?? [];
        const itemsRevenue = orderItems.reduce((s, i) => s + i.total_sale_net, 0);
        const itemsCost = orderItems.reduce((s, i) => s + i.total_purchase_net, 0);

        revenue += laborNet + itemsRevenue;
        cost += partsCost + extraCost + itemsCost;
      }

      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const revenueGross = revenue * 1.23;
      const costGross = cost * 1.23;
      const profitGross = revenueGross - costGross;

      return { revenue, cost, profit, margin, revenueGross, costGross, profitGross };
    },
  });

  const { data: cashBalance } = useQuery({
    queryKey: ["dashboard-cash-balance"],
    queryFn: async () => {
      const { data } = await supabase.from("cash_transactions").select("transaction_type, amount, gross_amount");
      if (!data) return 0;
      return data.reduce((sum, t) => {
        const amt = Number(t.gross_amount) > 0 ? Number(t.gross_amount) : Number(t.amount);
        if (t.transaction_type === "IN") return sum + amt;
        if (t.transaction_type === "OUT") return sum - amt;
        return sum;
      }, 0);
    },
  });

  const { data: clientCount } = useQuery({
    queryKey: ["dashboard-client-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      return count ?? 0;
    },
  });

  const kpis = [
    { label: `Nowe (${periodLabel})`, value: orderStats?.newInPeriod ?? 0, icon: AlertCircle, color: "text-destructive" },
    { label: "Aktywne zlecenia", value: orderStats?.active ?? 0, icon: Clock, color: "text-primary" },
    { label: `Zakończone (${periodLabel})`, value: orderStats?.completedPeriodCount ?? 0, icon: CheckCircle, color: "text-primary" },
    { label: "Aktywni klienci", value: clientCount ?? 0, icon: Users, color: "text-muted-foreground" },
  ];

  const finKpis = [
    { label: "Przychód brutto", value: formatCurrency(financialStats?.revenueGross ?? 0), icon: TrendingUp, color: "text-primary" },
    { label: "Koszty brutto", value: formatCurrency(financialStats?.costGross ?? 0), icon: TrendingDown, color: "text-destructive" },
    { label: "Zysk brutto", value: formatCurrency(financialStats?.profitGross ?? 0), icon: DollarSign, color: (financialStats?.profitGross ?? 0) >= 0 ? "text-primary" : "text-destructive" },
    { label: "Marża", value: `${(financialStats?.margin ?? 0).toFixed(1)}%`, icon: Percent, color: "text-muted-foreground" },
    { label: "Stan kasy", value: formatCurrency(cashBalance ?? 0), icon: Wallet, color: "text-primary" },
  ];

  return (
    <div>
      <div className="page-header flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Przegląd systemu</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={period.preset} onValueChange={(v) => period.setPreset(v as PeriodPreset)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Dziś</SelectItem>
                <SelectItem value="week">Ten tydzień</SelectItem>
                <SelectItem value="month">Ten miesiąc</SelectItem>
                <SelectItem value="quarter">Ten kwartał</SelectItem>
                <SelectItem value="year">Ten rok</SelectItem>
                <SelectItem value="custom">Własny zakres</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period.preset === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={period.customFrom}
                onChange={(e) => period.setCustomFrom(e.target.value)}
                className="h-9 w-[140px]"
              />
              <span className="text-muted-foreground text-sm">—</span>
              <Input
                type="date"
                value={period.customTo}
                onChange={(e) => period.setCustomTo(e.target.value)}
                className="h-9 w-[140px]"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{kpi.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {finKpis.map((kpi) => (
          <Card key={kpi.label} className="border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent><div className="text-xl font-bold">{kpi.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <LowStockAlerts />
      <TodaysScheduledOrders />
      <PurchaseListWidget />
      <PurchaseRequestsWidget />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Ostatnie zlecenia</CardTitle></CardHeader>
          <CardContent><RecentOrders /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Ostatnie operacje kasowe</CardTitle></CardHeader>
          <CardContent><RecentCashOps /></CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecentOrders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("id, order_number, status, priority, total_gross, is_paid, received_at, clients(display_name)")
        .order("received_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Ładowanie...</p>;
  if (!orders?.length) return <p className="text-sm text-muted-foreground">Brak zleceń</p>;

  return (
    <div className="space-y-3">
      {orders.map((order: any) => (
        <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors">
          <div>
            <span className="font-medium font-mono">{order.order_number}</span>
            <span className="text-muted-foreground ml-2">{order.clients?.display_name}</span>
          </div>
          <div className="flex items-center gap-2">
            {Number(order.total_gross || 0) > 0 && (
              <span className="font-mono text-xs text-muted-foreground">
                {formatCurrency(Number(order.total_gross))}
              </span>
            )}
            <OrderStatusBadge status={order.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function RecentCashOps() {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["recent-cash-ops"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cash_transactions")
        .select("*, service_orders(order_number, clients(display_name))")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Ładowanie...</p>;
  if (!transactions?.length) return <p className="text-sm text-muted-foreground">Brak operacji</p>;

  return (
    <div className="space-y-3">
      {transactions.map((t: any) => (
        <div key={t.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
          <div>
            <span className="font-medium">{t.description || "Operacja kasowa"}</span>
            <div className="text-xs text-muted-foreground">
              {new Date(t.transaction_date).toLocaleDateString("pl-PL")}
              {t.service_orders?.order_number && ` · ${t.service_orders.order_number}`}
              {t.service_orders?.clients?.display_name && ` · ${t.service_orders.clients.display_name}`}
            </div>
          </div>
          <span className={`font-mono font-medium ${t.transaction_type === "IN" ? "text-primary" : "text-destructive"}`}>
            {t.transaction_type === "IN" ? "+" : "-"}
            {formatCurrency(Number(t.gross_amount || t.amount))}
          </span>
        </div>
      ))}
    </div>
  );
}

function LowStockAlerts() {
  const { data: lowStockItems = [] } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, sku, stock_quantity, minimum_quantity, unit")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []).filter((i) => Number(i.stock_quantity) <= Number(i.minimum_quantity) && Number(i.minimum_quantity) > 0);
    },
  });

  if (lowStockItems.length === 0) return null;

  return (
    <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Niski stan magazynowy
          <Badge variant="secondary" className="ml-auto bg-amber-500/20 text-amber-600 border-amber-500/30">
            {lowStockItems.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {lowStockItems.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between text-sm border-b border-amber-500/10 pb-2 last:border-0">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{item.name}</span>
                {item.sku && <span className="text-xs text-muted-foreground font-mono">({item.sku})</span>}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-amber-600 font-medium">
                  Stan: {Number(item.stock_quantity)} {item.unit}
                </span>
                <span className="text-muted-foreground">
                  Min: {Number(item.minimum_quantity)} {item.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TodaysScheduledOrders() {
  const { user } = useAuth();
  const { isAdmin, isKierownik, isSerwisant } = useUserRole();

  const today = new Date().toISOString().split("T")[0];

  const { data: orders = [] } = useQuery({
    queryKey: ["dashboard-todays-schedule", user?.id, isAdmin, isKierownik],
    queryFn: async () => {
      let query = supabase
        .from("service_orders")
        .select("id, order_number, status, priority, planned_execution_date, planned_execution_time, appointment_note, clients(display_name), devices(manufacturer, model)")
        .not("status", "in", '("COMPLETED","ARCHIVED","CANCELLED")')
        .not("planned_execution_date", "is", null)
        .lte("planned_execution_date", today)
        .order("planned_execution_date", { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      let result = (data ?? []) as any[];

      if (isSerwisant && user?.id) {
        const { data: assignments } = await supabase
          .from("order_technicians")
          .select("order_id")
          .eq("user_id", user.id);
        const assignedIds = new Set((assignments ?? []).map((a: any) => a.order_id));
        result = result.filter((o: any) => assignedIds.has(o.id));
      }

      return result.sort((a: any, b: any) => {
        const aToday = a.planned_execution_date === today;
        const bToday = b.planned_execution_date === today;
        if (aToday !== bToday) return aToday ? -1 : 1;
        return (a.planned_execution_time || "99:99").localeCompare(b.planned_execution_time || "99:99");
      });
    },
    enabled: !!user,
  });

  if (orders.length === 0) return null;

  const todayOrders = orders.filter((o: any) => o.planned_execution_date === today);
  const overdueOrders = orders.filter((o: any) => o.planned_execution_date < today);

  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Dzisiejsze zadania
          {todayOrders.length > 0 && (
            <Badge variant="default" className="ml-1">{todayOrders.length}</Badge>
          )}
          {overdueOrders.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {overdueOrders.length} zaległe
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {orders.map((order: any) => {
            const isOverdue = order.planned_execution_date < today;
            const isToday = order.planned_execution_date === today;
            return (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="flex items-center justify-between text-sm border-b pb-2 last:border-0 hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-xs font-mono w-12 shrink-0 text-center">
                    {order.planned_execution_time
                      ? order.planned_execution_time.slice(0, 5)
                      : "—"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium font-mono">{order.order_number}</span>
                      {isToday && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">📅 Dziś</Badge>
                      )}
                      {isOverdue && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">⚠ Zaległe</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {order.clients?.display_name}
                      {order.devices && ` · ${order.devices.manufacturer || ""} ${order.devices.model || ""}`.trim()}
                    </div>
                    {order.appointment_note && (
                      <div className="text-xs text-muted-foreground italic truncate">
                        {order.appointment_note}
                      </div>
                    )}
                  </div>
                </div>
                <OrderStatusBadge status={order.status} />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function PurchaseListWidget() {
  const { data: count = 0 } = useQuery({
    queryKey: ["dashboard-purchase-list-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, stock_quantity, minimum_quantity")
        .eq("is_active", true)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []).filter((i) => Number(i.minimum_quantity) > 0 && Number(i.stock_quantity) <= Number(i.minimum_quantity)).length;
    },
  });

  if (count === 0) return null;

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardContent className="py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <div>
            <span className="font-medium">Produkty do zamówienia:</span>
            <Badge variant="secondary" className="ml-2">{count}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/purchase-list">Otwórz listę zakupów</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PurchaseRequestsWidget() {
  const { data: count = 0 } = useQuery({
    queryKey: ["dashboard-purchase-requests-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("purchase_requests")
        .select("*", { count: "exact", head: true })
        .in("status", ["NEW", "TO_ORDER"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  if (count === 0) return null;

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-900/30 dark:bg-orange-950/20">
      <CardContent className="py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-orange-600" />
          <div>
            <span className="font-medium">Zapotrzebowanie ze zleceń:</span>
            <Badge variant="secondary" className="ml-2">{count}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/purchase-requests">Otwórz kolejkę</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const colorMap: Record<string, string> = {
    NEW: "bg-status-new/10 text-status-new",
    DIAGNOSIS: "bg-status-diagnosis/10 text-status-diagnosis",
    DIAGNOSIS_QUOTE: "bg-status-diagnosis/10 text-status-diagnosis",
    TODO: "bg-status-todo/10 text-status-todo",
    IN_PROGRESS: "bg-status-in-progress/10 text-status-in-progress",
    WAITING: "bg-status-waiting/10 text-status-waiting",
    WAITING_CLIENT: "bg-status-contact/10 text-status-contact",
    READY_FOR_RETURN: "bg-status-ready/10 text-status-ready",
    COMPLETED: "bg-status-completed/10 text-status-completed",
    ARCHIVED: "bg-status-archived/10 text-status-archived",
    CANCELLED: "bg-status-cancelled/10 text-status-cancelled",
  };

  return (
    <span className={`status-badge ${colorMap[status] ?? "bg-muted text-muted-foreground"}`}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
