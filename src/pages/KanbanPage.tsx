import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  KANBAN_COLUMNS,
  ORDER_PRIORITY_LABELS,
  SERVICE_TYPE_LABELS,
  DEPARTMENT_LABELS,
  DEPARTMENT_ICONS,
  type OrderStatus,
  type ServiceOrderWithRelations,
} from "@/types/database";
import { OrderStatusBadge } from "@/pages/DashboardPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Calendar, User, Monitor, AlertTriangle, CheckCircle, UserPlus, Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { TechnicianBadges, QuickAssignButton } from "@/components/TechnicianAssignment";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { NewOrderForm } from "@/pages/ServiceOrdersPage";
import { type ServiceOrderInsert } from "@/types/database";

export default function KanbanPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [activeOrder, setActiveOrder] = useState<ServiceOrderWithRelations | null>(null);
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const { data: orders = [] } = useQuery({
    queryKey: ["kanban-orders", search, deptFilter],
    queryFn: async () => {
      let query = supabase
        .from("service_orders")
        .select("*, clients(display_name, phone), devices(manufacturer, model)")
        .not("status", "in", '("ARCHIVED","CANCELLED")')
        .order("received_at", { ascending: false });

      if (deptFilter !== "all") query = query.eq("service_type", deptFilter as any);
      if (search) {
        query = query.or(
          `order_number.ilike.%${search}%,problem_description.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ServiceOrderWithRelations[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const updates: any = { status };
      if (status === "COMPLETED") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("service_orders").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      toast.success("Status zaktualizowany");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleDragStart = (event: DragStartEvent) => {
    const order = orders.find((o) => o.id === event.active.id);
    setActiveOrder(order ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOrder(null);
    const { active, over } = event;
    if (!over) return;

    const orderId = active.id as string;
    const newStatus = over.id as OrderStatus;
    const order = orders.find((o) => o.id === orderId);

    if (order && order.status !== newStatus) {
      updateStatus.mutate({ id: orderId, status: newStatus });
    }
  };

  const getColumnOrders = (status: OrderStatus) =>
    orders.filter((o) => o.status === status);

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
            {deptFilter === "all" ? "Tablica zleceń" : `${DEPARTMENT_ICONS[deptFilter]} ${DEPARTMENT_LABELS[deptFilter]}`}
          </h1>
          <p className="text-muted-foreground text-sm">{orders.length} zleceń</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Link to="/orders" className="text-sm text-muted-foreground hover:text-primary">
            Widok listy →
          </Link>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => {
            const colOrders = getColumnOrders(col.status);
            return (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                color={col.color}
                count={colOrders.length}
              >
                {colOrders.map((order) => (
                  <KanbanCard key={order.id} order={order} />
                ))}
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeOrder && <KanbanCardContent order={activeOrder} isDragging />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  color,
  count,
  children,
}: {
  status: OrderStatus;
  label: string;
  color: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column ${isOver ? "ring-2 ring-primary/50" : ""}`}
    >
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {count}
        </span>
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-250px)]">
        {children}
      </div>
    </div>
  );
}

function KanbanCard({ order }: { order: ServiceOrderWithRelations }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <KanbanCardContent order={order} />
    </div>
  );
}

function KanbanCardContent({
  order,
  isDragging,
}: {
  order: ServiceOrderWithRelations;
  isDragging?: boolean;
}) {
  const priorityColors: Record<string, string> = {
    LOW: "bg-priority-low/10 text-priority-low",
    NORMAL: "bg-priority-normal/10 text-priority-normal",
    HIGH: "bg-priority-high/10 text-priority-high",
    URGENT: "bg-priority-urgent/10 text-priority-urgent",
  };

  return (
    <Link
      to={`/orders/${order.id}`}
      className={`kanban-card block ${isDragging ? "shadow-lg ring-2 ring-primary" : ""}`}
      onClick={(e) => isDragging && e.preventDefault()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono font-medium text-primary">
          {order.order_number}
        </span>
        <span className={`status-badge text-[10px] ${priorityColors[order.priority]}`}>
          {ORDER_PRIORITY_LABELS[order.priority]}
        </span>
      </div>

      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium truncate">
          {(order as any).clients?.display_name ?? "—"}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
          {DEPARTMENT_ICONS[order.service_type]}
        </span>
      </div>

      {(order as any).devices && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <Monitor className="h-3 w-3" />
          {(order as any).devices.manufacturer} {(order as any).devices.model}
        </div>
      )}

      {order.problem_description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {order.problem_description}
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(order.received_at).toLocaleDateString("pl-PL")}
        </div>
        <div className="flex items-center gap-2">
          {order.is_paid && (
            <CheckCircle className="h-3 w-3 text-success" />
          )}
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {SERVICE_TYPE_LABELS[order.service_type]}
          </Badge>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <TechnicianBadges orderId={order.id} compact />
        <QuickAssignButton orderId={order.id} orderNumber={order.order_number} />
      </div>
    </Link>
  );
}
