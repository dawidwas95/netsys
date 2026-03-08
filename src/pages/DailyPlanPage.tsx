import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { OrderStatusBadge } from "@/pages/DashboardPage";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/types/database";
import { format, addDays, subDays, isToday } from "date-fns";
import { pl } from "date-fns/locale";

export default function DailyPlanPage() {
  const { user } = useAuth();
  const { isAdmin, isKierownik, isSerwisant } = useUserRole();
  const isManager = isAdmin || isKierownik;

  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [techFilter, setTechFilter] = useState<string>(() => (isSerwisant && !isManager) ? (user?.id ?? "all") : "all");

  // When role loads and user is SERWISANT, lock to own
  const effectiveTechFilter = (isSerwisant && !isManager) ? (user?.id ?? "all") : techFilter;

  const { data: staffUsers = [] } = useQuery({
    queryKey: ["staff-for-plan"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .eq("is_active", true);
      return (data ?? []).map((p: any) => ({
        id: p.user_id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Użytkownik",
      }));
    },
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["daily-plan", selectedDate, effectiveTechFilter],
    queryFn: async () => {
      // Get orders for the selected date
      let query = supabase
        .from("service_orders")
        .select("id, order_number, status, priority, problem_description, planned_execution_date, planned_execution_time, client_id, device_id, clients(display_name), devices(manufacturer, model)")
        .eq("planned_execution_date", selectedDate)
        .order("planned_execution_time", { ascending: true, nullsFirst: false });

      const { data, error } = await query;
      if (error) throw error;

      let results = data ?? [];

      // Filter by technician if needed
      if (effectiveTechFilter !== "all") {
        const { data: techOrders } = await supabase
          .from("order_technicians")
          .select("order_id")
          .eq("user_id", effectiveTechFilter);
        const techOrderIds = new Set((techOrders ?? []).map((r: any) => r.order_id));
        results = results.filter((o: any) => techOrderIds.has(o.id));
      }

      return results;
    },
  });

  const now = new Date();
  const currentTime = format(now, "HH:mm");

  const isOverdue = (time: string | null) => {
    if (!time) return false;
    if (selectedDate < format(now, "yyyy-MM-dd")) return true;
    if (selectedDate > format(now, "yyyy-MM-dd")) return false;
    return time.slice(0, 5) < currentTime;
  };

  const dateLabel = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    if (isToday(d)) return "Dziś";
    return format(d, "EEEE, d MMMM", { locale: pl });
  }, [selectedDate]);

  const techName = (id: string) => staffUsers.find((u) => u.id === id)?.name ?? "—";

  return (
    <div>
      <div className="page-header mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Plan dnia
          </h1>
          <p className="text-muted-foreground text-sm">{orders.length} zaplanowanych zadań</p>
        </div>
      </div>

      {/* Date navigation + tech filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate + "T00:00:00"), 1), "yyyy-MM-dd"))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center">
            <span className="font-medium text-sm capitalize">{dateLabel}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate + "T00:00:00"), 1), "yyyy-MM-dd"))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {selectedDate !== format(new Date(), "yyyy-MM-dd") && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}>
              Dziś
            </Button>
          )}
        </div>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />

        {isManager && (
          <Select value={effectiveTechFilter} onValueChange={setTechFilter}>
            <SelectTrigger className="w-full sm:w-52 min-h-[44px]">
              <SelectValue placeholder="Technik" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy technicy</SelectItem>
              {staffUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Ładowanie...</div>
      ) : !orders.length ? (
        <div className="text-center py-12">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Brak zaplanowanych zadań na ten dzień</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => {
            const time = order.planned_execution_time?.slice(0, 5);
            const overdue = isOverdue(order.planned_execution_time);
            const device = order.devices ? `${order.devices.manufacturer ?? ""} ${order.devices.model ?? ""}`.trim() : "—";

            return (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className={`block rounded-lg border p-3 sm:p-4 transition-colors hover:bg-muted/50 ${overdue ? "border-destructive/40 bg-destructive/5" : "border-border"}`}
              >
                <div className="flex items-start gap-3">
                  {/* Time column */}
                  <div className="shrink-0 w-14 text-center">
                    {time ? (
                      <span className={`text-lg font-bold tabular-nums ${overdue ? "text-destructive" : "text-primary"}`}>
                        {time}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-medium text-sm">{order.order_number}</span>
                      <OrderStatusBadge status={order.status} />
                      {overdue && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          <AlertTriangle className="h-3 w-3 mr-0.5" /> Zaległe
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{order.clients?.display_name ?? "—"}</span>
                      <span className="mx-1.5">·</span>
                      <span>{device}</span>
                    </div>
                    {order.problem_description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        {order.problem_description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
