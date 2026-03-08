import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { Plus, Search, KanbanSquare, User, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { TechnicianBadges, QuickAssignButton } from "@/components/TechnicianAssignment";
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

export default function ServiceOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [techFilter, setTechFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
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

  // Set default dept filter from profile on first load
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
      // If filtering by technician, first get matching order IDs
      let techOrderIds: string[] | null = null;
      if (techFilter === "unassigned") {
        // Get all order IDs that HAVE a technician
        const { data: assignedRows } = await supabase
          .from("order_technicians")
          .select("order_id");
        const assignedOrderIds = new Set((assignedRows ?? []).map((r: any) => r.order_id));
        techOrderIds = []; // will be used as "exclude these" below
        // We'll handle this differently: fetch all orders then filter
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

  const createOrder = useMutation({
    mutationFn: async (data: ServiceOrderInsert & { _technicianId?: string }) => {
      const { _technicianId, ...orderData } = data;
      const { data: inserted, error } = await supabase.from("service_orders").insert(orderData as any).select("id, order_number").single();
      if (error) throw error;

      // Auto-assign technician if selected
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
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zlecenia serwisowe</h1>
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
         <Select value={deptFilter} onValueChange={setDeptFilter}>
           <SelectTrigger className="w-full sm:w-52 min-h-[44px]"><SelectValue placeholder="Dział serwisu" /></SelectTrigger>
           <SelectContent>
             <SelectItem value="all">Wszystkie działy</SelectItem>
             {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => (
               <SelectItem key={k} value={k}>{DEPARTMENT_ICONS[k]} {v}</SelectItem>
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
        ) : (
          orders.map((order: any) => (
            <Link key={order.id} to={`/orders/${order.id}`} className="mobile-data-card block">
              <div className="mobile-card-header">
                <span className="font-medium font-mono text-primary">{order.order_number}</span>
                <div className="flex items-center gap-1">
                  <ScheduleBadge date={(order as any).planned_execution_date} time={(order as any).planned_execution_time} />
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Dział</span>
                <span className="text-sm">{DEPARTMENT_ICONS[order.service_type]} {DEPARTMENT_LABELS[order.service_type] || "—"}</span>
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
          ))
        )}
      </div>

      {/* Desktop table view */}
      <div className="data-table-wrapper hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr zlecenia</TableHead>
              <TableHead>Typ</TableHead>
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
            ) : (
              orders.map((order: any) => (
                <TableRow key={order.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Link to={`/orders/${order.id}`} className="font-medium text-primary hover:underline font-mono">
                        {order.order_number}
                      </Link>
                      <ScheduleBadge date={(order as any).planned_execution_date} time={(order as any).planned_execution_time} />
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{SERVICE_TYPE_LABELS[order.service_type as ServiceType]}</TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ScheduleBadge({ date, time }: { date?: string; time?: string }) {
  if (!date) return null;
  const today = new Date().toISOString().split("T")[0];
  const isToday = date === today;
  const isOverdue = date < today;

  if (isToday) {
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
        📅 {time ? time.slice(0, 5) : "Dziś"}
      </Badge>
    );
  }
  if (isOverdue) {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
        ⚠ Zaległe
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 text-muted-foreground">
      📅 {new Date(date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
    </Badge>
  );
}

// ── New Order Form (uses shared sections) ──
function NewOrderForm({ onSubmit, loading }: {
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
