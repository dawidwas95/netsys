import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { OrderStatusBadge } from "@/pages/DashboardPage";
import {
  ORDER_STATUS_LABELS, ORDER_PRIORITY_LABELS,
  type OrderStatus, type OrderPriority,
} from "@/types/database";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-primary/10 text-primary",
  HIGH: "bg-warning/10 text-warning",
  URGENT: "bg-destructive/10 text-destructive",
};

export default function MyOrdersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id, statusFilter],
    queryFn: async () => {
      // Get my assigned order IDs
      const { data: techRows } = await supabase
        .from("order_technicians")
        .select("order_id")
        .eq("user_id", user!.id);

      if (!techRows?.length) return [];
      const orderIds = techRows.map((r: any) => r.order_id);

      let query = supabase
        .from("service_orders")
        .select("id, order_number, status, priority, problem_description, received_at, estimated_completion_date, clients(display_name), devices(manufacturer, model)")
        .in("id", orderIds)
        .order("received_at", { ascending: false });

      if (statusFilter === "active") {
        query = query.not("status", "in", '("COMPLETED","ARCHIVED","CANCELLED")');
      } else if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const filtered = search
    ? orders.filter((o: any) =>
        o.order_number.toLowerCase().includes(search.toLowerCase()) ||
        o.problem_description?.toLowerCase().includes(search.toLowerCase()) ||
        o.clients?.display_name?.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Moje zlecenia</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} zleceń przypisanych do Ciebie</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 min-h-[44px]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 min-h-[44px]">
            <SelectValue placeholder="Filtr" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktywne</SelectItem>
            <SelectItem value="all">Wszystkie</SelectItem>
            {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Ładowanie...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Brak przypisanych zleceń</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order: any) => (
            <Link key={order.id} to={`/orders/${order.id}`} className="block">
              <div className="bg-card border rounded-xl p-4 space-y-2 active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium text-primary">{order.order_number}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="text-sm font-medium">{order.clients?.display_name || "—"}</div>
                {order.devices && (
                  <div className="text-xs text-muted-foreground">
                    {order.devices.manufacturer} {order.devices.model}
                  </div>
                )}
                {order.problem_description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{order.problem_description}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[order.priority] || ""}`}>
                    {ORDER_PRIORITY_LABELS[order.priority as OrderPriority]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.received_at).toLocaleDateString("pl-PL")}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
