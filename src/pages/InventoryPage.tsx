import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Package, ArrowDownToLine, ArrowUpFromLine, AlertTriangle,
  History, Pencil, Trash2, Archive, MinusCircle, QrCode, Printer, X,
} from "lucide-react";
import QRCode from "qrcode";

type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "DAMAGE" | "INTERNAL_USE";

const MOVEMENT_LABELS: Record<string, string> = {
  IN: "Przyjęcie", OUT: "Wydanie", ADJUSTMENT: "Korekta",
  DAMAGE: "Uszkodzenie", INTERNAL_USE: "Użycie wewnętrzne", RESERVATION: "Rezerwacja",
};

const MOVEMENT_COLORS: Record<string, string> = {
  IN: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  OUT: "bg-red-500/20 text-red-400 border-red-500/30",
  ADJUSTMENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DAMAGE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  INTERNAL_USE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export default function InventoryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [moveOpen, setMoveOpen] = useState<{ itemId: string; itemName: string; type: "IN" | "OUT"; currentStock: number } | null>(null);
  const [adjustOpen, setAdjustOpen] = useState<{ itemId: string; itemName: string; currentStock: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [showArchived, setShowArchived] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch active reservations for available stock calculation
  const { data: allReservations = [] } = useQuery({
    queryKey: ["inventory-reservations-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_reservations" as any)
        .select("id, inventory_item_id, quantity")
        .eq("status", "RESERVED");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; inventory_item_id: string; quantity: number }[];
    },
  });

  const reservedMap = useMemo(() => {
    const map: Record<string, number> = {};
    allReservations.forEach((r) => {
      map[r.inventory_item_id] = (map[r.inventory_item_id] || 0) + Number(r.quantity);
    });
    return map;
  }, [allReservations]);

  const { data: movements = [] } = useQuery({
    queryKey: ["inventory_movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*, inventory_items(name, sku)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["inventory_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_categories" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-inv"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, first_name, last_name, email");
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p: any) => {
      map[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "—";
    });
    return map;
  }, [profiles]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c: any) => { map[c.name] = c.label; });
    return map;
  }, [categories]);

  const displayItems = useMemo(() => {
    let list = showArchived ? items : items.filter((i: any) => !i.is_archived);
    if (filterCategory !== "ALL") {
      list = list.filter((i: any) => i.category === filterCategory);
    }
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((i: any) =>
      i.name?.toLowerCase().includes(q) ||
      i.sku?.toLowerCase().includes(q) ||
      (i as any).inventory_number?.toLowerCase().includes(q) ||
      i.manufacturer?.toLowerCase().includes(q) ||
      i.model?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      ((i as any).compatible_models || []).some((m: string) => m.toLowerCase().includes(q))
    );
  }, [items, search, showArchived, filterCategory]);

  const activeItems = useMemo(() => items.filter((i: any) => !i.is_archived), [items]);
  const lowStock = useMemo(() =>
    activeItems.filter((i: any) => i.stock_quantity <= i.minimum_quantity && i.is_active), [activeItems]
  );
  const totalValue = useMemo(() =>
    activeItems.reduce((sum: number, i: any) => {
      const purchaseNet = Number(i.purchase_net);
      const vatRate = Number(i.vat_rate) || 23;
      const purchaseGross = purchaseNet * (1 + vatRate / 100);
      return sum + (Number(i.stock_quantity) * purchaseGross);
    }, 0), [activeItems]
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
    queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
  };

  const addItem = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("inventory_items").insert(data);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setAddOpen(false); toast.success("Dodano pozycję magazynową"); },
    onError: (e: any) => toast.error(e.message || "Błąd dodawania pozycji"),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("inventory_items").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setEditItem(null); toast.success("Zaktualizowano pozycję"); },
    onError: () => toast.error("Błąd aktualizacji"),
  });

  const deleteItem = useMutation({
    mutationFn: async (item: any) => {
      const { count } = await supabase
        .from("inventory_movements")
        .select("id", { count: "exact", head: true })
        .eq("item_id", item.id);
      if ((count ?? 0) > 0) throw new Error("Pozycja ma powiązane ruchy magazynowe. Użyj archiwizacji.");
      if (Number(item.stock_quantity) !== 0) throw new Error("Stan magazynowy musi wynosić 0.");
      const { error } = await supabase.from("inventory_items")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id } as any)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setDeleteConfirm(null); toast.success("Usunięto pozycję"); },
    onError: (err: any) => { toast.error(err.message); setDeleteConfirm(null); },
  });

  const archiveItem = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase.from("inventory_items")
        .update({ is_archived: !item.is_archived })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: (_, item) => {
      invalidateAll(); setArchiveConfirm(null);
      toast.success(item.is_archived ? "Przywrócono pozycję" : "Zarchiwizowano pozycję");
    },
  });

  const addMovement = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("inventory_movements").insert({ ...data, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setMoveOpen(null); toast.success("Zapisano ruch magazynowy"); },
    onError: () => toast.error("Błąd zapisu ruchu"),
  });

  const addAdjustment = useMutation({
    mutationFn: async (data: { item_id: string; quantity: number; movement_type: MovementType; notes: string }) => {
      const { error } = await supabase.from("inventory_movements").insert({
        item_id: data.item_id, movement_type: data.movement_type, quantity: data.quantity,
        source_type: "MANUAL", notes: data.notes, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setAdjustOpen(null); toast.success("Zapisano korektę stanu"); },
    onError: () => toast.error("Błąd zapisu korekty"),
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold">Magazyn</h1>
          <p className="text-sm text-muted-foreground">Części, towary i materiały serwisowe</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto min-h-[44px]"><Plus className="mr-2 h-4 w-4" />Dodaj pozycję</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nowa pozycja magazynowa</DialogTitle></DialogHeader>
            <ItemForm
              categories={categories}
              onSubmit={(d) => addItem.mutate(d)}
              loading={addItem.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4">
          <div className="text-xs text-muted-foreground">Pozycji w magazynie</div>
          <div className="text-2xl font-bold">{activeItems.length}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <div className="text-xs text-muted-foreground">Wartość magazynu (brutto)</div>
          <div className="text-2xl font-bold">{totalValue.toFixed(2)} zł</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-400" /> Niski stan
          </div>
          <div className="text-2xl font-bold text-amber-400">{lowStock.length}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <div className="text-xs text-muted-foreground">Ostatnie ruchy</div>
          <div className="text-2xl font-bold">{movements.length}</div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items"><Package className="mr-1 h-4 w-4" />Pozycje</TabsTrigger>
          <TabsTrigger value="movements"><History className="mr-1 h-4 w-4" />Historia ruchów</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
            <Input
              placeholder="Szukaj: ID, nazwa, producent, model kompatybilny..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-h-[44px]"
            />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]"><SelectValue placeholder="Kategoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Wszystkie kategorie</SelectItem>
                {categories.map((c: any) => (
                  <SelectItem key={c.name} value={c.name}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded" />
              Archiwalne
            </label>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[130px]">ID</TableHead>
                      <TableHead>Nazwa</TableHead>
                      <TableHead>Producent</TableHead>
                      <TableHead>Kategoria</TableHead>
                      <TableHead>Kompatybilność</TableHead>
                      <TableHead className="text-right">Stan</TableHead>
                      <TableHead className="text-right">Rezerw.</TableHead>
                      <TableHead className="text-right">Dostępne</TableHead>
                      <TableHead className="text-right">Min.</TableHead>
                      <TableHead className="text-right">Zakup brutto</TableHead>
                      <TableHead className="text-right">Sprzedaż brutto</TableHead>
                      <TableHead>Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Ładowanie...</TableCell></TableRow>
                    ) : displayItems.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Brak pozycji</TableCell></TableRow>
                    ) : (
                      displayItems.map((item: any) => {
                        const isLow = item.stock_quantity <= item.minimum_quantity && item.is_active && !item.is_archived;
                        return (
                          <TableRow key={item.id} className={`${isLow ? "bg-amber-500/5" : ""} ${item.is_archived ? "opacity-50" : ""} cursor-pointer hover:bg-muted/50`}
                            onClick={() => setDetailItem(item)}>
                            <TableCell className="font-mono text-xs font-medium text-primary">{item.inventory_number || "—"}</TableCell>
                            <TableCell className="font-medium">
                              {item.name}
                              {item.is_archived && <Badge variant="outline" className="ml-2 text-xs">Archiwum</Badge>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.manufacturer || "—"}</TableCell>
                            <TableCell>
                              {item.category && <Badge variant="outline" className="text-xs">{categoryMap[item.category] || item.category}</Badge>}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="flex gap-1 flex-wrap">
                                {(item.compatible_models || []).slice(0, 3).map((m: string, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">{m}</Badge>
                                ))}
                                {(item.compatible_models || []).length > 3 && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{item.compatible_models.length - 3}</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {isLow && <AlertTriangle className="inline h-3 w-3 text-amber-400 mr-1" />}
                              {Number(item.stock_quantity)} {item.unit}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{Number(item.minimum_quantity)}</TableCell>
                            <TableCell className="text-right tabular-nums text-xs">{(Number(item.purchase_net) * (1 + (Number(item.vat_rate) || 23) / 100)).toFixed(2)} zł</TableCell>
                            <TableCell className="text-right tabular-nums text-xs">{(Number(item.sale_net) * (1 + (Number(item.vat_rate) || 23) / 100)).toFixed(2)} zł</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1 flex-wrap">
                                <Button size="sm" variant="ghost" className="h-7 px-2" title="Przyjęcie"
                                  onClick={(e) => { e.stopPropagation(); setMoveOpen({ itemId: item.id, itemName: item.name, type: "IN", currentStock: Number(item.stock_quantity) }); }}>
                                  <ArrowDownToLine className="h-3 w-3 text-emerald-400" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2" title="Wydanie"
                                  onClick={(e) => { e.stopPropagation(); setMoveOpen({ itemId: item.id, itemName: item.name, type: "OUT", currentStock: Number(item.stock_quantity) }); }}>
                                  <ArrowUpFromLine className="h-3 w-3 text-red-400" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2" title="Korekta"
                                  onClick={(e) => { e.stopPropagation(); setAdjustOpen({ itemId: item.id, itemName: item.name, currentStock: Number(item.stock_quantity) }); }}>
                                  <MinusCircle className="h-3 w-3 text-amber-400" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2" title="Edytuj"
                                  onClick={() => setEditItem(item)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2" title={item.is_archived ? "Przywróć" : "Archiwizuj"}
                                  onClick={() => setArchiveConfirm(item)}>
                                  <Archive className="h-3 w-3" />
                                </Button>
                                {Number(item.stock_quantity) === 0 && (
                                  <Button size="sm" variant="ghost" className="h-7 px-2" title="Usuń"
                                    onClick={() => setDeleteConfirm(item)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Pozycja</TableHead>
                    <TableHead className="text-right">Ilość</TableHead>
                    <TableHead>Źródło</TableHead>
                    <TableHead>Użytkownik</TableHead>
                    <TableHead>Notatki</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Brak ruchów</TableCell></TableRow>
                  ) : (
                    movements.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{new Date(m.created_at).toLocaleDateString("pl-PL")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={MOVEMENT_COLORS[m.movement_type] || "bg-muted"}>
                            {MOVEMENT_LABELS[m.movement_type] || m.movement_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{m.inventory_items?.name || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {m.movement_type === "IN" ? "+" : ["OUT", "DAMAGE", "INTERNAL_USE"].includes(m.movement_type) ? "-" : ""}
                          {Number(m.quantity)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.source_type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.created_by ? profileMap[m.created_by] || "—" : "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.notes || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Movement Dialog */}
      <Dialog open={!!moveOpen} onOpenChange={() => setMoveOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moveOpen?.type === "IN" ? "Przyjęcie towaru" : "Wydanie towaru"}: {moveOpen?.itemName}</DialogTitle>
          </DialogHeader>
          <MovementForm
            type={moveOpen?.type || "IN"}
            currentStock={moveOpen?.currentStock ?? 0}
            onSubmit={(d) => addMovement.mutate({ ...d, item_id: moveOpen?.itemId, movement_type: moveOpen?.type })}
            loading={addMovement.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edycja: {editItem?.name}</DialogTitle></DialogHeader>
          {editItem && (
            <ItemForm
              categories={categories}
              initialData={editItem}
              isEdit
              onSubmit={(d) => updateItem.mutate({ id: editItem.id, data: d })}
              loading={updateItem.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Item Detail / QR Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Szczegóły pozycji</DialogTitle></DialogHeader>
          {detailItem && <ItemDetailView item={detailItem} categoryLabel={categoryMap[detailItem.category] || detailItem.category} />}
        </DialogContent>
      </Dialog>

      {/* Adjustment Dialog */}
      <Dialog open={!!adjustOpen} onOpenChange={() => setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Korekta stanu: {adjustOpen?.itemName}</DialogTitle></DialogHeader>
          {adjustOpen && (
            <AdjustmentForm
              currentStock={adjustOpen.currentStock}
              onSubmit={(d) => addAdjustment.mutate({ item_id: adjustOpen.itemId, ...d })}
              loading={addAdjustment.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete / Archive Dialogs */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć pozycję?</AlertDialogTitle>
            <AlertDialogDescription>
              Pozycja "{deleteConfirm?.name}" zostanie trwale usunięta. Możliwe tylko gdy stan = 0 i brak ruchów.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteItem.mutate(deleteConfirm)} className="bg-destructive text-destructive-foreground">Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!archiveConfirm} onOpenChange={() => setArchiveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{archiveConfirm?.is_archived ? "Przywrócić?" : "Zarchiwizować?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveConfirm?.is_archived
                ? `Pozycja "${archiveConfirm?.name}" zostanie przywrócona.`
                : `Pozycja "${archiveConfirm?.name}" zostanie zarchiwizowana.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveItem.mutate(archiveConfirm)}>
              {archiveConfirm?.is_archived ? "Przywróć" : "Archiwizuj"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Item Detail with QR ──
function ItemDetailView({ item, categoryLabel }: { item: any; categoryLabel: string }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const invNumber = item.inventory_number || "—";

  useState(() => {
    const url = `${window.location.origin}/inventory?id=${item.id}`;
    QRCode.toDataURL(url, { width: 200, margin: 1 }).then(setQrUrl);
  });

  function handlePrintLabel() {
    const w = window.open("", "_blank", "width=400,height=500");
    if (!w) return;
    w.document.write(`
      <html><head><title>Etykieta ${invNumber}</title>
      <style>
        @page { size: 62mm 100mm; margin: 3mm; }
        body { font-family: Arial, sans-serif; text-align: center; padding: 4mm; }
        .qr { width: 40mm; height: 40mm; }
        .inv-id { font-size: 14pt; font-weight: bold; margin: 3mm 0 1mm; font-family: monospace; }
        .name { font-size: 10pt; margin: 1mm 0; }
        .cat { font-size: 8pt; color: #666; }
        .mfr { font-size: 8pt; color: #666; }
      </style></head><body>
        ${qrUrl ? `<img src="${qrUrl}" class="qr" />` : ""}
        <div class="inv-id">${invNumber}</div>
        <div class="name">${item.name}</div>
        ${item.manufacturer ? `<div class="mfr">${item.manufacturer}</div>` : ""}
        ${categoryLabel ? `<div class="cat">${categoryLabel}</div>` : ""}
      </body></html>
    `);
    w.document.close();
    w.onload = () => { w.print(); };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        {qrUrl && <img src={qrUrl} alt="QR" className="w-24 h-24 rounded border" />}
        <div className="flex-1 space-y-1">
          <div className="font-mono text-lg font-bold text-primary">{invNumber}</div>
          <div className="font-medium text-lg">{item.name}</div>
          {item.manufacturer && <div className="text-sm text-muted-foreground">{item.manufacturer}</div>}
          {categoryLabel && <Badge variant="outline">{categoryLabel}</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Stan:</span> <span className="font-medium">{Number(item.stock_quantity)} {item.unit}</span></div>
        <div><span className="text-muted-foreground">Minimum:</span> <span>{Number(item.minimum_quantity)}</span></div>
        <div><span className="text-muted-foreground">Zakup brutto:</span> <span className="tabular-nums">{(Number(item.purchase_net) * (1 + (Number(item.vat_rate) || 23) / 100)).toFixed(2)} zł</span></div>
        <div><span className="text-muted-foreground">Sprzedaż brutto:</span> <span className="tabular-nums">{(Number(item.sale_net) * (1 + (Number(item.vat_rate) || 23) / 100)).toFixed(2)} zł</span></div>
        <div><span className="text-muted-foreground">Zakup netto:</span> <span className="tabular-nums text-muted-foreground">{Number(item.purchase_net).toFixed(2)} zł</span></div>
        <div><span className="text-muted-foreground">Sprzedaż netto:</span> <span className="tabular-nums text-muted-foreground">{Number(item.sale_net).toFixed(2)} zł</span></div>
        {item.sku && <div className="col-span-2"><span className="text-muted-foreground">SKU:</span> <span className="font-mono text-xs">{item.sku}</span></div>}
      </div>

      {(item.compatible_models || []).length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Kompatybilne modele:</div>
          <div className="flex gap-1 flex-wrap">
            {item.compatible_models.map((m: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>
            ))}
          </div>
        </div>
      )}

      {item.notes && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Notatki:</div>
          <p className="text-sm">{item.notes}</p>
        </div>
      )}

      <Button onClick={handlePrintLabel} variant="outline" className="w-full">
        <Printer className="mr-2 h-4 w-4" /> Drukuj etykietę
      </Button>
    </div>
  );
}

// ── Item Form ──
function ItemForm({ onSubmit, loading, initialData, isEdit, categories }: {
  onSubmit: (d: any) => void;
  loading: boolean;
  initialData?: any;
  isEdit?: boolean;
  categories: any[];
}) {
  const [form, setForm] = useState({
    name: initialData?.name || "",
    sku: initialData?.sku || "",
    category: initialData?.category || "",
    manufacturer: initialData?.manufacturer || "",
    model: initialData?.model || "",
    unit: initialData?.unit || "szt.",
    purchase_net: initialData?.purchase_net?.toString() || "0",
    sale_net: initialData?.sale_net?.toString() || "0",
    vat_rate: initialData?.vat_rate?.toString() || "23",
    minimum_quantity: initialData?.minimum_quantity?.toString() || "0",
    stock_quantity: initialData?.stock_quantity?.toString() || "0",
    notes: initialData?.notes || "",
  });
  const [compatModels, setCompatModels] = useState<string[]>(initialData?.compatible_models || []);
  const [newModel, setNewModel] = useState("");

  function addModel() {
    const m = newModel.trim();
    if (m && !compatModels.includes(m)) {
      setCompatModels([...compatModels, m]);
    }
    setNewModel("");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Podaj nazwę"); return; }
    const data: any = {
      name: form.name.trim(),
      sku: form.sku || null,
      category: form.category || null,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
      unit: form.unit,
      purchase_net: parseFloat(form.purchase_net) || 0,
      sale_net: parseFloat(form.sale_net) || 0,
      vat_rate: parseFloat(form.vat_rate) || 23,
      minimum_quantity: parseFloat(form.minimum_quantity) || 0,
      notes: form.notes || null,
      compatible_models: compatModels,
    };
    if (!isEdit) {
      data.stock_quantity = parseFloat(form.stock_quantity) || 0;
    }
    onSubmit(data);
  };

  const u = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Nazwa *</Label><Input value={form.name} onChange={u("name")} /></div>
        <div className="space-y-1">
          <Label>Kategoria</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue placeholder="Wybierz kategorię" /></SelectTrigger>
            <SelectContent>
              {categories.map((c: any) => (
                <SelectItem key={c.name} value={c.name}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Producent</Label><Input value={form.manufacturer} onChange={u("manufacturer")} placeholder="np. Samsung, Apple" /></div>
        <div className="space-y-1"><Label>SKU (opcjonalne)</Label><Input value={form.sku} onChange={u("sku")} placeholder="np. BAT-IP12" /></div>
      </div>

      {/* Compatible models */}
      <div className="space-y-2">
        <Label>Kompatybilne modele</Label>
        <div className="flex gap-2">
          <Input
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            placeholder="np. iPhone 12, Dell Latitude 5420"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addModel(); } }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addModel}>Dodaj</Button>
        </div>
        {compatModels.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {compatModels.map((m, i) => (
              <Badge key={i} variant="secondary" className="text-xs gap-1">
                {m}
                <button type="button" onClick={() => setCompatModels(compatModels.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-1"><Label>Jednostka</Label><Input value={form.unit} onChange={u("unit")} /></div>
        {!isEdit && (
          <div className="space-y-1"><Label>Stan początkowy</Label><Input type="number" value={form.stock_quantity} onChange={u("stock_quantity")} /></div>
        )}
        <div className="space-y-1"><Label>Stan minimalny</Label><Input type="number" value={form.minimum_quantity} onChange={u("minimum_quantity")} /></div>
        <div className="space-y-1"><Label>VAT %</Label><Input type="number" value={form.vat_rate} onChange={u("vat_rate")} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Cena zakupu brutto</Label>
          <Input type="number" step="0.01"
            value={(() => { const net = parseFloat(form.purchase_net) || 0; const vat = parseFloat(form.vat_rate) || 23; return net > 0 ? (net * (1 + vat / 100)).toFixed(2) : ""; })()}
            onChange={(e) => { const gross = parseFloat(e.target.value) || 0; const vat = parseFloat(form.vat_rate) || 23; setForm({ ...form, purchase_net: (gross / (1 + vat / 100)).toFixed(2) }); }}
          />
          <p className="text-[10px] text-muted-foreground tabular-nums">netto: {(parseFloat(form.purchase_net) || 0).toFixed(2)} zł</p>
        </div>
        <div className="space-y-1">
          <Label>Cena sprzedaży brutto</Label>
          <Input type="number" step="0.01"
            value={(() => { const net = parseFloat(form.sale_net) || 0; const vat = parseFloat(form.vat_rate) || 23; return net > 0 ? (net * (1 + vat / 100)).toFixed(2) : ""; })()}
            onChange={(e) => { const gross = parseFloat(e.target.value) || 0; const vat = parseFloat(form.vat_rate) || 23; setForm({ ...form, sale_net: (gross / (1 + vat / 100)).toFixed(2) }); }}
          />
          <p className="text-[10px] text-muted-foreground tabular-nums">netto: {(parseFloat(form.sale_net) || 0).toFixed(2)} zł</p>
        </div>
      </div>
      <div className="space-y-1"><Label>Notatki</Label><Input value={form.notes} onChange={u("notes")} /></div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Zapisywanie..." : isEdit ? "Zapisz zmiany" : "Dodaj pozycję"}
      </Button>
    </form>
  );
}

// ── Movement Form ──
function MovementForm({ type, currentStock, onSubmit, loading }: { type: "IN" | "OUT"; currentStock: number; onSubmit: (d: any) => void; loading: boolean }) {
  const [quantity, setQuantity] = useState("1");
  const [sourceType, setSourceType] = useState("MANUAL");
  const [notes, setNotes] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const qty = parseFloat(quantity) || 0;
  const newStock = type === "IN" ? currentStock + qty : currentStock - qty;
  const isInvalid = type === "OUT" && qty > currentStock;

  function handleSubmit() {
    if (isInvalid) { toast.error("Niewystarczający stan magazynowy"); return; }
    if (qty <= 0) { toast.error("Podaj ilość większą od 0"); return; }
    setShowConfirm(true);
  }

  function handleConfirm() {
    setShowConfirm(false);
    onSubmit({ quantity: qty, source_type: sourceType, notes: notes || null });
  }

  if (showConfirm) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-2">
          <div className="text-sm font-medium">Potwierdzenie operacji</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><span className="text-muted-foreground">Przed:</span> <span className="font-bold">{currentStock}</span></div>
            <div className="text-center"><span className="font-bold">{type === "IN" ? "+" : "−"}{qty}</span></div>
            <div className="text-right"><span className="text-muted-foreground">Po:</span> <span className="font-bold">{newStock}</span></div>
          </div>
          {notes && <div className="text-xs text-muted-foreground">Notatka: {notes}</div>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Cofnij</Button>
          <Button className="flex-1" disabled={loading} onClick={handleConfirm}>
            {loading ? "Zapisywanie..." : "Potwierdź"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">Aktualny stan:</span>{" "}
        <span className="font-bold">{currentStock}</span>
        {qty > 0 && (
          <span className="ml-2">
            → <span className={`font-bold ${isInvalid ? "text-destructive" : ""}`}>{newStock}</span>
          </span>
        )}
      </div>
      <div className="space-y-1">
        <Label>Ilość</Label>
        <Input type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        {isInvalid && <p className="text-xs text-destructive">Niewystarczający stan magazynowy (dostępne: {currentStock})</p>}
      </div>
      <div className="space-y-1">
        <Label>Źródło</Label>
        <Select value={sourceType} onValueChange={setSourceType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MANUAL">Ręczne</SelectItem>
            <SelectItem value="PURCHASE">Zakup</SelectItem>
            <SelectItem value="SERVICE_ORDER">Zlecenie serwisowe</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Notatki</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <Button className="w-full" disabled={loading || isInvalid || qty <= 0} onClick={handleSubmit}>
        {type === "IN" ? "Przyjmij towar" : "Wydaj towar"}
      </Button>
    </div>
  );
}

// ── Adjustment Form ──
function AdjustmentForm({ currentStock, onSubmit, loading }: {
  currentStock: number;
  onSubmit: (d: { quantity: number; movement_type: MovementType; notes: string }) => void;
  loading: boolean;
}) {
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<MovementType>("OUT");
  const [notes, setNotes] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const qty = parseFloat(quantity) || 0;

  let newStock = currentStock;
  if (reason === "IN") newStock = currentStock + qty;
  else if (reason === "ADJUSTMENT") newStock = qty;
  else newStock = currentStock - qty;

  const isDecrease = ["OUT", "DAMAGE", "INTERNAL_USE"].includes(reason);
  const isInvalid = isDecrease && qty > currentStock;

  function handleSubmit() {
    if (qty <= 0 && reason !== "ADJUSTMENT") { toast.error("Podaj ilość większą od 0"); return; }
    if (isInvalid) { toast.error("Niewystarczający stan magazynowy"); return; }
    if (!notes.trim()) { toast.error("Podaj powód korekty"); return; }
    setShowConfirm(true);
  }

  function handleConfirm() {
    setShowConfirm(false);
    onSubmit({ quantity: qty, movement_type: reason, notes: notes.trim() });
  }

  if (showConfirm) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-2">
          <div className="text-sm font-medium">Potwierdzenie korekty</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><span className="text-muted-foreground">Przed:</span> <span className="font-bold">{currentStock}</span></div>
            <div className="text-center">
              <span className="font-bold">
                {reason === "ADJUSTMENT" ? `= ${qty}` : reason === "IN" ? `+${qty}` : `−${qty}`}
              </span>
            </div>
            <div className="text-right"><span className="text-muted-foreground">Po:</span> <span className="font-bold">{newStock}</span></div>
          </div>
          <div className="text-xs text-muted-foreground">Typ: {MOVEMENT_LABELS[reason]}</div>
          <div className="text-xs text-muted-foreground">Powód: {notes}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Cofnij</Button>
          <Button className="flex-1" disabled={loading} onClick={handleConfirm}>
            {loading ? "Zapisywanie..." : "Potwierdź korektę"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">Aktualny stan:</span>{" "}
        <span className="font-bold">{currentStock}</span>
        {qty > 0 && (
          <span className="ml-2">
            → <span className={`font-bold ${isInvalid ? "text-destructive" : ""}`}>{newStock}</span>
          </span>
        )}
      </div>
      <div className="space-y-1">
        <Label>Rodzaj korekty</Label>
        <Select value={reason} onValueChange={(v) => setReason(v as MovementType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="IN">Zwiększenie stanu (+)</SelectItem>
            <SelectItem value="OUT">Zmniejszenie stanu (−)</SelectItem>
            <SelectItem value="ADJUSTMENT">Korekta absolutna (ustaw stan)</SelectItem>
            <SelectItem value="DAMAGE">Uszkodzenie / utrata (−)</SelectItem>
            <SelectItem value="INTERNAL_USE">Użycie wewnętrzne (−)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>{reason === "ADJUSTMENT" ? "Nowy stan" : "Ilość"}</Label>
        <Input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        {isInvalid && <p className="text-xs text-destructive">Niewystarczający stan magazynowy (dostępne: {currentStock})</p>}
      </div>
      <div className="space-y-1">
        <Label>Powód / notatka *</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opisz powód korekty..." rows={3} />
      </div>
      <Button className="w-full" disabled={loading || !notes.trim() || isInvalid || (qty <= 0 && reason !== "ADJUSTMENT")} onClick={handleSubmit}>
        Zapisz korektę
      </Button>
    </div>
  );
}
