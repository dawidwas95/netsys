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
import { Calendar, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, User } from "lucide-react";
import { OrderStatusBadge } from "@/pages/DashboardPage";
import { format, addDays, subDays, isToday } from "date-fns";
import { pl } from "date-fns/locale";

const COMPLETED_STATUSES = ["COMPLETED", "ARCHIVED", "CANCELLED"];

export default function DailyPlanPage() {
  const { user } = useAuth();
  const { isAdmin, isKierownik, isSerwisant } = useUserRole();
  const isManager = isAdmin || isKierownik;

  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [techFilter, setTechFilter] = useState<string>("all");

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

  // Fetch all orders for the date + their technician assignments
  const { data: rawOrders = [], isLoading } = useQuery({
    queryKey: ["daily-plan-orders", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("id, order_number, status, priority, problem_description, planned_execution_date, planned_execution_time, client_id, device_id, clients(display_name), devices(manufacturer, model)")
        .eq("planned_execution_date", selectedDate);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: techAssignments = [] } = useQuery({
    queryKey: ["daily-plan-techs", selectedDate, rawOrders.map((o: any) => o.id).join(",")],
    queryFn: async () => {
      if (!rawOrders.length) return [];
      const orderIds = rawOrders.map((o: any) => o.id);
      const { data } = await supabase
        .from("order_technicians")
        .select("order_id, user_id, is_primary")
        .in("order_id", orderIds);
      return data ?? [];
    },
    enabled: rawOrders.length > 0,
  });

  // Build a map: orderId -> techUserIds
  const orderTechMap = useMemo(() => {
    const map = new Map<string, string[]>();
    (techAssignments as any[]).forEach((t) => {
      const list = map.get(t.order_id) ?? [];
      list.push(t.user_id);
      map.set(t.order_id, list);
    });
    return map;
  }, [techAssignments]);

  // Sort: orders with time first (ascending), then without time at bottom
  const sortOrders = (list: any[]) =>
    [...list].sort((a, b) => {
      const at = a.planned_execution_time ?? "";
      const bt = b.planned_execution_time ?? "";
      if (at && !bt) return -1;
      if (!at && bt) return 1;
      return at.localeCompare(bt);
    });

  // Filter orders by technician
  const filteredOrders = useMemo(() => {
    let list = rawOrders as any[];
    if (effectiveTechFilter !== "all") {
      list = list.filter((o) => {
        const techs = orderTechMap.get(o.id) ?? [];
        return techs.includes(effectiveTechFilter);
      });
    }
    return sortOrders(list);
  }, [rawOrders, effectiveTechFilter, orderTechMap]);

  // Grouped by technician (for manager "all" view)
  const groupedByTech = useMemo(() => {
    if (effectiveTechFilter !== "all") return null;
    if (!isManager) return null;

    const groups = new Map<string, any[]>();
    const unassigned: any[] = [];

    (rawOrders as any[]).forEach((order) => {
      const techs = orderTechMap.get(order.id) ?? [];
      if (techs.length === 0) {
        unassigned.push(order);
      } else {
        techs.forEach((techId: string) => {
          const list = groups.get(techId) ?? [];
          list.push(order);
          groups.set(techId, list);
        });
      }
    });

    // Sort each group
    const result: { techId: string; techName: string; orders: any[] }[] = [];
    staffUsers.forEach((staff) => {
      const orders = groups.get(staff.id);
      if (orders?.length) {
        result.push({ techId: staff.id, techName: staff.name, orders: sortOrders(orders) });
      }
    });
    if (unassigned.length) {
      result.push({ techId: "__unassigned__", techName: "Nieprzypisane", orders: sortOrders(unassigned) });
    }
    return result;
  }, [rawOrders, orderTechMap, staffUsers, effectiveTechFilter, isManager]);

  const now = new Date();
  const currentTime = format(now, "HH:mm");
  const todayStr = format(now, "yyyy-MM-dd");

  const isOverdue = (order: any) => {
    if (COMPLETED_STATUSES.includes(order.status)) return false;
    const time = order.planned_execution_time;
    if (!time) return selectedDate < todayStr;
    if (selectedDate < todayStr) return true;
    if (selectedDate > todayStr) return false;
    return time.slice(0, 5) < currentTime;
  };

  const dateLabel = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    if (isToday(d)) return "Dziś";
    return format(d, "EEEE, d MMMM", { locale: pl });
  }, [selectedDate]);

  const totalCount = isManager && groupedByTech
    ? groupedByTech.reduce((s, g) => s + g.orders.length, 0)
    : filteredOrders.length;

  return (
    <div>
      <div className="page-header mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Plan dnia
          </h1>
          <p className="text-muted-foreground text-sm">{totalCount} zaplanowanych zadań</p>
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
          {selectedDate !== todayStr && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedDate(todayStr)}>
              Dziś
            </Button>
          )}
        </div>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
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

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Ładowanie...</div>
      ) : totalCount === 0 ? (
        <div className="text-center py-12">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Brak zaplanowanych zadań na ten dzień</p>
        </div>
      ) : isManager && groupedByTech ? (
        /* Manager grouped view */
        <div className="space-y-6">
          {groupedByTech.map((group) => (
            <div key={group.techId}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">{group.techName}</h2>
                  <span className="text-xs text-muted-foreground">{group.orders.length} zadań</span>
                </div>
              </div>
              <div className="space-y-2 ml-2">
                {group.orders.map((order: any) => (
                  <OrderCard key={order.id} order={order} isOverdue={isOverdue(order)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Single technician flat list */
        <div className="space-y-2">
          {filteredOrders.map((order: any) => (
            <OrderCard key={order.id} order={order} isOverdue={isOverdue(order)} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, isOverdue }: { order: any; isOverdue: boolean }) {
  const time = order.planned_execution_time?.slice(0, 5);
  const device = order.devices ? `${order.devices.manufacturer ?? ""} ${order.devices.model ?? ""}`.trim() : "—";
  const isDone = COMPLETED_STATUSES.includes(order.status);

  return (
    <Link
      to={`/orders/${order.id}`}
      className={`block rounded-lg border p-3 sm:p-4 transition-colors hover:bg-muted/50 ${
        isDone ? "opacity-60 border-border" : isOverdue ? "border-destructive/40 bg-destructive/5" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Time column */}
        <div className="shrink-0 w-14 text-center">
          {time ? (
            <span className={`text-lg font-bold tabular-nums ${isDone ? "text-muted-foreground line-through" : isOverdue ? "text-destructive" : "text-primary"}`}>
              {time}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">brak godz.</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-medium text-sm">{order.order_number}</span>
            <OrderStatusBadge status={order.status} />
            {isOverdue && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                <AlertTriangle className="h-3 w-3 mr-0.5" /> Zaległe
              </Badge>
            )}
            {!time && !isDone && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                Bez godziny
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
}
