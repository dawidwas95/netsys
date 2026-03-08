import { useState, useMemo } from "react";
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
  History, Pencil, Trash2, Archive, MinusCircle,
} from "lucide-react";

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
  const [moveOpen, setMoveOpen] = useState<{ itemId: string; itemName: string; type: "IN" | "OUT" } | null>(null);
  const [adjustOpen, setAdjustOpen] = useState<{ itemId: string; itemName: string; action: "increase" | "decrease" | "damage" | "internal" } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<any>(null);
  const [search, setSearch] = useState("");
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

  const displayItems = useMemo(() => {
    let list = showArchived ? items : items.filter((i: any) => !i.is_archived);
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((i: any) =>
      i.name?.toLowerCase().includes(q) ||
      i.sku?.toLowerCase().includes(q) ||
      i.manufacturer?.toLowerCase().includes(q) ||
      i.model?.toLowerCase().includes(q)
    );
  }, [items, search, showArchived]);

  const activeItems = useMemo(() => items.filter((i: any) => !i.is_archived), [items]);
  const lowStock = useMemo(() =>
    activeItems.filter((i: any) => i.stock_quantity <= i.minimum_quantity && i.is_active), [activeItems]
  );
  const totalValue = useMemo(() =>
    activeItems.reduce((sum: number, i: any) => sum + (Number(i.stock_quantity) * Number(i.purchase_net)), 0), [activeItems]
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
    queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
  };

  // ── Add item ──
  const addItem = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("inventory_items").insert(data);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setAddOpen(false); toast.success("Dodano pozycję magazynową"); },
    onError: () => toast.error("Błąd dodawania pozycji"),
  });

  // ── Edit item ──
  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("inventory_items").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setEditItem(null); toast.success("Zaktualizowano pozycję"); },
    onError: () => toast.error("Błąd aktualizacji"),
  });

  // ── Delete item ──
  const deleteItem = useMutation({
    mutationFn: async (item: any) => {
      // Check for movements
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

  // ── Archive item ──
  const archiveItem = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase.from("inventory_items")
        .update({ is_archived: !item.is_archived })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: (_, item) => {
      invalidateAll();
      setArchiveConfirm(null);
      toast.success(item.is_archived ? "Przywrócono pozycję" : "Zarchiwizowano pozycję");
    },
  });

  // ── Movement (IN/OUT from old flow) ──
  const addMovement = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("inventory_movements").insert({
        ...data,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setMoveOpen(null);
      toast.success("Zapisano ruch magazynowy");
    },
    onError: () => toast.error("Błąd zapisu ruchu"),
  });

  // ── Stock adjustment ──
  const addAdjustment = useMutation({
    mutationFn: async (data: { item_id: string; quantity: number; movement_type: MovementType; notes: string }) => {
      const { error } = await supabase.from("inventory_movements").insert({
        item_id: data.item_id,
        movement_type: data.movement_type,
        quantity: data.quantity,
        source_type: "MANUAL",
        notes: data.notes,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setAdjustOpen(null);
      toast.success("Zapisano korektę stanu");
    },
    onError: () => toast.error("Błąd zapisu korekty"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Magazyn</h1>
          <p className="text-sm text-muted-foreground">Części, towary i materiały</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Dodaj pozycję</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nowa pozycja magazynowa</DialogTitle></DialogHeader>
            <ItemForm onSubmit={(d) => addItem.mutate(d)} loading={addItem.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4">
          <div className="text-xs text-muted-foreground">Pozycji w magazynie</div>
          <div className="text-2xl font-bold">{activeItems.length}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <div className="text-xs text-muted-foreground">Wartość magazynu (netto)</div>
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
          <div className="flex items-center gap-4">
            <Input
              placeholder="Szukaj po nazwie, SKU, producencie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded" />
              Pokaż archiwalne
            </label>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nazwa</TableHead>
                    <TableHead>Producent / Model</TableHead>
                    <TableHead>Kategoria</TableHead>
                    <TableHead className="text-right">Stan</TableHead>
                    <TableHead className="text-right">Min.</TableHead>
                    <TableHead className="text-right">Zakup netto</TableHead>
                    <TableHead className="text-right">Sprzedaż netto</TableHead>
                    <TableHead>Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Ładowanie...</TableCell></TableRow>
                  ) : displayItems.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Brak pozycji</TableCell></TableRow>
                  ) : (
                    displayItems.map((item: any) => {
                      const isLow = item.stock_quantity <= item.minimum_quantity && item.is_active && !item.is_archived;
                      return (
                        <TableRow key={item.id} className={`${isLow ? "bg-amber-500/5" : ""} ${item.is_archived ? "opacity-50" : ""}`}>
                          <TableCell className="font-mono text-xs">{item.sku || "—"}</TableCell>
                          <TableCell className="font-medium">
                            {item.name}
                            {item.is_archived && <Badge variant="outline" className="ml-2 text-xs">Archiwum</Badge>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {[item.manufacturer, item.model].filter(Boolean).join(" ") || "—"}
                          </TableCell>
                          <TableCell>
                            {item.category && <Badge variant="outline" className="text-xs">{item.category}</Badge>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {isLow && <AlertTriangle className="inline h-3 w-3 text-amber-400 mr-1" />}
                            {Number(item.stock_quantity)} {item.unit}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{Number(item.minimum_quantity)}</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(item.purchase_net).toFixed(2)} zł</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(item.sale_net).toFixed(2)} zł</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              <Button size="sm" variant="ghost" className="h-7 px-2" title="Przyjęcie"
                                onClick={() => setMoveOpen({ itemId: item.id, itemName: item.name, type: "IN" })}>
                                <ArrowDownToLine className="h-3 w-3 text-emerald-400" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2" title="Wydanie"
                                onClick={() => setMoveOpen({ itemId: item.id, itemName: item.name, type: "OUT" })}>
                                <ArrowUpFromLine className="h-3 w-3 text-red-400" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2" title="Korekta/Ubytek"
                                onClick={() => setAdjustOpen({ itemId: item.id, itemName: item.name, action: "decrease" })}>
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

      {/* Movement Dialog (IN/OUT) */}
      <Dialog open={!!moveOpen} onOpenChange={() => setMoveOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {moveOpen?.type === "IN" ? "Przyjęcie towaru" : "Wydanie towaru"}: {moveOpen?.itemName}
            </DialogTitle>
          </DialogHeader>
          <MovementForm
            type={moveOpen?.type || "IN"}
            onSubmit={(d) => addMovement.mutate({ ...d, item_id: moveOpen?.itemId, movement_type: moveOpen?.type })}
            loading={addMovement.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edycja pozycji: {editItem?.name}</DialogTitle></DialogHeader>
          {editItem && (
            <ItemForm
              initialData={editItem}
              isEdit
              onSubmit={(d) => updateItem.mutate({ id: editItem.id, data: d })}
              loading={updateItem.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={!!adjustOpen} onOpenChange={() => setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Korekta stanu: {adjustOpen?.itemName}</DialogTitle>
          </DialogHeader>
          {adjustOpen && (
            <AdjustmentForm
              onSubmit={(d) => addAdjustment.mutate({ item_id: adjustOpen.itemId, ...d })}
              loading={addAdjustment.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć pozycję?</AlertDialogTitle>
            <AlertDialogDescription>
              Pozycja "{deleteConfirm?.name}" zostanie trwale usunięta. Operacja jest nieodwracalna.
              Usunięcie jest możliwe tylko gdy stan = 0 i brak powiązanych ruchów.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteItem.mutate(deleteConfirm)} className="bg-destructive text-destructive-foreground">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveConfirm} onOpenChange={() => setArchiveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{archiveConfirm?.is_archived ? "Przywrócić pozycję?" : "Zarchiwizować pozycję?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveConfirm?.is_archived
                ? `Pozycja "${archiveConfirm?.name}" zostanie przywrócona do aktywnych.`
                : `Pozycja "${archiveConfirm?.name}" zostanie zarchiwizowana i nie będzie widoczna na liście.`}
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

// ── Item Form (Add / Edit) ──
function ItemForm({ onSubmit, loading, initialData, isEdit }: {
  onSubmit: (d: any) => void;
  loading: boolean;
  initialData?: any;
  isEdit?: boolean;
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
    };
    // Only include stock_quantity for new items
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
        <div className="space-y-1"><Label>SKU</Label><Input value={form.sku} onChange={u("sku")} placeholder="np. RAM-DDR4-16" /></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1"><Label>Kategoria</Label><Input value={form.category} onChange={u("category")} /></div>
        <div className="space-y-1"><Label>Producent</Label><Input value={form.manufacturer} onChange={u("manufacturer")} /></div>
        <div className="space-y-1"><Label>Model</Label><Input value={form.model} onChange={u("model")} /></div>
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
        <div className="space-y-1"><Label>Cena zakupu netto</Label><Input type="number" step="0.01" value={form.purchase_net} onChange={u("purchase_net")} /></div>
        <div className="space-y-1"><Label>Cena sprzedaży netto</Label><Input type="number" step="0.01" value={form.sale_net} onChange={u("sale_net")} /></div>
      </div>
      <div className="space-y-1"><Label>Notatki</Label><Input value={form.notes} onChange={u("notes")} /></div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Zapisywanie..." : isEdit ? "Zapisz zmiany" : "Dodaj pozycję"}
      </Button>
    </form>
  );
}

// ── Movement Form (IN/OUT) ──
function MovementForm({ type, onSubmit, loading }: {
  type: "IN" | "OUT";
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [quantity, setQuantity] = useState("1");
  const [sourceType, setSourceType] = useState("MANUAL");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Ilość</Label>
        <Input type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
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
      <div className="space-y-1">
        <Label>Notatki</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button className="w-full" disabled={loading} onClick={() => onSubmit({
        quantity: parseFloat(quantity) || 0,
        source_type: sourceType,
        notes: notes || null,
      })}>
        {loading ? "Zapisywanie..." : type === "IN" ? "Przyjmij towar" : "Wydaj towar"}
      </Button>
    </div>
  );
}

// ── Adjustment Form (manual increase/decrease/damage/internal) ──
function AdjustmentForm({ onSubmit, loading }: {
  onSubmit: (d: { quantity: number; movement_type: MovementType; notes: string }) => void;
  loading: boolean;
}) {
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<MovementType>("ADJUSTMENT");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Rodzaj korekty</Label>
        <Select value={reason} onValueChange={(v) => setReason(v as MovementType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="IN">Zwiększenie stanu (korekta +)</SelectItem>
            <SelectItem value="ADJUSTMENT">Korekta ręczna (ustawienie stanu)</SelectItem>
            <SelectItem value="OUT">Zmniejszenie stanu (korekta −)</SelectItem>
            <SelectItem value="DAMAGE">Uszkodzenie / utrata</SelectItem>
            <SelectItem value="INTERNAL_USE">Użycie wewnętrzne</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>{reason === "ADJUSTMENT" ? "Nowy stan" : "Ilość"}</Label>
        <Input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Powód / notatka *</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opisz powód korekty..." rows={3} />
      </div>
      <Button className="w-full" disabled={loading || !notes.trim()} onClick={() => onSubmit({
        quantity: parseFloat(quantity) || 0,
        movement_type: reason,
        notes: notes.trim(),
      })}>
        {loading ? "Zapisywanie..." : "Zapisz korektę"}
      </Button>
    </div>
  );
}
