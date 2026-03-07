import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, KanbanSquare } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ORDER_STATUS_LABELS,
  ORDER_PRIORITY_LABELS,
  SERVICE_TYPE_LABELS,
  INTAKE_CHANNEL_LABELS,
  type OrderStatus,
  type OrderPriority,
  type ServiceType,
  type IntakeChannel,
  type ServiceOrderInsert,
} from "@/types/database";
import { OrderStatusBadge } from "@/pages/DashboardPage";

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

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      if (search) {
        query = query.or(
          `order_number.ilike.%${search}%,problem_description.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, display_name")
        .eq("is_active", true)
        .order("display_name");
      return data ?? [];
    },
  });

  const createOrder = useMutation({
    mutationFn: async (data: ServiceOrderInsert) => {
      const { error } = await supabase.from("service_orders").insert({
        ...data,
        order_number: "TEMP", // trigger will override
      });
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
              <KanbanSquare className="h-4 w-4 mr-1" /> Kanban
            </Button>
          </Link>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Nowe zlecenie</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nowe zlecenie serwisowe</DialogTitle></DialogHeader>
              <OrderForm
                clients={clients ?? []}
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
          <Input
            placeholder="Szukaj po numerze, opisie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
              <TableHead>Pracownik</TableHead>
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
                  <TableCell className="text-sm">{order.profiles?.full_name ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function OrderForm({
  clients,
  onSubmit,
  loading,
}: {
  clients: { id: string; display_name: string }[];
  onSubmit: (data: ServiceOrderInsert) => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<ServiceOrderInsert>>({
    service_type: "COMPUTER_SERVICE",
    priority: "NORMAL",
    intake_channel: "IN_PERSON",
  });

  const set = (field: keyof ServiceOrderInsert, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error("Wybierz klienta");
      return;
    }
    onSubmit(formData as ServiceOrderInsert);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Klient *</Label>
        <Select onValueChange={(v) => set("client_id", v)}>
          <SelectTrigger><SelectValue placeholder="Wybierz klienta" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Typ serwisu</Label>
          <Select value={formData.service_type} onValueChange={(v) => set("service_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(SERVICE_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Priorytet</Label>
          <Select value={formData.priority} onValueChange={(v) => set("priority", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ORDER_PRIORITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Kanał przyjęcia</Label>
        <Select value={formData.intake_channel ?? "IN_PERSON"} onValueChange={(v) => set("intake_channel", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(INTAKE_CHANNEL_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Opis problemu</Label>
        <Textarea rows={3} onChange={(e) => set("problem_description", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Opis klienta</Label>
        <Textarea rows={2} onChange={(e) => set("client_description", e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Akcesoria otrzymane</Label>
          <Input onChange={(e) => set("accessories_received", e.target.value)} placeholder="np. ładowarka, torba" />
        </div>
        <div className="space-y-1.5">
          <Label>Stan wizualny</Label>
          <Input onChange={(e) => set("visual_condition", e.target.value)} placeholder="np. zarysowania" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Kod blokady</Label>
        <Input onChange={(e) => set("lock_code", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Notatki wewnętrzne</Label>
        <Textarea rows={2} onChange={(e) => set("internal_notes", e.target.value)} />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Zapisywanie..." : "Utwórz zlecenie"}
      </Button>
    </form>
  );
}
