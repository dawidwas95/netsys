import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wrench,
  CheckCircle,
  AlertCircle,
  Users,
  TrendingUp,
  Clock,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: orderStats } = useQuery({
    queryKey: ["dashboard-order-stats"],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("service_orders")
        .select("status, created_at, total_net, is_paid");

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const newToday = orders?.filter(
        (o) => new Date(o.created_at) >= today
      ).length ?? 0;

      const active = orders?.filter(
        (o) => !["COMPLETED", "ARCHIVED", "CANCELLED"].includes(o.status)
      ).length ?? 0;

      const completedMonth = orders?.filter(
        (o) => o.status === "COMPLETED" && new Date(o.created_at) >= monthStart
      ).length ?? 0;

      const revenueMonth = orders
        ?.filter((o) => new Date(o.created_at) >= monthStart && o.is_paid)
        .reduce((sum, o) => sum + Number(o.total_net || 0), 0) ?? 0;

      return { newToday, active, completedMonth, revenueMonth };
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
    {
      label: "Nowe zlecenia dziś",
      value: orderStats?.newToday ?? 0,
      icon: AlertCircle,
      color: "text-status-new",
    },
    {
      label: "Aktywne zlecenia",
      value: orderStats?.active ?? 0,
      icon: Clock,
      color: "text-status-in-progress",
    },
    {
      label: "Zakończone (miesiąc)",
      value: orderStats?.completedMonth ?? 0,
      icon: CheckCircle,
      color: "text-success",
    },
    {
      label: "Przychód (miesiąc)",
      value: `${(orderStats?.revenueMonth ?? 0).toLocaleString("pl-PL")} zł`,
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      label: "Aktywni klienci",
      value: clientCount ?? 0,
      icon: Users,
      color: "text-info",
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Przegląd systemu</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="kpi-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ostatnie zlecenia</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentOrders />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Szybkie akcje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickActions />
          </CardContent>
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
        .select("id, order_number, status, priority, received_at, clients(display_name), devices(manufacturer, model)")
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
        <div key={order.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
          <div>
            <span className="font-medium">{order.order_number}</span>
            <span className="text-muted-foreground ml-2">{order.clients?.display_name}</span>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      ))}
    </div>
  );
}

function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <a href="/orders/kanban" className="kpi-card flex items-center gap-2 text-sm hover:bg-accent transition-colors">
        <Wrench className="h-4 w-4 text-primary" />
        Kanban zleceń
      </a>
      <a href="/clients" className="kpi-card flex items-center gap-2 text-sm hover:bg-accent transition-colors">
        <Users className="h-4 w-4 text-primary" />
        Lista klientów
      </a>
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
