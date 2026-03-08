import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const URGENCY_LABELS: Record<string, string> = {
  LOW: "Niski", NORMAL: "Normalny", HIGH: "Wysoki", URGENT: "Pilny",
};
const APPROVAL_LABELS: Record<string, string> = {
  PENDING: "Oczekuje na akceptację", APPROVED: "Zaakceptowane", REJECTED: "Odrzucone",
};
const STATUS_LABELS: Record<string, string> = {
  NEW: "Nowe", TO_ORDER: "Do zamówienia", ORDERED: "Zamówione",
  DELIVERED: "Dostarczone", CANCELLED: "Anulowane",
};

interface PurchaseRequestFormData {
  item_name: string;
  quantity: string;
  category: string;
  manufacturer: string;
  model: string;
  product_url: string;
  supplier: string;
  estimated_gross: string;
  description: string;
  urgency: string;
  client_approval: string;
  status: string;
}

const emptyForm: PurchaseRequestFormData = {
  item_name: "", quantity: "1", category: "", manufacturer: "", model: "",
  product_url: "", supplier: "", estimated_gross: "", description: "",
  urgency: "NORMAL", client_approval: "PENDING", status: "NEW",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  editingRequest?: any | null;
}

export function PurchaseRequestFormDialog({ open, onOpenChange, orderId, editingRequest }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PurchaseRequestFormData>(emptyForm);
  const [newCatDialogOpen, setNewCatDialogOpen] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const isEditing = !!editingRequest;

  useEffect(() => {
    if (open && editingRequest) {
      setForm({
        item_name: editingRequest.item_name || "",
        quantity: String(editingRequest.quantity || 1),
        category: editingRequest.category || "",
        manufacturer: editingRequest.manufacturer || "",
        model: editingRequest.model || "",
        product_url: editingRequest.product_url || "",
        supplier: editingRequest.supplier || "",
        estimated_gross: editingRequest.estimated_gross ? String(editingRequest.estimated_gross) : "",
        description: editingRequest.description || "",
        urgency: editingRequest.urgency || "NORMAL",
        client_approval: editingRequest.client_approval || "PENDING",
        status: editingRequest.status || "NEW",
      });
    } else if (open && !editingRequest) {
      setForm(emptyForm);
    }
  }, [open, editingRequest]);

  const { data: categories = [] } = useQuery({
    queryKey: ["purchase-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_categories").select("*").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("first_name, last_name, full_name").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["purchase-requests", orderId] });
    queryClient.invalidateQueries({ queryKey: ["purchase-requests-global"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const gross = parseFloat(form.estimated_gross) || 0;
      const net = gross > 0 ? Math.round((gross / 1.23) * 100) / 100 : 0;
      const vat = gross > 0 ? Math.round((gross - net) * 100) / 100 : 0;

      const payload: any = {
        item_name: form.item_name,
        quantity: Number(form.quantity) || 1,
        category: form.category || null,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        product_url: form.product_url || null,
        supplier: form.supplier || null,
        estimated_gross: gross,
        estimated_net: net,
        estimated_vat: vat,
        description: form.description || null,
        urgency: form.urgency as any,
        client_approval: form.client_approval as any,
        status: form.status as any,
      };

      if (isEditing) {
        const { error } = await supabase.from("purchase_requests").update(payload).eq("id", editingRequest.id);
        if (error) throw error;
      } else {
        const name = profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.full_name || "Użytkownik"
          : "Użytkownik";
        payload.order_id = orderId;
        payload.requested_by = user?.id;
        payload.requested_by_name = name;
        const { error } = await supabase.from("purchase_requests").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success(isEditing ? "Zapotrzebowanie zaktualizowane" : "Zapotrzebowanie dodane");
      onOpenChange(false);
    },
    onError: () => toast.error("Nie udało się zapisać zapotrzebowania"),
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      const name = newCatLabel.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
      const { error } = await supabase.from("purchase_categories").insert({ name, label: newCatLabel.trim(), sort_order: 50 });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-categories"] });
      toast.success("Kategoria dodana");
      setForm({ ...form, category: newCatLabel.trim() });
      setNewCatLabel("");
      setNewCatDialogOpen(false);
    },
    onError: () => toast.error("Nie udało się dodać kategorii"),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edytuj zapotrzebowanie" : "Nowe zapotrzebowanie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nazwa części / produktu *</Label>
              <Input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="np. Bateria iPhone 12" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ilość</Label><Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
              <div><Label>Pilność</Label>
                <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(URGENCY_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Kategoria</Label>
              <div className="flex gap-2">
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Wybierz kategorię..." /></SelectTrigger>
                  <SelectContent>{categories.map((c: any) => (<SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>))}</SelectContent>
                </Select>
                <Button type="button" size="icon" variant="outline" className="shrink-0" onClick={() => setNewCatDialogOpen(true)}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div>
              <Label>Link do produktu</Label>
              <Input value={form.product_url} onChange={(e) => setForm({ ...form, product_url: e.target.value })} placeholder="https://sklep.pl/produkt" type="url" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Sklep / Dostawca</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="np. Allegro, x-kom" /></div>
              <div><Label>Koszt brutto (zł)</Label><Input type="number" min="0" step="0.01" value={form.estimated_gross} onChange={(e) => setForm({ ...form, estimated_gross: e.target.value })} placeholder="0.00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Producent</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
              <div><Label>Model / kompatybilność</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
            </div>
            {isEditing && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Akceptacja klienta</Label>
                  <Select value={form.client_approval} onValueChange={(v) => setForm({ ...form, client_approval: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(APPROVAL_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status zamówienia</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div><Label>Uwagi</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="np. najlepiej oryginał lub dobry OEM" /></div>
            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!form.item_name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Zapisywanie..." : isEditing ? "Zapisz zmiany" : "Dodaj zapotrzebowanie"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={newCatDialogOpen} onOpenChange={setNewCatDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Nowa kategoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nazwa kategorii</Label><Input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder="np. Matryca" /></div>
            <Button className="w-full" onClick={() => addCategory.mutate()} disabled={!newCatLabel.trim() || addCategory.isPending}>
              {addCategory.isPending ? "Dodawanie..." : "Dodaj kategorię"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
