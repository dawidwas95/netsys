import { useState } from "react";
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
import { Plus, Search, KanbanSquare, User } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { TechnicianBadges, QuickAssignButton } from "@/components/TechnicianAssignment";
import {
  ORDER_STATUS_LABELS, ORDER_PRIORITY_LABELS, SERVICE_TYPE_LABELS,
  type OrderStatus, type OrderPriority, type ServiceType,
  type ServiceOrderInsert,
} from "@/types/database";
import { OrderStatusBadge } from "@/pages/DashboardPage";
import {
  ClientSection, DeviceSection, OrderDataSection, DescriptionSection,
} from "@/components/order/OrderFormSections";

export default function ServiceOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["service-orders", search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("service_orders")
        .select("*, clients(display_name), devices(manufacturer, model)")
        .order("received_at", { ascending: false });

      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (search) query = query.or(`order_number.ilike.%${search}%,problem_description.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createOrder = useMutation({
    mutationFn: async (data: ServiceOrderInsert) => {
      const { error } = await supabase.from("service_orders").insert(data as any);
      if (error) throw error;
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
        <div className="flex items-center gap-2">
          <Link to="/orders/kanban">
            <Button variant="outline" size="sm">
              <KanbanSquare className="h-4 w-4 mr-1" /> Tablica
            </Button>
          </Link>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Nowe zlecenie</Button>
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

      <div className="mb-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Szukaj po numerze, opisie..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="data-table-wrapper">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr zlecenia</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Klient</TableHead>
              <TableHead>Urządzenie</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priorytet</TableHead>
              <TableHead>Data przyjęcia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Ładowanie...</TableCell></TableRow>
            ) : !orders?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Brak zleceń</TableCell></TableRow>
            ) : (
              orders.map((order: any) => (
                <TableRow key={order.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link to={`/orders/${order.id}`} className="font-medium text-primary hover:underline font-mono">
                      {order.order_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{SERVICE_TYPE_LABELS[order.service_type as ServiceType]}</TableCell>
                  <TableCell>{order.clients?.display_name}</TableCell>
                  <TableCell className="text-sm">
                    {order.devices ? `${order.devices.manufacturer} ${order.devices.model}` : "—"}
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

// ── New Order Form (uses shared sections) ──
function NewOrderForm({ onSubmit, loading }: {
  onSubmit: (data: ServiceOrderInsert) => void;
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
    // Generate random 4-digit pickup code
    const pickup_code = String(Math.floor(1000 + Math.random() * 9000));
    onSubmit({ ...formData, pickup_code } as ServiceOrderInsert);
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
      <DescriptionSection formData={formData} onChange={set} />

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Tworzenie..." : "Utwórz zlecenie"}
      </Button>
    </form>
  );
}
