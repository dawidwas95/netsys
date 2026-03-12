import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadOrders } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, KanbanSquare, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { TechnicianBadges, QuickAssignButton } from "@/components/TechnicianAssignment";
import { ScheduleBadgeWithAction } from "@/components/ScheduleOrderDialog";
import {
  ORDER_STATUS_LABELS, ORDER_PRIORITY_LABELS, SERVICE_TYPE_LABELS,
  DEPARTMENT_LABELS, DEPARTMENT_ICONS,
  type OrderStatus, type OrderPriority, type ServiceType,
  type ServiceOrderInsert,
} from "@/types/database";
import { OrderStatusBadge } from "@/pages/DashboardPage";
import {
  ClientSection, DeviceSection, OrderDataSection, DescriptionSection, TechnicianSelectSection,
} from "@/components/order/OrderFormSections";

const STATUS_ORDER: OrderStatus[] = ["NEW", "DIAGNOSIS", "IN_PROGRESS", "WAITING_CLIENT", "READY_FOR_RETURN", "COMPLETED", "ARCHIVED", "CANCELLED"];

const STATUS_GROUP_COLORS: Record<OrderStatus, string> = {
  NEW: "bg-blue-500",
  DIAGNOSIS: "bg-amber-500",
  IN_PROGRESS: "bg-orange-500",
  WAITING_CLIENT: "bg-purple-500",
  READY_FOR_RETURN: "bg-emerald-500",
  COMPLETED: "bg-green-600",
  ARCHIVED: "bg-gray-400",
  CANCELLED: "bg-red-500",
};

// ── Extracted row components ──

function MobileOrderCard({ order, unread }: { order: any; unread: boolean }) {
  return (
    <Link to={`/orders/${order.id}`} className={`mobile-data-card block ${unread ? "ring-2 ring-primary/30" : ""}`}>
      <div className="mobile-card-header">
        <span className="font-medium font-mono text-primary flex items-center gap-1.5">
          {unread && <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />}
          {order.order_number}
        </span>
        <div className="flex items-center gap-1">
          <ScheduleBadgeWithAction orderId={order.id} orderNumber={order.order_number} date={order.planned_execution_date} time={order.planned_execution_time} />
          <OrderStatusBadge status={order.status} />
        </div>
      </div>
      <div className="mobile-card-row">
        <span className="mobile-card-label">Dział</span>
        <span className="text-sm">{DEPARTMENT_ICONS[order.service_type]} {DEPARTMENT_LABELS[order.service_type] || "—"}</span>
      </div>
      <div className="mobile-card-row">
        <span className="mobile-card-label">Klient</span>
        <span className="text-sm">{order.clients?.display_name || "—"}</span>
      </div>
      <div className="mobile-card-row">
        <span className="mobile-card-label">Urządzenie</span>
        <span className="text-sm">{order.devices ? `${order.devices.manufacturer} ${order.devices.model}` : "—"}</span>
      </div>
      <div className="mobile-card-row">
        <span className="mobile-card-label">Technik</span>
        <TechnicianBadges orderId={order.id} compact />
      </div>
      <div className="mobile-card-row">
        <span className="mobile-card-label">Priorytet</span>
        <span className="text-sm">{ORDER_PRIORITY_LABELS[order.priority as OrderPriority]}</span>
      </div>
      <div className="mobile-card-row">
        <span className="mobile-card-label">Data</span>
        <span className="text-sm">{new Date(order.received_at).toLocaleDateString("pl-PL")}</span>
      </div>
    </Link>
  );
}

function DesktopOrderRow({ order, unread }: { order: any; unread: boolean }) {
  return (
    <TableRow className={`hover:bg-muted/50 ${unread ? "bg-primary/5" : ""}`}>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {unread && <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />}
          <Link to={`/orders/${order.id}`} className="font-medium text-primary hover:underline font-mono">
            {order.order_number}
          </Link>
          <ScheduleBadgeWithAction orderId={order.id} orderNumber={order.order_number} date={order.planned_execution_date} time={order.planned_execution_time} />
        </div>
      </TableCell>
      <TableCell className="text-xs">{DEPARTMENT_ICONS[order.service_type]} {DEPARTMENT_LABELS[order.service_type] || SERVICE_TYPE_LABELS[order.service_type as ServiceType]}</TableCell>
      <TableCell>{order.clients?.display_name}</TableCell>
      <TableCell className="text-sm">
        {order.devices ? `${order.devices.manufacturer} ${order.devices.model}` : "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <TechnicianBadges orderId={order.id} compact />
          <QuickAssignButton orderId={order.id} orderNumber={order.order_number} />
        </div>
      </TableCell>
      <TableCell><OrderStatusBadge status={order.status} /></TableCell>
      <TableCell className="text-sm">{ORDER_PRIORITY_LABELS[order.priority as OrderPriority]}</TableCell>
      <TableCell className="text-sm">{new Date(order.received_at).toLocaleDateString("pl-PL")}</TableCell>
    </TableRow>
  );
}

// ── Main page ──

export default function ServiceOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [techFilter, setTechFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const { unreadOrderIds } = useUnreadOrders();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Load user's default department
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-dept", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("default_department").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [deptInitialized, setDeptInitialized] = useState(false);
  useEffect(() => {
    if (!deptInitialized && myProfile?.default_department) {
      setDeptFilter(myProfile.default_department);
      setDeptInitialized(true);
    }
  }, [myProfile, deptInitialized]);

  const { data: staffUsers = [] } = useQuery({
    queryKey: ["all-staff-users"],
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

  const { data: orders, isLoading } = useQuery({
    queryKey: ["service-orders", search, statusFilter, techFilter, deptFilter],
    queryFn: async () => {
      if (techFilter === "unassigned") {
        const { data: assignedRows } = await supabase
          .from("order_technicians")
          .select("order_id");
        const assignedOrderIds = new Set((assignedRows ?? []).map((r: any) => r.order_id));
        let query = supabase
          .from("service_orders")
          .select("*, clients(display_name), devices(manufacturer, model)")
          .order("received_at", { ascending: false });
        if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
        if (deptFilter !== "all") query = query.eq("service_type", deptFilter as any);
        if (search) query = query.or(`order_number.ilike.%${search}%,problem_description.ilike.%${search}%`);
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []).filter((o: any) => !assignedOrderIds.has(o.id));
      }

      let techOrderIds: string[] | null = null;
      if (techFilter !== "all") {
        const { data: techRows } = await supabase
          .from("order_technicians")
          .select("order_id")
          .eq("user_id", techFilter);
        techOrderIds = (techRows ?? []).map((r: any) => r.order_id);
        if (!techOrderIds.length) return [];
      }

      let query = supabase
        .from("service_orders")
        .select("*, clients(display_name), devices(manufacturer, model)")
        .order("received_at", { ascending: false });

      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (deptFilter !== "all") query = query.eq("service_type", deptFilter as any);
      if (search) query = query.or(`order_number.ilike.%${search}%,problem_description.ilike.%${search}%`);
      if (techOrderIds) query = query.in("id", techOrderIds);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const toggleGroup = (status: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const groupedOrders = useMemo(() => {
    if (!orders || statusFilter !== "all") return null;
    const groups: { status: OrderStatus; label: string; orders: any[] }[] = [];
    STATUS_ORDER.forEach((status) => {
      const filtered = orders.filter((o: any) => o.status === status);
      if (filtered.length > 0) {
        groups.push({ status, label: ORDER_STATUS_LABELS[status], orders: filtered });
      }
    });
    return groups;
  }, [orders, statusFilter]);

  const createOrder = useMutation({
    mutationFn: async (data: ServiceOrderInsert & { _technicianId?: string }) => {
      const { _technicianId, ...orderData } = data;
      const { data: inserted, error } = await supabase.from("service_orders").insert(orderData as any).select("id, order_number").single();
      if (error) throw error;
      if (_technicianId && inserted) {
        await supabase.from("order_technicians").upsert({
          order_id: inserted.id,
          user_id: _technicianId,
          is_primary: true,
          assigned_by: user?.id,
        } as any, { onConflict: "order_id,user_id", ignoreDuplicates: true });
        await supabase.from("activity_logs").insert({
          entity_type: "service_order",
          entity_id: inserted.id,
          action_type: "TECHNICIAN_ASSIGNED",
          entity_name: inserted.order_number ?? "",
          description: "Technik przypisany przy tworzeniu zlecenia",
          user_id: user?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      setDialogOpen(false);
      toast.success("Zlecenie utworzone");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div>
      {/* Department board switcher */}
      <div className="flex items-center gap-1.5 mb-4 p-1 bg-muted/50 rounded-lg w-fit">
        {[
          { value: "all", label: "Wszystkie", icon: "📋" },
          { value: "PHONE_SERVICE", label: "Serwis telefonów", icon: "📱" },
          { value: "COMPUTER_SERVICE", label: "Serwis komputerów", icon: "💻" },
        ].map((opt) => (
          <Button
            key={opt.value}
            variant={deptFilter === opt.value ? "default" : "ghost"}
            size="sm"
            className={`min-h-[38px] text-sm ${deptFilter === opt.value ? "" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setDeptFilter(opt.value)}
          >
            <span className="mr-1.5">{opt.icon}</span> {opt.label}
          </Button>
        ))}
      </div>

      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {deptFilter === "all" ? "Zlecenia serwisowe" : `${DEPARTMENT_ICONS[deptFilter]} ${DEPARTMENT_LABELS[deptFilter]}`}
          </h1>
          <p className="text-muted-foreground text-sm">{orders?.length ?? 0} zleceń</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link to="/orders/kanban">
            <Button variant="outline" size="sm" className="min-h-[44px]">
              <KanbanSquare className="h-4 w-4 mr-1" /> Tablica
            </Button>
          </Link>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="min-h-[44px] flex-1 sm:flex-initial"><Plus className="h-4 w-4 mr-1" /> Nowe zlecenie</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0">
              <DialogHeader className="p-6 pb-0"><DialogTitle>Nowe zlecenie serwisowe</DialogTitle></DialogHeader>
              <NewOrderForm
                onSubmit={(data) => createOrder.mutate({ ...data, created_by: user?.id })}
                loading={createOrder.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Szukaj po numerze, opisie..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 min-h-[44px]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 min-h-[44px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-full sm:w-48 min-h-[44px]"><SelectValue placeholder="Technik" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy technicy</SelectItem>
            <SelectItem value="unassigned">Nieprzypisane</SelectItem>
            {staffUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile card view */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Ładowanie...</div>
        ) : !orders?.length ? (
          <div className="text-center py-8 text-muted-foreground">Brak zleceń</div>
        ) : groupedOrders ? (
          groupedOrders.map((group) => {
            const collapsed = collapsedGroups.has(group.status);
            const barColor = STATUS_GROUP_COLORS[group.status];
            return (
              <div key={group.status} className="flex gap-0">
                <div className={`${barColor} w-1.5 rounded-sm shrink-0 ${collapsed ? "" : "opacity-80"}`} />
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => toggleGroup(group.status)}
                    className="flex items-center gap-2 py-2.5 px-2 w-full text-left"
                  >
                    {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <OrderStatusBadge status={group.status} />
                    <span className="text-xs text-muted-foreground">({group.orders.length})</span>
                  </button>
                  {!collapsed && (
                    <div className="space-y-2 pl-2 pb-3">
                      {group.orders.map((order: any) => (
                        <MobileOrderCard key={order.id} order={order} unread={unreadOrderIds.has(order.id)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          orders.map((order: any) => (
            <MobileOrderCard key={order.id} order={order} unread={unreadOrderIds.has(order.id)} />
          ))
        )}
      </div>

      {/* Desktop table view */}
      <div className="data-table-wrapper hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr zlecenia</TableHead>
              <TableHead>Dział</TableHead>
              <TableHead>Klient</TableHead>
              <TableHead>Urządzenie</TableHead>
              <TableHead>Technik</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priorytet</TableHead>
              <TableHead>Data przyjęcia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Ładowanie...</TableCell></TableRow>
            ) : !orders?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Brak zleceń</TableCell></TableRow>
            ) : groupedOrders ? (
              groupedOrders.map((group) => {
                const collapsed = collapsedGroups.has(group.status);
                const barColor = STATUS_GROUP_COLORS[group.status];
                return (
                  <React.Fragment key={`group-${group.status}`}>
                    <TableRow
                      className="hover:bg-muted/20 cursor-pointer select-none border-b-0"
                      onClick={() => toggleGroup(group.status)}
                    >
                      <TableCell colSpan={8} className="py-0 px-0">
                        <div className="flex items-stretch">
                          <div className={`${barColor} w-1.5 rounded-sm self-stretch shrink-0`} />
                          <div className="flex items-center gap-2 py-2.5 px-3">
                            {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            <OrderStatusBadge status={group.status} />
                            <span className="text-sm font-medium text-muted-foreground">({group.orders.length})</span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                    {!collapsed && group.orders.map((order: any) => (
                      <TableRow key={order.id} className={`hover:bg-muted/50 ${unreadOrderIds.has(order.id) ? "bg-primary/5" : ""}`}>
                        <TableCell className="py-0 px-0" colSpan={8}>
                          <div className="flex items-stretch">
                            <div className={`${barColor} w-1.5 shrink-0 opacity-40`} />
                            <table className="w-full"><tbody>
                              <tr>
                                <td className="py-2.5 px-3 w-[15%]">
                                  <div className="flex items-center gap-1.5">
                                    {unreadOrderIds.has(order.id) && <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />}
                                    <Link to={`/orders/${order.id}`} className="font-medium text-primary hover:underline font-mono">
                                      {order.order_number}
                                    </Link>
                                    <ScheduleBadgeWithAction orderId={order.id} orderNumber={order.order_number} date={order.planned_execution_date} time={order.planned_execution_time} />
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-xs w-[12%]">{DEPARTMENT_ICONS[order.service_type]} {DEPARTMENT_LABELS[order.service_type] || SERVICE_TYPE_LABELS[order.service_type as ServiceType]}</td>
                                <td className="py-2.5 px-3 w-[15%]">{order.clients?.display_name}</td>
                                <td className="py-2.5 px-3 text-sm w-[15%]">{order.devices ? `${order.devices.manufacturer} ${order.devices.model}` : "—"}</td>
                                <td className="py-2.5 px-3 w-[15%]">
                                  <div className="flex items-center gap-1">
                                    <TechnicianBadges orderId={order.id} compact />
                                    <QuickAssignButton orderId={order.id} orderNumber={order.order_number} />
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 w-[10%]"><OrderStatusBadge status={order.status} /></td>
                                <td className="py-2.5 px-3 text-sm w-[8%]">{ORDER_PRIORITY_LABELS[order.priority as OrderPriority]}</td>
                                <td className="py-2.5 px-3 text-sm w-[10%]">{new Date(order.received_at).toLocaleDateString("pl-PL")}</td>
                              </tr>
                            </tbody></table>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })
            ) : (
              orders.map((order: any) => (
                <DesktopOrderRow key={order.id} order={order} unread={unreadOrderIds.has(order.id)} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


// ── New Order Form (uses shared sections) ──
export function NewOrderForm({ onSubmit, loading }: {
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState<Record<string, any>>({
    service_type: "COMPUTER_SERVICE",
    priority: "NORMAL",
    intake_channel: "IN_PERSON",
  });

  const set = (field: string, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error("Wybierz klienta");
      return;
    }
    const pickup_code = String(Math.floor(1000 + Math.random() * 9000));
    const { _technicianId, ...rest } = formData;
    onSubmit({ ...rest, pickup_code, _technicianId } as any);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
      <ClientSection
        clientId={formData.client_id}
        onChange={(v) => { set("client_id", v); set("device_id", undefined); }}
      />
      <DeviceSection
        clientId={formData.client_id}
        deviceId={formData.device_id}
        onChange={(v) => set("device_id", v)}
      />
      <OrderDataSection formData={formData} onChange={set} />
      <TechnicianSelectSection
        technicianId={formData._technicianId}
        onChange={(v) => set("_technicianId", v)}
      />
      <DescriptionSection formData={formData} onChange={set} />

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Tworzenie..." : "Utwórz zlecenie"}
      </Button>
    </form>
  );
}
