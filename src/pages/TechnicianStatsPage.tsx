import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, CheckCircle, Clock, TrendingUp, Wrench, CalendarDays, BarChart3,
} from "lucide-react";
import { useMemo } from "react";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

function formatDays(avgMs: number) {
  const days = avgMs / (1000 * 60 * 60 * 24);
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${days.toFixed(1)} dn.`;
}

interface TechStats {
  userId: string;
  name: string;
  totalAssigned: number;
  active: number;
  completed: number;
  completedToday: number;
  completedMonth: number;
  avgCompletionMs: number;
  totalRevenue: number;
}

export default function TechnicianStatsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["technician-stats"],
    queryFn: async () => {
      // Get technicians (profiles with ADMIN or SERWISANT role)
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["ADMIN", "SERWISANT"]);

      if (!roles?.length) return [];

      const techUserIds = roles.map((r) => r.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, full_name")
        .in("user_id", techUserIds);

      // Get all assignments
      const { data: assignments } = await supabase
        .from("order_technicians")
        .select("order_id, user_id");

      // Get all orders with relevant fields
      const { data: orders } = await supabase
        .from("service_orders")
        .select("id, status, received_at, completed_at, total_gross");

      if (!profiles || !assignments || !orders) return [];

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const orderMap = new Map(orders.map((o) => [o.id, o]));

      const result: TechStats[] = profiles.map((p) => {
        const name = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—";
        const myAssignments = assignments.filter((a) => a.user_id === p.user_id);
        const myOrders = myAssignments
          .map((a) => orderMap.get(a.order_id))
          .filter(Boolean) as typeof orders;

        const active = myOrders.filter(
          (o) => !["COMPLETED", "ARCHIVED", "CANCELLED"].includes(o.status)
        ).length;

        const completed = myOrders.filter((o) => o.status === "COMPLETED").length;

        const completedToday = myOrders.filter(
          (o) => o.status === "COMPLETED" && o.completed_at && new Date(o.completed_at) >= today
        ).length;

        const completedMonth = myOrders.filter(
          (o) => o.status === "COMPLETED" && o.completed_at && new Date(o.completed_at) >= monthStart
        ).length;

        // Avg completion time
        const completedWithDates = myOrders.filter(
          (o) => o.status === "COMPLETED" && o.completed_at && o.received_at
        );
        const avgCompletionMs =
          completedWithDates.length > 0
            ? completedWithDates.reduce(
                (sum, o) =>
                  sum + (new Date(o.completed_at!).getTime() - new Date(o.received_at).getTime()),
                0
              ) / completedWithDates.length
            : 0;

        const totalRevenue = myOrders
          .filter((o) => o.status === "COMPLETED")
          .reduce((s, o) => s + Number(o.total_gross || 0), 0);

        return {
          userId: p.user_id,
          name,
          totalAssigned: myOrders.length,
          active,
          completed,
          completedToday,
          completedMonth,
          avgCompletionMs,
          totalRevenue,
        };
      });

      return result.sort((a, b) => b.completedMonth - a.completedMonth);
    },
    staleTime: 60_000,
  });

  const totals = useMemo(() => {
    if (!stats?.length) return null;
    return {
      totalAssigned: stats.reduce((s, t) => s + t.totalAssigned, 0),
      active: stats.reduce((s, t) => s + t.active, 0),
      completed: stats.reduce((s, t) => s + t.completed, 0),
      completedToday: stats.reduce((s, t) => s + t.completedToday, 0),
      completedMonth: stats.reduce((s, t) => s + t.completedMonth, 0),
      totalRevenue: stats.reduce((s, t) => s + t.totalRevenue, 0),
    };
  }, [stats]);

  const maxCompleted = useMemo(
    () => Math.max(...(stats?.map((s) => s.completedMonth) ?? [1]), 1),
    [stats]
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statystyki techników</h1>
          <p className="text-muted-foreground text-sm">Wydajność i obciążenie pracowników</p>
        </div>
      </div>

      {/* Summary KPIs */}
      {totals && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Technicy</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats?.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Aktywne zlec.</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totals.active}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Zakończ. dziś</CardTitle>
              <CheckCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totals.completedToday}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Zakończ. mies.</CardTitle>
              <CalendarDays className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totals.completedMonth}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Łączne zakończ.</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totals.completed}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Przychód brutto</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-lg font-bold">{formatCurrency(totals.totalRevenue)}</div></CardContent>
          </Card>
        </div>
      )}

      {/* Per-technician table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Wyniki poszczególnych techników
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Ładowanie...</p>
          ) : !stats?.length ? (
            <p className="text-sm text-muted-foreground">Brak danych</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technik</TableHead>
                  <TableHead className="text-center">Przypisane</TableHead>
                  <TableHead className="text-center">Aktywne</TableHead>
                  <TableHead className="text-center">Zakończ. dziś</TableHead>
                  <TableHead className="text-center">Zakończ. mies.</TableHead>
                  <TableHead className="text-center">Łącznie zakończ.</TableHead>
                  <TableHead className="text-center">Śr. czas</TableHead>
                  <TableHead className="text-right">Przychód brutto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((t) => {
                  const completionRate = t.totalAssigned > 0
                    ? Math.round((t.completed / t.totalAssigned) * 100)
                    : 0;
                  return (
                    <TableRow key={t.userId}>
                      <TableCell>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Ukończono {completionRate}% przypisanych
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{t.totalAssigned}</TableCell>
                      <TableCell className="text-center">
                        {t.active > 0 ? (
                          <Badge variant="secondary">{t.active}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {t.completedToday > 0 ? (
                          <Badge variant="default">{t.completedToday}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2">
                          <span className="font-medium w-6 text-right">{t.completedMonth}</span>
                          <Progress
                            value={(t.completedMonth / maxCompleted) * 100}
                            className="h-2 flex-1 min-w-[60px]"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">{t.completed}</TableCell>
                      <TableCell className="text-center text-sm">
                        {t.avgCompletionMs > 0 ? formatDays(t.avgCompletionMs) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(t.totalRevenue)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
