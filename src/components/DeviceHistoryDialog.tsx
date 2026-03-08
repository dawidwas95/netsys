import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClipboardList, Banknote, CalendarDays, ExternalLink, Wrench, User } from "lucide-react";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/types/database";
import { OrderStatusBadge } from "@/pages/DashboardPage";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

function fmt(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

interface DeviceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string;
  deviceName: string;
}

export function DeviceHistoryDialog({ open, onOpenChange, deviceId, deviceName }: DeviceHistoryDialogProps) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["device-history", deviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("id, order_number, status, received_at, completed_at, problem_description, diagnosis, repair_description, total_gross, total_net")
        .eq("device_id", deviceId)
        .order("received_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!deviceId,
  });

  // Fetch technicians for all orders
  const orderIds = orders.map((o: any) => o.id);
  const { data: technicians = [] } = useQuery({
    queryKey: ["device-history-techs", orderIds],
    queryFn: async () => {
      if (!orderIds.length) return [];
      const { data } = await supabase
        .from("order_technicians")
        .select("order_id, user_id, is_primary")
        .in("order_id", orderIds);
      return data ?? [];
    },
    enabled: open && orderIds.length > 0,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, first_name, last_name, email");
      return data ?? [];
    },
    enabled: open,
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p: any) => {
      map[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "?";
    });
    return map;
  }, [profiles]);

  const techByOrder = useMemo(() => {
    const map: Record<string, string[]> = {};
    technicians.forEach((t: any) => {
      if (!map[t.order_id]) map[t.order_id] = [];
      const name = profileMap[t.user_id] || "?";
      map[t.order_id].push(name);
    });
    return map;
  }, [technicians, profileMap]);

  const stats = useMemo(() => {
    const total = orders.length;
    const totalValue = orders.reduce((s: number, o: any) => s + (Number(o.total_gross) || 0), 0);
    const lastDate = orders.length > 0 ? orders[0].received_at : null;
    return { total, totalValue, lastDate };
  }, [orders]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Historia urządzenia — {deviceName}
          </DialogTitle>
        </DialogHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="flex items-center gap-2.5 p-3">
              <div className="rounded-md bg-primary/10 p-2">
                <ClipboardList className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Naprawy</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-2.5 p-3">
              <div className="rounded-md bg-primary/10 p-2">
                <Banknote className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Łączna wartość</p>
                <p className="text-lg font-bold">{fmt(stats.totalValue)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-2.5 p-3">
              <div className="rounded-md bg-primary/10 p-2">
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ostatnia naprawa</p>
                <p className="text-sm font-bold">
                  {stats.lastDate ? new Date(stats.lastDate).toLocaleDateString("pl-PL") : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Orders list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Ładowanie...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Brak historii napraw dla tego urządzenia.</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {orders.map((o: any) => (
                <Link key={o.id} to={`/orders/${o.id}`} onClick={() => onOpenChange(false)} className="block">
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-primary text-sm">{o.order_number}</span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      {o.diagnosis && (
                        <div className="text-xs"><span className="text-muted-foreground">Diagnoza:</span> {o.diagnosis}</div>
                      )}
                      {o.repair_description && (
                        <div className="text-xs"><span className="text-muted-foreground">Naprawa:</span> {o.repair_description}</div>
                      )}
                      {!o.diagnosis && !o.repair_description && o.problem_description && (
                        <div className="text-xs text-muted-foreground truncate">{o.problem_description}</div>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(o.received_at).toLocaleDateString("pl-PL")}</span>
                        <div className="flex items-center gap-2">
                          {techByOrder[o.id]?.length > 0 && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {techByOrder[o.id].join(", ")}
                            </span>
                          )}
                          {o.total_gross > 0 && <span className="font-medium text-foreground">{fmt(o.total_gross)}</span>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr zlecenia</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Diagnoza / Naprawa</TableHead>
                    <TableHead>Technik</TableHead>
                    <TableHead className="text-right">Kwota brutto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o: any) => (
                    <TableRow key={o.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Link
                          to={`/orders/${o.id}`}
                          onClick={() => onOpenChange(false)}
                          className="font-mono text-primary hover:underline text-sm flex items-center gap-1"
                        >
                          {o.order_number}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(o.received_at).toLocaleDateString("pl-PL")}
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {o.diagnosis && (
                          <p className="text-xs truncate"><span className="text-muted-foreground">Diagnoza:</span> {o.diagnosis}</p>
                        )}
                        {o.repair_description && (
                          <p className="text-xs truncate"><span className="text-muted-foreground">Naprawa:</span> {o.repair_description}</p>
                        )}
                        {!o.diagnosis && !o.repair_description && (
                          <p className="text-xs text-muted-foreground truncate">{o.problem_description || "—"}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {techByOrder[o.id]?.length > 0
                          ? techByOrder[o.id].join(", ")
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {o.total_gross > 0 ? fmt(o.total_gross) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
