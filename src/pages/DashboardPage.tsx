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

import { useQuery as useSupabaseQuery } from "@supabase/auth-helpers-react";
import { format } from "date-fns";

function RecentOrders() {
  const { data } = useSupabaseQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("id, created_at, client_name, total_gross, status")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="divide-y divide-border">
      {data?.map((order: any) => (
        <Link to={`/orders/${order.id}`} key={order.id} className="flex items-center justify-between p-3 hover:bg-accent rounded-md transition-colors">
          <div>
            <div className="font-medium text-sm">#{order.id} - {order.client_name}</div>
            <div className="text-xs text-muted-foreground">{format(new Date(order.created_at), "dd.MM.yyyy HH:mm")}</div>
          </div>
          <div className="font-bold text-sm">{formatCurrency(order.total_gross)}</div>
        </Link>
      ))}
    </div>
  );
}

function RecentCashOps() {
  const { data } = useSupabaseQuery({
    queryKey: ["recent-cash-ops"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cash_transactions")
        .select("id, created_at, description, gross_amount, transaction_type")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="divide-y divide-border">
      {data?.map((op: any) => (
        <div key={op.id} className="flex items-center justify-between p-3">
          <div>
            <div className="font-medium text-sm">{op.description}</div>
            <div className="text-xs text-muted-foreground">{format(new Date(op.created_at), "dd.MM.yyyy HH:mm")}</div>
          </div>
          <div className={`font-bold text-sm ${op.transaction_type === "IN" ? "text-emerald-500" : "text-destructive"}`}>
            {formatCurrency(op.gross_amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

function LowStockAlerts() {
  const { data } = useSupabaseQuery({
    queryKey: ["low-stock-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("id, name, quantity, alert_quantity")
        .lte("quantity", "alert_quantity");
      return data ?? [];
    },
  });

  if (!data?.length) return null;

  return (
    <Card className="bg-yellow-50/50 border-yellow-500/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">Niski stan magazynowy</CardTitle>
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
      </CardHeader>
      <CardContent>
        <ul className="list-disc pl-4">
          {data.map((item: any) => (
            <li key={item.id} className="text-sm">
              {item.name} - zostało {item.quantity}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TodaysScheduledOrders() {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  const { data } = useSupabaseQuery({
    queryKey: ["todays-scheduled-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("id, client_name, scheduled_start")
        .gte("scheduled_start", todayStart.toISOString())
        .lte("scheduled_start", todayEnd.toISOString());
      return data ?? [];
    },
  });

  if (!data?.length) return null;

  return (
    <Card className="bg-blue-50/50 border-blue-500/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">Zaplanowane na dziś</CardTitle>
        <CalendarDays className="h-4 w-4 text-blue-500" />
      </CardHeader>
      <CardContent>
        <ul className="list-disc pl-4">
          {data.map((item: any) => (
            <li key={item.id} className="text-sm">
              {item.client_name} - {format(new Date(item.scheduled_start), "HH:mm")}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PurchaseListWidget() {
  const { data } = useSupabaseQuery({
    queryKey: ["purchase-list-widget"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_lists")
        .select("id, name, status")
        .eq("status", "OPEN");
      return data ?? [];
    },
  });

  if (!data?.length) return null;

  return (
    <Card className="bg-orange-50/50 border-orange-500/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">Listy zakupów</CardTitle>
        <ShoppingCart className="h-4 w-4 text-orange-500" />
      </CardHeader>
      <CardContent>
        <ul className="list-disc pl-4">
          {data.map((item: any) => (
            <li key={item.id} className="text-sm">
              {item.name}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PurchaseRequestsWidget() {
  const { data } = useSupabaseQuery({
    queryKey: ["purchase-requests-widget"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_requests")
        .select("id, description, status")
        .eq("status", "OPEN");
      return data ?? [];
    },
  });

  if (!data?.length) return null;

  return (
    <Card className="bg-teal-50/50 border-teal-500/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">Zapotrzebowania</CardTitle>
        <Package className="h-4 w-4 text-teal-500" />
      </CardHeader>
      <CardContent>
        <ul className="list-disc pl-4">
          {data.map((item: any) => (
            <li key={item.id} className="text-sm">
              {item.description}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
