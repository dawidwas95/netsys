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
import { Plus, ShoppingCart, Package, ExternalLink, CheckCircle2, Clock, XCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PurchaseRequestFormDialog } from "./PurchaseRequestFormDialog";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nowe", TO_ORDER: "Do zamówienia", ORDERED: "Zamówione",
  DELIVERED: "Dostarczone", CANCELLED: "Anulowane",
};
const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  TO_ORDER: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  ORDERED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  CANCELLED: "bg-muted text-muted-foreground",
};
const APPROVAL_LABELS: Record<string, string> = {
  PENDING: "Oczekuje na akceptację", APPROVED: "Zaakceptowane", REJECTED: "Odrzucone",
};
const APPROVAL_BADGE: Record<string, { icon: typeof Clock; className: string }> = {
  PENDING: { icon: Clock, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  APPROVED: { icon: CheckCircle2, className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  REJECTED: { icon: XCircle, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

interface OrderPurchaseRequestsProps { orderId: string; }

export function OrderPurchaseRequests({ orderId }: OrderPurchaseRequestsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const updateApproval = useMutation({
    mutationFn: async ({ id, approval }: { id: string; approval: string }) => {
      const { error } = await supabase.from("purchase_requests").update({
        client_approval: approval as any,
        client_approval_changed_by: user?.id,
        client_approval_changed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requests", orderId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-requests-global"] });
      toast.success("Status akceptacji zmieniony");
    },
    onError: () => toast.error("Błąd zmiany statusu akceptacji"),
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

  const ApprovalBadge = ({ status }: { status: string }) => {
    const cfg = APPROVAL_BADGE[status] || APPROVAL_BADGE.PENDING;
    const Icon = cfg.icon;
    return (
      <Badge className={`text-[10px] px-1.5 gap-1 ${cfg.className}`} variant="outline">
        <Icon className="h-3 w-3" />{APPROVAL_LABELS[status] || status}
      </Badge>
    );
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
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Ładowanie...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak zapotrzebowań dla tego zlecenia.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r: any) => (
              <div key={r.id} className="border rounded-md p-2.5 text-sm space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground ml-5.5">
                  {r.category && <span className="bg-muted px-1.5 py-0.5 rounded">{r.category}</span>}
                  {r.manufacturer && <span>{r.manufacturer}</span>}
                  {r.model && <span>· {r.model}</span>}
                  {r.estimated_gross > 0 && <span className="font-medium text-foreground">{formatCurrency(r.estimated_gross)}</span>}
                </div>
                {r.product_url && (
                  <a href={r.product_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-5.5 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />{r.supplier || "Link do produktu"}
                  </a>
                )}
                {!r.product_url && r.supplier && <div className="text-xs text-muted-foreground ml-5.5">{r.supplier}</div>}
                <div className="flex items-center justify-between ml-5.5 pt-1 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Akceptacja klienta:</span>
                    <ApprovalBadge status={r.client_approval} />
                  </div>
                  <Select value={r.client_approval} onValueChange={(v) => updateApproval.mutate({ id: r.id, approval: v })}>
                    <SelectTrigger className="h-6 text-[10px] w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPROVAL_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                    </SelectContent>
                  </Select>
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
