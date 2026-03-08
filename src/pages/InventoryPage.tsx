import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Package, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, History } from "lucide-react";

export default function InventoryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState<{ itemId: string; itemName: string; type: "IN" | "OUT" } | null>(null);
  const [search, setSearch] = useState("");

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
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i: any) =>
      i.name?.toLowerCase().includes(q) ||
      i.sku?.toLowerCase().includes(q) ||
      i.manufacturer?.toLowerCase().includes(q) ||
      i.model?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const lowStock = useMemo(() =>
    items.filter((i: any) => i.stock_quantity <= i.minimum_quantity && i.is_active),
    [items]
  );

  const totalValue = useMemo(() =>
    items.reduce((sum: number, i: any) => sum + (Number(i.stock_quantity) * Number(i.purchase_net)), 0),
    [items]
  );

  const addItem = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("inventory_items").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      setAddOpen(false);
      supabase.from("activity_logs").insert({
        entity_type: "inventory_item", entity_id: "new", action_type: "CREATE",
        user_id: user?.id,
        // @ts-ignore
        description: "Dodano pozycję magazynową",
      }).then();
      toast.success("Dodano pozycję magazynową");
    },
    onError: () => toast.error("Błąd dodawania pozycji"),
  });

  const addMovement = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("inventory_movements").insert({
        ...data,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
      setMoveOpen(null);
      toast.success("Zapisano ruch magazynowy");
    },
    onError: () => toast.error("Błąd zapisu ruchu"),
  });

  const MOVEMENT_LABELS: Record<string, string> = {
    IN: "Przyjęcie", OUT: "Wydanie", ADJUSTMENT: "Korekta", RESERVATION: "Rezerwacja",
  };

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
            <AddItemForm onSubmit={(d) => addItem.mutate(d)} loading={addItem.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground">Pozycji w magazynie</div>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground">Wartość magazynu (netto)</div>
            <div className="text-2xl font-bold">{totalValue.toFixed(2)} zł</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-400" /> Niski stan
            </div>
            <div className="text-2xl font-bold text-amber-400">{lowStock.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground">Ostatnie ruchy (100)</div>
            <div className="text-2xl font-bold">{movements.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items"><Package className="mr-1 h-4 w-4" />Pozycje</TabsTrigger>
          <TabsTrigger value="movements"><History className="mr-1 h-4 w-4" />Historia ruchów</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          <Input
            placeholder="Szukaj po nazwie, SKU, producencie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
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
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Brak pozycji</TableCell></TableRow>
                  ) : (
                    filtered.map((item: any) => {
                      const isLow = item.stock_quantity <= item.minimum_quantity && item.is_active;
                      return (
                        <TableRow key={item.id} className={isLow ? "bg-amber-500/5" : ""}>
                          <TableCell className="font-mono text-xs">{item.sku || "—"}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
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
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2"
                                onClick={() => setMoveOpen({ itemId: item.id, itemName: item.name, type: "IN" })}>
                                <ArrowDownToLine className="h-3 w-3 text-emerald-400" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2"
                                onClick={() => setMoveOpen({ itemId: item.id, itemName: item.name, type: "OUT" })}>
                                <ArrowUpFromLine className="h-3 w-3 text-red-400" />
                              </Button>
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
                    <TableHead>Notatki</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Brak ruchów</TableCell></TableRow>
                  ) : (
                    movements.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{new Date(m.created_at).toLocaleDateString("pl-PL")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            m.movement_type === "IN" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                            m.movement_type === "OUT" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                            "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          }>
                            {MOVEMENT_LABELS[m.movement_type] || m.movement_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{m.inventory_items?.name || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {m.movement_type === "IN" ? "+" : m.movement_type === "OUT" ? "-" : ""}{Number(m.quantity)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.source_type}</TableCell>
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
    </div>
  );
}

function AddItemForm({ onSubmit, loading }: { onSubmit: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    name: "", sku: "", category: "", manufacturer: "", model: "",
    unit: "szt.", purchase_net: "0", sale_net: "0", vat_rate: "23",
    minimum_quantity: "0", stock_quantity: "0", notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Podaj nazwę"); return; }
    onSubmit({
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
      stock_quantity: parseFloat(form.stock_quantity) || 0,
      notes: form.notes || null,
    });
  };

  const u = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Nazwa *</Label>
          <Input value={form.name} onChange={u("name")} />
        </div>
        <div className="space-y-1">
          <Label>SKU</Label>
          <Input value={form.sku} onChange={u("sku")} placeholder="np. RAM-DDR4-16" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1"><Label>Kategoria</Label><Input value={form.category} onChange={u("category")} /></div>
        <div className="space-y-1"><Label>Producent</Label><Input value={form.manufacturer} onChange={u("manufacturer")} /></div>
        <div className="space-y-1"><Label>Model</Label><Input value={form.model} onChange={u("model")} /></div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-1"><Label>Jednostka</Label><Input value={form.unit} onChange={u("unit")} /></div>
        <div className="space-y-1"><Label>Stan początkowy</Label><Input type="number" value={form.stock_quantity} onChange={u("stock_quantity")} /></div>
        <div className="space-y-1"><Label>Stan minimalny</Label><Input type="number" value={form.minimum_quantity} onChange={u("minimum_quantity")} /></div>
        <div className="space-y-1"><Label>VAT %</Label><Input type="number" value={form.vat_rate} onChange={u("vat_rate")} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Cena zakupu netto</Label><Input type="number" step="0.01" value={form.purchase_net} onChange={u("purchase_net")} /></div>
        <div className="space-y-1"><Label>Cena sprzedaży netto</Label><Input type="number" step="0.01" value={form.sale_net} onChange={u("sale_net")} /></div>
      </div>
      <div className="space-y-1"><Label>Notatki</Label><Input value={form.notes} onChange={u("notes")} /></div>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Zapisywanie..." : "Dodaj pozycję"}</Button>
    </form>
  );
}

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
