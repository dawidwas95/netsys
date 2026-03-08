import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ShoppingCart, Package, ExternalLink, Pencil, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PurchaseRequestFormDialog } from "./PurchaseRequestFormDialog";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nowe", TO_ORDER: "Do zamówienia", ORDERED: "Zamówione",
  DELIVERED: "Dostarczone", INSTALLED: "Zamontowane", CANCELLED: "Anulowane",
};
const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  TO_ORDER: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  ORDERED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  INSTALLED: "bg-primary/10 text-primary",
  CANCELLED: "bg-muted text-muted-foreground",
};
const STATUS_ICONS: Record<string, string> = {
  NEW: "🆕", TO_ORDER: "📋", ORDERED: "📦", DELIVERED: "✅", INSTALLED: "🔧", CANCELLED: "❌",
};
const ALL_STATUSES = ["NEW", "TO_ORDER", "ORDERED", "DELIVERED", "INSTALLED", "CANCELLED"];

interface OrderPurchaseRequestsProps {
  orderId: string;
  repairApprovalStatus?: string;
}

export function OrderPurchaseRequests({ orderId, repairApprovalStatus }: OrderPurchaseRequestsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const showApprovalWarning = repairApprovalStatus && repairApprovalStatus !== "NONE" && repairApprovalStatus !== "APPROVED_BY_CUSTOMER";

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["purchase-requests", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requests").select("*")
        .eq("order_id", orderId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, itemName }: { id: string; status: string; itemName: string }) => {
      const { error } = await supabase.from("purchase_requests").update({
        status: status as any,
        status_changed_by: user?.id,
        status_changed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;

      // When part is DELIVERED, notify assigned technicians
      if (status === "DELIVERED") {
        // Fetch assigned technicians for this order
        const { data: techs } = await supabase
          .from("order_technicians")
          .select("user_id")
          .eq("order_id", orderId);

        const { data: orderData } = await supabase
          .from("service_orders")
          .select("order_number")
          .eq("id", orderId)
          .single();

        if (techs && techs.length > 0 && orderData) {
          // Create notification for each technician
          const notifications = techs.map((t: any) => ({
            user_id: t.user_id,
            title: `📦 Część dostarczona: ${itemName}`,
            body: `Część "${itemName}" dla zlecenia ${orderData.order_number} została dostarczona i czeka na montaż.`,
            type: "PART_DELIVERED",
            related_order_id: orderId,
          }));

          await supabase.from("notifications").insert(notifications);

          // Mark order as unread for technicians
          const { data: existingReads } = await supabase
            .from("notifications")
            .select("user_id")
            .eq("related_order_id", orderId)
            .eq("type", "PART_DELIVERED")
            .eq("is_read", false);

          // The notification insertion above already handles the unread state
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requests", orderId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-requests-global"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Status zaktualizowany");
    },
    onError: () => toast.error("Błąd aktualizacji statusu"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requests", orderId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-requests-global"] });
      toast.success("Zapotrzebowanie usunięte");
      setDeleteConfirm(null);
    },
    onError: () => toast.error("Nie udało się usunąć"),
  });

  const formatCurrency = (v: number) => v > 0 ? `${v.toFixed(2)} zł` : null;

  const handleEdit = (r: any) => {
    setEditingRequest(r);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingRequest(null);
    setDialogOpen(true);
  };

  const handleQuickStatus = (r: any, newStatus: string) => {
    updateStatus.mutate({ id: r.id, status: newStatus, itemName: r.item_name });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Zapotrzebowanie ({requests.length})
          </span>
          <Button size="sm" variant="outline" onClick={handleAdd}><Plus className="mr-1 h-3 w-3" /> Dodaj</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showApprovalWarning && (
          <div className="flex items-center gap-2 p-2.5 mb-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {repairApprovalStatus === "WAITING_FOR_CUSTOMER"
                ? "Klient nie zaakceptował jeszcze kosztu naprawy. Zamówienie części może być przedwczesne."
                : "Klient odrzucił koszt naprawy. Rozważ anulowanie zamówień części."}
            </span>
          </div>
        )}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Ładowanie...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak zapotrzebowań dla tego zlecenia.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r: any) => (
              <div key={r.id} className="border rounded-md p-2.5 text-sm space-y-1.5">
                {/* Header row: name + status badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-base">{STATUS_ICONS[r.status] || "📦"}</span>
                    <span className="font-medium">{r.item_name}</span>
                    <span className="text-muted-foreground">×{r.quantity}</span>
                    {r.urgency === "URGENT" && <Badge variant="destructive" className="text-[10px] px-1.5">Pilne</Badge>}
                    {r.urgency === "HIGH" && <Badge variant="secondary" className="text-[10px] px-1.5 bg-orange-100 text-orange-800">Wysoki</Badge>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge className={`text-[10px] ${STATUS_COLORS[r.status] || ""}`} variant="outline">
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(r)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {["NEW", "CANCELLED"].includes(r.status) && (
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Details row */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground ml-7">
                  {r.category && <span className="bg-muted px-1.5 py-0.5 rounded">{r.category}</span>}
                  {r.manufacturer && <span>{r.manufacturer}</span>}
                  {r.model && <span>· {r.model}</span>}
                  {r.estimated_gross > 0 && <span className="font-medium text-foreground">{formatCurrency(r.estimated_gross)}</span>}
                </div>

                {/* Link row */}
                {r.product_url && (
                  <a href={r.product_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-7 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />{r.supplier || "Link do produktu"}
                  </a>
                )}
                {!r.product_url && r.supplier && <div className="text-xs text-muted-foreground ml-7">{r.supplier}</div>}

                {/* Quick action buttons based on current status */}
                <div className="flex items-center gap-1.5 ml-7 pt-1">
                  {r.status === "NEW" && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleQuickStatus(r, "ORDERED")}>
                      📦 Zamów
                    </Button>
                  )}
                  {r.status === "TO_ORDER" && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleQuickStatus(r, "ORDERED")}>
                      📦 Zamówiono
                    </Button>
                  )}
                  {r.status === "ORDERED" && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleQuickStatus(r, "DELIVERED")}>
                      ✅ Dostarczono
                    </Button>
                  )}
                  {r.status === "DELIVERED" && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleQuickStatus(r, "INSTALLED")}>
                      🔧 Zamontowano
                    </Button>
                  )}
                  {!["CANCELLED", "INSTALLED"].includes(r.status) && (
                    <Select value={r.status} onValueChange={(v) => handleQuickStatus(r, v)}>
                      <SelectTrigger className="h-6 text-[10px] w-auto min-w-[80px] border-dashed">
                        <span className="text-muted-foreground">Zmień...</span>
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <PurchaseRequestFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orderId={orderId}
        editingRequest={editingRequest}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć zapotrzebowanie?</AlertDialogTitle>
            <AlertDialogDescription>Ta operacja jest nieodwracalna.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}>Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
