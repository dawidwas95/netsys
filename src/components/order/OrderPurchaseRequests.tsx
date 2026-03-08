import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, ShoppingCart, Package } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nowe",
  TO_ORDER: "Do zamówienia",
  ORDERED: "Zamówione",
  DELIVERED: "Dostarczone",
  CANCELLED: "Anulowane",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  TO_ORDER: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  ORDERED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

const URGENCY_LABELS: Record<string, string> = {
  LOW: "Niski",
  NORMAL: "Normalny",
  HIGH: "Wysoki",
  URGENT: "Pilny",
};

interface OrderPurchaseRequestsProps {
  orderId: string;
}

export function OrderPurchaseRequests({ orderId }: OrderPurchaseRequestsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    item_name: "",
    quantity: "1",
    category: "",
    manufacturer: "",
    model: "",
    description: "",
    urgency: "NORMAL",
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["purchase-requests", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requests")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const addRequest = useMutation({
    mutationFn: async () => {
      const name = profile
        ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.full_name || "Użytkownik"
        : "Użytkownik";
      const { error } = await supabase.from("purchase_requests").insert({
        order_id: orderId,
        item_name: form.item_name,
        quantity: Number(form.quantity) || 1,
        category: form.category || null,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        description: form.description || null,
        urgency: form.urgency as any,
        requested_by: user?.id,
        requested_by_name: name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requests", orderId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-requests-global"] });
      toast.success("Zapotrzebowanie dodane");
      setDialogOpen(false);
      setForm({ item_name: "", quantity: "1", category: "", manufacturer: "", model: "", description: "", urgency: "NORMAL" });
    },
    onError: () => toast.error("Nie udało się dodać zapotrzebowania"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Zapotrzebowanie ({requests.length})
          </span>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-3 w-3" /> Dodaj
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nowe zapotrzebowanie</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nazwa części / produktu *</Label>
                  <Input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="np. Zasilacz 600W" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Ilość</Label>
                    <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                  </div>
                  <div>
                    <Label>Pilność</Label>
                    <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(URGENCY_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Kategoria</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="np. Zasilacze" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Producent</Label>
                    <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
                  </div>
                  <div>
                    <Label>Model / kompatybilność</Label>
                    <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Uwagi</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                </div>
                <Button className="w-full" onClick={() => addRequest.mutate()} disabled={!form.item_name.trim() || addRequest.isPending}>
                  {addRequest.isPending ? "Dodawanie..." : "Dodaj zapotrzebowanie"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
              <div key={r.id} className="flex items-center justify-between border rounded-md p-2.5 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{r.item_name}</span>
                    <span className="text-muted-foreground">×{r.quantity}</span>
                    {r.urgency === "URGENT" && <Badge variant="destructive" className="text-[10px] px-1.5">Pilne</Badge>}
                    {r.urgency === "HIGH" && <Badge variant="secondary" className="text-[10px] px-1.5 bg-orange-100 text-orange-800">Wysoki</Badge>}
                  </div>
                  {(r.manufacturer || r.model) && (
                    <div className="text-xs text-muted-foreground ml-5.5">
                      {[r.manufacturer, r.model].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <Badge className={`shrink-0 text-[10px] ${STATUS_COLORS[r.status] || ""}`} variant="outline">
                  {STATUS_LABELS[r.status] || r.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
