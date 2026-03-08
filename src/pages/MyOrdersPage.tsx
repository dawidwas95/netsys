import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, Clock, Wrench, PackageCheck, MessageSquare,
  CheckCircle, AlertTriangle, ArrowRight, ScanLine,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { OrderStatusBadge } from "@/pages/DashboardPage";
import {
  ORDER_STATUS_LABELS, ORDER_PRIORITY_LABELS,
  type OrderStatus, type OrderPriority,
} from "@/types/database";
import { toast } from "sonner";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-primary/10 text-primary",
  HIGH: "bg-warning/10 text-warning",
  URGENT: "bg-destructive/10 text-destructive",
};

const QUICK_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "DIAGNOSIS", label: "Diagnostyka" },
  { value: "IN_PROGRESS", label: "W trakcie" },
  { value: "WAITING_CLIENT", label: "Kontakt z klientem" },
  { value: "READY_FOR_RETURN", label: "Do zwrotu" },
  { value: "COMPLETED", label: "Zakończone" },
];

export default function MyOrdersPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  // Quick status change state
  const [statusDialog, setStatusDialog] = useState<{ orderId: string; current: OrderStatus } | null>(null);
  // Comment dialog state
  const [commentDialog, setCommentDialog] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // --- Queries ---
  const { data: myTechRows = [] } = useQuery({
    queryKey: ["my-tech-rows", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_technicians")
        .select("order_id")
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const orderIds = myTechRows.map((r: any) => r.order_id);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", orderIds, statusFilter],
    queryFn: async () => {
      if (!orderIds.length) return [];

      let query = supabase
        .from("service_orders")
        .select("id, order_number, status, priority, problem_description, received_at, estimated_completion_date, completed_at, clients(display_name), devices(manufacturer, model)")
        .in("id", orderIds)
        .order("received_at", { ascending: false });

      if (statusFilter === "active") {
        query = query.not("status", "in", '("COMPLETED","ARCHIVED","CANCELLED")');
      } else if (statusFilter === "waiting_parts") {
        query = query.eq("status", "WAITING_CLIENT" as any);
      } else if (statusFilter === "ready") {
        query = query.eq("status", "READY_FOR_RETURN" as any);
      } else if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: orderIds.length > 0,
  });

  // --- Counters ---
  const counters = {
    active: 0,
    waiting: 0,
    ready: 0,
    completedToday: 0,
  };

  const { data: allMyOrders = [] } = useQuery({
    queryKey: ["my-orders-counters", orderIds],
    queryFn: async () => {
      if (!orderIds.length) return [];
      const { data } = await supabase
        .from("service_orders")
        .select("status, completed_at")
        .in("id", orderIds);
      return data ?? [];
    },
    enabled: orderIds.length > 0,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  allMyOrders.forEach((o: any) => {
    if (!["COMPLETED", "ARCHIVED", "CANCELLED"].includes(o.status)) counters.active++;
    if (o.status === "WAITING_CLIENT") counters.waiting++;
    if (o.status === "READY_FOR_RETURN") counters.ready++;
    if (o.status === "COMPLETED" && o.completed_at && new Date(o.completed_at) >= today) counters.completedToday++;
  });

  // --- Mutations ---
  const changeStatus = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: OrderStatus }) => {
      const update: any = { status: newStatus, updated_by: user?.id };
      if (newStatus === "COMPLETED") update.completed_at = new Date().toISOString();
      const { error } = await supabase.from("service_orders").update(update).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["my-orders-counters"] });
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      toast.success("Status zmieniony");
      setStatusDialog(null);
    },
  });

  const addComment = useMutation({
    mutationFn: async ({ orderId, comment }: { orderId: string; comment: string }) => {
      const { error } = await supabase.from("service_order_comments").insert({
        order_id: orderId,
        comment,
        user_id: user?.id,
        is_internal: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Komentarz dodany");
      setCommentDialog(null);
      setCommentText("");
    },
  });

  // --- Filter ---
  const filtered = search
    ? orders.filter((o: any) =>
        o.order_number.toLowerCase().includes(search.toLowerCase()) ||
        o.problem_description?.toLowerCase().includes(search.toLowerCase()) ||
        o.clients?.display_name?.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  const counterCards = [
    { label: "Aktywne", value: counters.active, icon: Wrench, color: "text-primary" },
    { label: "Oczekujące", value: counters.waiting, icon: AlertTriangle, color: "text-warning" },
    { label: "Do zwrotu", value: counters.ready, icon: PackageCheck, color: "text-accent-foreground" },
    { label: "Dziś zakończone", value: counters.completedToday, icon: CheckCircle, color: "text-emerald-500" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Moje zlecenia</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} zleceń przypisanych do Ciebie</p>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {counterCards.map((c) => (
          <Card key={c.label} className="p-3">
            <div className="flex items-center gap-2">
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <div>
                <div className="text-lg font-bold">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
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
            <SelectItem value="waiting_parts">Oczekujące</SelectItem>
            <SelectItem value="ready">Do zwrotu</SelectItem>
            {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders list */}
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
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <Link to={`/orders/${order.id}`} className="font-mono font-medium text-primary hover:underline">
                    {order.order_number}
                  </Link>
                  <OrderStatusBadge status={order.status} />
                </div>

                {/* Info */}
                <div className="text-sm font-medium">{order.clients?.display_name || "—"}</div>
                {order.devices && (
                  <div className="text-xs text-muted-foreground">
                    {order.devices.manufacturer} {order.devices.model}
                  </div>
                )}
                {order.problem_description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{order.problem_description}</p>
                )}

                {/* Priority & date */}
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[order.priority] || ""}`}>
                    {ORDER_PRIORITY_LABELS[order.priority as OrderPriority]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.received_at).toLocaleDateString("pl-PL")}
                  </span>
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap gap-2 pt-1 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[36px] text-xs"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <ArrowRight className="h-3 w-3 mr-1" />
                    Otwórz
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[36px] text-xs"
                    onClick={() => setStatusDialog({ orderId: order.id, current: order.status })}
                  >
                    <Wrench className="h-3 w-3 mr-1" />
                    Status
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[36px] text-xs"
                    onClick={() => setCommentDialog(order.id)}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Notatka
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick status change dialog */}
      <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zmień status</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 py-2">
            {QUICK_STATUSES.map((s) => (
              <Button
                key={s.value}
                variant={statusDialog?.current === s.value ? "default" : "outline"}
                className="min-h-[44px] justify-start"
                disabled={statusDialog?.current === s.value || changeStatus.isPending}
                onClick={() => statusDialog && changeStatus.mutate({ orderId: statusDialog.orderId, newStatus: s.value })}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Comment dialog */}
      <Dialog open={!!commentDialog} onOpenChange={() => { setCommentDialog(null); setCommentText(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dodaj notatkę wewnętrzną</DialogTitle>
          </DialogHeader>
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Treść notatki..."
            rows={4}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button
              disabled={!commentText.trim() || addComment.isPending}
              onClick={() => commentDialog && addComment.mutate({ orderId: commentDialog, comment: commentText })}
              className="min-h-[44px]"
            >
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
