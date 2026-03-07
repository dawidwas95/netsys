import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, FileText, Copy, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Robocza", SENT: "Wysłana", WAITING: "Oczekuje",
  ACCEPTED: "Zaakceptowana", REJECTED: "Odrzucona",
  CANCELLED: "Anulowana", EXPIRED: "Wygasła",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  WAITING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  ACCEPTED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
  CANCELLED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  SERVICE: "Usługa", PRODUCT: "Produkt", CUSTOM: "Inne",
};

type OfferItem = {
  id?: string;
  item_type: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_net: number;
  vat_rate: number;
  sort_order: number;
};

export default function OffersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*, clients(display_name, company_name, first_name, last_name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, display_name, company_name, first_name, last_name, client_type")
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (filterStatus === "all") return offers;
    return offers.filter((o: any) => o.status === filterStatus);
  }, [offers, filterStatus]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    offers.forEach((o: any) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return counts;
  }, [offers]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "ACCEPTED") updates.accepted_at = new Date().toISOString();
      if (status === "REJECTED") updates.rejected_at = new Date().toISOString();
      const { error } = await supabase.from("offers").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Zmieniono status oferty");
    },
  });

  const clientName = (o: any) => {
    const c = o.clients;
    if (!c) return "—";
    return c.display_name || c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Oferty handlowe</h1>
          <p className="text-sm text-muted-foreground">Tworzenie i zarządzanie ofertami</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nowa oferta</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nowa oferta handlowa</DialogTitle></DialogHeader>
            <OfferForm
              clients={clients}
              userId={user?.id}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["offers"] });
                setAddOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={filterStatus === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterStatus("all")}>
          Wszystkie ({offers.length})
        </Button>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          statusCounts[key] ? (
            <Button key={key} variant={filterStatus === key ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(key)}>
              {label} ({statusCounts[key]})
            </Button>
          ) : null
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numer</TableHead>
                <TableHead>Tytuł</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Data wystawienia</TableHead>
                <TableHead>Ważna do</TableHead>
                <TableHead className="text-right">Netto</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Ładowanie...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Brak ofert</TableCell></TableRow>
              ) : (
                filtered.map((o: any) => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailId(o.id)}>
                    <TableCell className="font-mono text-xs">{o.offer_number}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{o.title}</TableCell>
                    <TableCell className="text-sm">{clientName(o)}</TableCell>
                    <TableCell className="text-sm">{format(new Date(o.issue_date), "dd.MM.yyyy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.valid_until ? format(new Date(o.valid_until), "dd.MM.yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(o.total_net).toFixed(2)} zł</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{Number(o.total_gross).toFixed(2)} zł</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[o.status] || ""}>{STATUS_LABELS[o.status]}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select onValueChange={(v) => updateStatus.mutate({ id: o.id, status: v })}>
                        <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue placeholder="Zmień status" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k} disabled={k === o.status}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      {detailId && (
        <OfferDetailDialog
          offerId={detailId}
          onClose={() => setDetailId(null)}
          onStatusChange={(status) => updateStatus.mutate({ id: detailId, status })}
        />
      )}
    </div>
  );
}

function OfferForm({ clients, userId, onSuccess }: {
  clients: any[];
  userId?: string;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    client_id: "", title: "", description: "",
    issue_date: new Date().toISOString().split("T")[0],
    valid_until: "",
    notes: "",
  });
  const [items, setItems] = useState<OfferItem[]>([
    { item_type: "SERVICE", name: "", description: "", quantity: 1, unit: "szt.", unit_net: 0, vat_rate: 23, sort_order: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const addItem = () => {
    setItems([...items, {
      item_type: "SERVICE", name: "", description: "", quantity: 1,
      unit: "szt.", unit_net: 0, vat_rate: 23, sort_order: items.length,
    }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const totalNet = items.reduce((sum, i) => sum + (i.quantity * i.unit_net), 0);
  const totalGross = items.reduce((sum, i) => {
    const net = i.quantity * i.unit_net;
    return sum + net * (1 + i.vat_rate / 100);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.title.trim()) {
      toast.error("Wypełnij klienta i tytuł"); return;
    }
    if (items.some(i => !i.name.trim())) {
      toast.error("Wypełnij nazwy pozycji"); return;
    }

    setSaving(true);
    try {
      const { data: offer, error } = await supabase.from("offers").insert({
        offer_number: "TEMP",
        client_id: form.client_id,
        title: form.title.trim(),
        description: form.description || null,
        issue_date: form.issue_date,
        valid_until: form.valid_until || null,
        notes: form.notes || null,
        total_net: totalNet,
        total_gross: totalGross,
        created_by: userId,
      }).select().single();

      if (error) throw error;

      const offerItems = items.map((item, idx) => ({
        offer_id: offer.id,
        item_type: item.item_type as "SERVICE" | "PRODUCT" | "CUSTOM",
        name: item.name,
        description: item.description || null,
        quantity: item.quantity,
        unit: item.unit,
        unit_net: item.unit_net,
        vat_rate: item.vat_rate,
        total_net: item.quantity * item.unit_net,
        total_gross: item.quantity * item.unit_net * (1 + item.vat_rate / 100),
        sort_order: idx,
      }));

      const { error: itemsError } = await supabase.from("offer_items").insert(offerItems);
      if (itemsError) throw itemsError;

      toast.success("Utworzono ofertę");
      onSuccess();
    } catch (err: any) {
      toast.error("Błąd: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Klient *</Label>
          <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
            <SelectTrigger><SelectValue placeholder="Wybierz klienta" /></SelectTrigger>
            <SelectContent>
              {clients.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.display_name || c.company_name || `${c.first_name} ${c.last_name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Tytuł oferty *</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Opis</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Data wystawienia</Label>
          <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Ważna do</Label>
          <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Pozycje kosztorysowe</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-3 w-3" />Dodaj pozycję
          </Button>
        </div>

        {items.map((item, idx) => (
          <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Pozycja {idx + 1}</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nazwa *</Label>
                <Input value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)} placeholder="np. Konfiguracja serwera" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Typ</Label>
                <Select value={item.item_type} onValueChange={(v) => updateItem(idx, "item_type", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ilość</Label>
                <Input type="number" min="0.01" step="0.01" value={item.quantity}
                  onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Jedn.</Label>
                <Input value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cena netto</Label>
                <Input type="number" step="0.01" value={item.unit_net}
                  onChange={(e) => updateItem(idx, "unit_net", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">VAT %</Label>
                <Input type="number" value={item.vat_rate}
                  onChange={(e) => updateItem(idx, "vat_rate", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Wartość netto</Label>
                <div className="h-9 flex items-center text-sm font-medium tabular-nums">
                  {(item.quantity * item.unit_net).toFixed(2)} zł
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-1">
        <div className="flex justify-between text-sm">
          <span>Suma netto:</span><span className="font-medium tabular-nums">{totalNet.toFixed(2)} zł</span>
        </div>
        <div className="flex justify-between text-sm font-bold">
          <span>Suma brutto:</span><span className="tabular-nums">{totalGross.toFixed(2)} zł</span>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Notatki</Label>
        <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Zapisywanie..." : "Utwórz ofertę"}
      </Button>
    </form>
  );
}

function OfferDetailDialog({ offerId, onClose, onStatusChange }: {
  offerId: string;
  onClose: () => void;
  onStatusChange: (status: string) => void;
}) {
  const { data: offer } = useQuery({
    queryKey: ["offer", offerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*, clients(display_name, company_name, first_name, last_name)")
        .eq("id", offerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["offer_items", offerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offer_items")
        .select("*")
        .eq("offer_id", offerId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  if (!offer) return null;

  const clientName = offer.clients
    ? (offer.clients as any).display_name || (offer.clients as any).company_name || `${(offer.clients as any).first_name || ""} ${(offer.clients as any).last_name || ""}`.trim()
    : "—";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {offer.offer_number} — {offer.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Klient:</span> <strong>{clientName}</strong></div>
            <div><span className="text-muted-foreground">Status:</span>{" "}
              <Badge variant="outline" className={STATUS_COLORS[offer.status]}>{STATUS_LABELS[offer.status]}</Badge>
            </div>
            <div><span className="text-muted-foreground">Data wystawienia:</span> {format(new Date(offer.issue_date), "dd.MM.yyyy")}</div>
            <div><span className="text-muted-foreground">Ważna do:</span> {offer.valid_until ? format(new Date(offer.valid_until), "dd.MM.yyyy") : "—"}</div>
          </div>

          {offer.description && (
            <div className="text-sm"><span className="text-muted-foreground">Opis:</span> {offer.description}</div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lp.</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Ilość</TableHead>
                <TableHead className="text-right">Cena netto</TableHead>
                <TableHead className="text-right">Wartość netto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any, idx: number) => (
                <TableRow key={item.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{ITEM_TYPE_LABELS[item.item_type]}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{Number(item.quantity)} {item.unit}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(item.unit_net).toFixed(2)} zł</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{Number(item.total_net).toFixed(2)} zł</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span>Netto:</span><span className="font-medium tabular-nums">{Number(offer.total_net).toFixed(2)} zł</span></div>
            <div className="flex justify-between font-bold"><span>Brutto:</span><span className="tabular-nums">{Number(offer.total_gross).toFixed(2)} zł</span></div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Select onValueChange={onStatusChange}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Zmień status" /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k} disabled={k === offer.status}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
