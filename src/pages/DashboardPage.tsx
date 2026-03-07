import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Wrench, CheckCircle, AlertCircle, Users, TrendingUp, TrendingDown,
  Clock, DollarSign, Wallet, Percent,
} from "lucide-react";
import { Link } from "react-router-dom";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: orderStats } = useQuery({
    queryKey: ["dashboard-order-stats"],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("service_orders")
        .select("status, created_at, completed_at, labor_net, parts_net, extra_cost_net, total_net, total_gross, is_paid, payment_method");

      const { data: items } = await supabase
        .from("service_order_items")
        .select("order_id, total_sale_net, total_purchase_net");

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const newToday = orders?.filter((o) => new Date(o.created_at) >= today).length ?? 0;
      const active = orders?.filter((o) => !["COMPLETED", "ARCHIVED", "CANCELLED"].includes(o.status)).length ?? 0;

      // Completed this month
      const completedMonth = orders?.filter(
        (o) => o.status === "COMPLETED" && o.completed_at && new Date(o.completed_at) >= monthStart
      ) ?? [];

      // Build items map by order (for completed orders)
      const itemsByOrder = new Map<string, { saleTotal: number; costTotal: number }>();
      // We don't have order_id→status mapping from items query, so we calculate globally

      // Financial stats from completed & paid orders this month
      let revenueMonth = 0;
      let costMonth = 0;

      const completedOrderIds = new Set<string>();
      const allCompletedPaid = orders?.filter((o) => o.status === "COMPLETED" && o.is_paid && o.completed_at && new Date(o.completed_at) >= monthStart) ?? [];

      // We need order IDs but service_orders select doesn't include id. Let's re-query with id.
      // Actually, let me fix - we need id in the select
      return { newToday, active, completedMonthCount: completedMonth.length, allCompletedPaid };
    },
  });

  // Separate query with IDs for financial calculations
  const { data: financialStats } = useQuery({
    queryKey: ["dashboard-financial-stats"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: completedOrders } = await supabase
        .from("service_orders")
        .select("id, labor_net, parts_net, extra_cost_net, total_net, is_paid, payment_method, completed_at")
        .eq("status", "COMPLETED")
        .eq("is_paid", true)
        .gte("completed_at", monthStart.toISOString());

      if (!completedOrders?.length) return { revenue: 0, cost: 0, profit: 0, margin: 0 };

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

      return { revenue, cost, profit, margin };
    },
  });

  const { data: cashBalance } = useQuery({
    queryKey: ["dashboard-cash-balance"],
    queryFn: async () => {
      const { data } = await supabase.from("cash_transactions").select("transaction_type, amount");
      if (!data) return 0;
      return data.reduce((sum, t) => {
        if (t.transaction_type === "IN") return sum + Number(t.amount);
        if (t.transaction_type === "OUT") return sum - Number(t.amount);
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
    { label: "Nowe dziś", value: orderStats?.newToday ?? 0, icon: AlertCircle, color: "text-destructive" },
    { label: "Aktywne zlecenia", value: orderStats?.active ?? 0, icon: Clock, color: "text-primary" },
    { label: "Zakończone (mies.)", value: orderStats?.completedMonthCount ?? 0, icon: CheckCircle, color: "text-primary" },
    { label: "Aktywni klienci", value: clientCount ?? 0, icon: Users, color: "text-muted-foreground" },
  ];

  const finKpis = [
    { label: "Przychód (mies.)", value: formatCurrency(financialStats?.revenue ?? 0), icon: TrendingUp, color: "text-primary" },
    { label: "Koszty (mies.)", value: formatCurrency(financialStats?.cost ?? 0), icon: TrendingDown, color: "text-destructive" },
    { label: "Zysk (mies.)", value: formatCurrency(financialStats?.profit ?? 0), icon: DollarSign, color: (financialStats?.profit ?? 0) >= 0 ? "text-primary" : "text-destructive" },
    { label: "Marża", value: `${(financialStats?.margin ?? 0).toFixed(1)}%`, icon: Percent, color: "text-muted-foreground" },
    { label: "Stan kasy", value: formatCurrency(cashBalance ?? 0), icon: Wallet, color: "text-primary" },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Przegląd systemu</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
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

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mb-6">
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

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
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
        .select("id, order_number, status, priority, total_net, is_paid, received_at, clients(display_name)")
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
            {Number(order.total_net || 0) > 0 && (
              <span className="font-mono text-xs text-muted-foreground">
                {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(Number(order.total_net))}
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
            {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(Number(t.amount))}
          </span>
        </div>
      ))}
    </div>
  );
}

import { ORDER_STATUS_LABELS, type OrderStatus } from "@/types/database";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const colorMap: Record<OrderStatus, string> = {
    NEW: "bg-status-new/10 text-status-new",
    DIAGNOSIS: "bg-status-diagnosis/10 text-status-diagnosis",
    IN_PROGRESS: "bg-status-in-progress/10 text-status-in-progress",
    WAITING_CLIENT: "bg-status-waiting/10 text-status-waiting",
    READY_FOR_RETURN: "bg-status-ready/10 text-status-ready",
    COMPLETED: "bg-status-completed/10 text-status-completed",
    ARCHIVED: "bg-status-archived/10 text-status-archived",
    CANCELLED: "bg-status-cancelled/10 text-status-cancelled",
  };

  return (
    <span className={`status-badge ${colorMap[status]}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
