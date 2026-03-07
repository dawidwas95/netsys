import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Send, Clock, User, Monitor } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  ORDER_STATUS_LABELS,
  ORDER_PRIORITY_LABELS,
  SERVICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  INTAKE_CHANNEL_LABELS,
  type OrderStatus,
  type OrderPriority,
  type IntakeChannel,
  type PaymentMethod,
} from "@/types/database";
import { OrderStatusBadge } from "@/pages/DashboardPage";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*, clients(display_name, phone, email), devices(manufacturer, model, serial_number, device_category)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: comments } = useQuery({
    queryKey: ["order-comments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_order_comments")
        .select("*")
        .eq("order_id", id!)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: logs } = useQuery({
    queryKey: ["order-logs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("entity_type", "service_order")
        .eq("entity_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const updateOrder = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase
        .from("service_orders")
        .update({ ...updates, updated_by: user?.id })
        .eq("id", id!);
      if (error) throw error;

      // Log activity
      await supabase.from("activity_logs").insert({
        entity_type: "service_order",
        entity_id: id!,
        action_type: "update",
        new_value_json: updates,
        user_id: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["order-logs", id] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      toast.success("Zlecenie zaktualizowane");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!comment.trim()) return;
      const { error } = await supabase.from("service_order_comments").insert({
        order_id: id!,
        user_id: user?.id,
        comment: comment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-comments", id] });
      setComment("");
      toast.success("Komentarz dodany");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Ładowanie...</p>;
  if (!order) return <p className="text-muted-foreground">Zlecenie nie znalezione</p>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/orders" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">{order.order_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <OrderStatusBadge status={order.status as OrderStatus} />
              <Badge variant="outline">{SERVICE_TYPE_LABELS[order.service_type as keyof typeof SERVICE_TYPE_LABELS]}</Badge>
              <Badge variant="outline">{ORDER_PRIORITY_LABELS[order.priority as OrderPriority]}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={order.status}
            onValueChange={(v) => {
              const updates: any = { status: v };
              if (v === "COMPLETED") updates.completed_at = new Date().toISOString();
              updateOrder.mutate(updates);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Zmień status" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Klient</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-medium">{(order as any).clients?.display_name}</div>
            {(order as any).clients?.phone && <div className="text-muted-foreground">{(order as any).clients.phone}</div>}
            {(order as any).clients?.email && <div className="text-muted-foreground">{(order as any).clients.email}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Urządzenie</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {(order as any).devices ? (
              <>
                <div className="font-medium flex items-center gap-1">
                  <Monitor className="h-4 w-4" />
                  {(order as any).devices.manufacturer} {(order as any).devices.model}
                </div>
                {(order as any).devices.serial_number && (
                  <div className="font-mono text-muted-foreground">S/N: {(order as any).devices.serial_number}</div>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Nie przypisano</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Informacje</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Przyjęto: {new Date(order.received_at).toLocaleDateString("pl-PL")}</div>
            {(order as any).profiles?.full_name && (
              <div className="flex items-center gap-1"><User className="h-3 w-3" /> {(order as any).profiles.full_name}</div>
            )}
            {order.intake_channel && <div>Kanał: {INTAKE_CHANNEL_LABELS[order.intake_channel as IntakeChannel]}</div>}
            {order.is_paid && <Badge className="bg-success text-success-foreground">Opłacone</Badge>}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Szczegóły</TabsTrigger>
          <TabsTrigger value="comments">Komentarze ({comments?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">Historia</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          {order.problem_description && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Opis problemu</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{order.problem_description}</CardContent>
            </Card>
          )}
          {order.client_description && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Opis klienta</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{order.client_description}</CardContent>
            </Card>
          )}
          {order.diagnosis && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Diagnoza</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{order.diagnosis}</CardContent>
            </Card>
          )}
          {order.repair_description && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Wykonane prace</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{order.repair_description}</CardContent>
            </Card>
          )}
          {order.accessories_received && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Akcesoria</CardTitle></CardHeader>
              <CardContent className="text-sm">{order.accessories_received}</CardContent>
            </Card>
          )}
          {order.visual_condition && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Stan wizualny</CardTitle></CardHeader>
              <CardContent className="text-sm">{order.visual_condition}</CardContent>
            </Card>
          )}
          {order.internal_notes && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Notatki wewnętrzne</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{order.internal_notes}</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {comments?.map((c: any) => (
                <div key={c.id} className="border-b pb-3 last:border-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <User className="h-3 w-3" />
                    {c.profiles?.full_name ?? "—"}
                    <span>·</span>
                    <Clock className="h-3 w-3" />
                    {new Date(c.created_at).toLocaleString("pl-PL")}
                  </div>
                  <p className="text-sm">{c.comment}</p>
                </div>
              ))}

              <div className="flex gap-2">
                <Textarea
                  placeholder="Dodaj komentarz..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={() => addComment.mutate()}
                  disabled={!comment.trim() || addComment.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {!logs?.length ? (
                <p className="text-sm text-muted-foreground">Brak historii</p>
              ) : (
                <div className="space-y-3">
                  {logs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3 text-sm border-b pb-3 last:border-0">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("pl-PL")}
                          {log.profiles?.full_name && ` · ${log.profiles.full_name}`}
                        </div>
                        <div className="mt-0.5">
                          <Badge variant="outline" className="text-xs">{log.action_type}</Badge>
                          {log.new_value_json && (
                            <pre className="text-xs text-muted-foreground mt-1 bg-muted p-1 rounded overflow-x-auto">
                              {JSON.stringify(log.new_value_json, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
