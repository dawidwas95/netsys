import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShoppingCart, Search, Package, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PurchaseRequestFormDialog } from "@/components/order/PurchaseRequestFormDialog";

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
const URGENCY_LABELS: Record<string, string> = { LOW: "Niski", NORMAL: "Normalny", HIGH: "Wysoki", URGENT: "Pilny" };
const URGENCY_COLORS: Record<string, string> = { URGENT: "text-destructive font-semibold", HIGH: "text-orange-600 font-medium", NORMAL: "", LOW: "text-muted-foreground" };
const ALL_STATUSES = ["NEW", "TO_ORDER", "ORDERED", "DELIVERED", "CANCELLED"];
const APPROVAL_LABELS: Record<string, string> = { PENDING: "Oczekuje", APPROVED: "Zaakceptowane", REJECTED: "Odrzucone" };
const APPROVAL_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  REJECTED: "bg-destructive/10 text-destructive",
};
const ALL_APPROVALS = ["PENDING", "APPROVED", "REJECTED"];

const formatCurrency = (v: number | null | undefined) => v && v > 0 ? `${Number(v).toFixed(2)} zł` : null;




const ProductLink = ({ url, supplier }: { url?: string | null; supplier?: string | null }) => {
  if (!url) return supplier ? <span className="text-xs text-muted-foreground">{supplier}</span> : <span className="text-muted-foreground">—</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 max-w-[160px] truncate">
      <ExternalLink className="h-3 w-3 shrink-0" />{supplier || "Link"}
    </a>
  );
};

export default function PurchaseRequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [urgencyFilter, setUrgencyFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  
  
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["purchase-requests-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requests")
        .select("*, service_orders!inner(order_number, service_type, clients(display_name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categoriesRaw = [] } = useQuery({
    queryKey: ["purchase-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_categories").select("*").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });
  const categories = categoriesRaw.map((c: any) => c.label as string);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("purchase_requests").update({
        status: status as any,
        status_changed_by: user?.id,
        status_changed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requests-global"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
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
      queryClient.invalidateQueries({ queryKey: ["purchase-requests-global"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
      toast.success("Zapotrzebowanie usunięte");
      setDeleteConfirm(null);
    },
    onError: () => toast.error("Nie udało się usunąć"),
  });

  const handleStatusChange = (r: any, newStatus: string) => {
    updateStatus.mutate({ id: r.id, status: newStatus });
  };

  const handleEdit = (r: any) => {
    setEditingRequest(r);
    setEditDialogOpen(true);
  };

  const filtered = requests.filter((r: any) => {
    if (statusFilter === "ACTIVE" && ["DELIVERED", "CANCELLED"].includes(r.status)) return false;
    if (statusFilter !== "ACTIVE" && statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (urgencyFilter !== "ALL" && r.urgency !== urgencyFilter) return false;
    if (categoryFilter !== "ALL" && r.category !== categoryFilter) return false;
    
    if (search) {
      const q = search.toLowerCase();
      const orderNum = r.service_orders?.order_number?.toLowerCase() || "";
      const clientName = r.service_orders?.clients?.display_name?.toLowerCase() || "";
      if (
        !r.item_name.toLowerCase().includes(q) && !orderNum.includes(q) &&
        !clientName.includes(q) && !(r.requested_by_name || "").toLowerCase().includes(q) &&
        !(r.supplier || "").toLowerCase().includes(q) && !(r.category || "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const activeCount = requests.filter((r: any) => !["DELIVERED", "CANCELLED"].includes(r.status)).length;
  const totalGross = filtered.reduce((sum: number, r: any) => sum + (Number(r.estimated_gross) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" /> Zapotrzebowanie
          </h1>
          <p className="text-sm text-muted-foreground">
            Kolejka zamówień części ze zleceń serwisowych
            {activeCount > 0 && <Badge variant="secondary" className="ml-2">{activeCount} aktywnych</Badge>}
            {totalGross > 0 && <span className="ml-2 font-medium text-foreground">{totalGross.toFixed(2)} zł</span>}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Szukaj..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Aktywne</SelectItem>
                <SelectItem value="ALL">Wszystkie</SelectItem>
                {ALL_STATUSES.map((s) => (<SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>))}
              </SelectContent>
            </Select>
            
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Pilność" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Wszystkie</SelectItem>
                {Object.entries(URGENCY_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
              </SelectContent>
            </Select>
            {categories.length > 0 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Kategoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Wszystkie</SelectItem>
                  {categories.map((c: string) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status zamówienia</TableHead>
                <TableHead>Akceptacja klienta</TableHead>
                <TableHead>Nazwa części</TableHead>
                <TableHead className="text-center">Ilość</TableHead>
                <TableHead>Kategoria</TableHead>
                <TableHead>Zlecenie</TableHead>
                <TableHead>Dział</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Technik</TableHead>
                <TableHead>Pilność</TableHead>
                <TableHead>Sklep / Link</TableHead>
                <TableHead className="text-right">Koszt brutto</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">Ładowanie...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">Brak zapotrzebowań</TableCell></TableRow>
              ) : (
                filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Select value={r.status} onValueChange={(v) => handleStatusChange(r, v)}>
                        <SelectTrigger className="h-7 text-[10px] w-auto min-w-[100px] border-none p-0 gap-1">
                          <Badge className={`text-[10px] ${STATUS_COLORS[r.status] || ""}`} variant="outline">{STATUS_LABELS[r.status]}</Badge>
                        </SelectTrigger>
                        <SelectContent>{ALL_STATUSES.map((s) => (<SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>))}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={r.client_approval} onValueChange={(v) => updateApproval.mutate({ id: r.id, approval: v })}>
                        <SelectTrigger className="h-7 text-[10px] w-auto min-w-[100px] border-none p-0 gap-1">
                          <Badge className={`text-[10px] ${APPROVAL_COLORS[r.client_approval] || ""}`} variant="outline">{APPROVAL_LABELS[r.client_approval] || r.client_approval}</Badge>
                        </SelectTrigger>
                        <SelectContent>{ALL_APPROVALS.map((s) => (<SelectItem key={s} value={s}>{APPROVAL_LABELS[s]}</SelectItem>))}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.item_name}</div>
                      {(r.manufacturer || r.model) && <div className="text-xs text-muted-foreground">{[r.manufacturer, r.model].filter(Boolean).join(" · ")}</div>}
                      {r.description && <div className="text-xs text-muted-foreground italic truncate max-w-[200px]">{r.description}</div>}
                    </TableCell>
                    <TableCell className="text-center">{r.quantity}</TableCell>
                    <TableCell>{r.category ? <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.category}</span> : "—"}</TableCell>
                    <TableCell>
                      <Link to={`/orders/${r.order_id}`} className="text-primary hover:underline text-xs font-mono flex items-center gap-1">
                        {r.service_orders?.order_number}<ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.service_orders?.service_type === "COMPUTER_SERVICE" ? "💻" : r.service_orders?.service_type === "PHONE_SERVICE" ? "📱" : ""}{" "}
                      {r.service_orders?.service_type === "COMPUTER_SERVICE" ? "Komputery" : r.service_orders?.service_type === "PHONE_SERVICE" ? "Telefony" : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{r.service_orders?.clients?.display_name || "—"}</TableCell>
                    <TableCell className="text-sm">{r.requested_by_name || "—"}</TableCell>
                    <TableCell><span className={`text-xs ${URGENCY_COLORS[r.urgency] || ""}`}>{URGENCY_LABELS[r.urgency] || r.urgency}</span></TableCell>
                    <TableCell><ProductLink url={r.product_url} supplier={r.supplier} /></TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(r.estimated_gross) || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pl-PL")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {["NEW", "CANCELLED"].includes(r.status) && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Ładowanie...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Brak zapotrzebowań</p>
        ) : (
          filtered.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      {r.item_name} ×{r.quantity}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground ml-5.5 mt-0.5">
                      {r.category && <span className="bg-muted px-1.5 py-0.5 rounded">{r.category}</span>}
                      {formatCurrency(r.estimated_gross) && <span className="font-medium text-foreground">{formatCurrency(r.estimated_gross)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge className={`text-[10px] ${STATUS_COLORS[r.status] || ""}`} variant="outline">{STATUS_LABELS[r.status]}</Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(r)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                {r.product_url && (
                  <a href={r.product_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />{r.supplier || "Link do produktu"}
                  </a>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Link to={`/orders/${r.order_id}`} className="text-primary hover:underline font-mono">{r.service_orders?.order_number}</Link>
                  <span>{r.service_orders?.clients?.display_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${URGENCY_COLORS[r.urgency] || ""}`}>{URGENCY_LABELS[r.urgency]}</span>
                  <Select value={r.status} onValueChange={(v) => handleStatusChange(r, v)}>
                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{ALL_STATUSES.map((s) => (<SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                {["NEW", "CANCELLED"].includes(r.status) && (
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive w-full" onClick={() => setDeleteConfirm(r.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Usuń
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit dialog */}
      {editingRequest && (
        <PurchaseRequestFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          orderId={editingRequest.order_id}
          editingRequest={editingRequest}
        />
      )}

      

      {/* Delete confirmation dialog */}
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
    </div>
  );
}
