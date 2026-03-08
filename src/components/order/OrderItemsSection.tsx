import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Trash2, Package, PenLine, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  order_id: string;
  inventory_item_id: string | null;
  item_name_snapshot: string;
  quantity: number;
  sale_net: number;
  purchase_net: number;
  total_sale_net: number;
  total_purchase_net: number;
  created_at: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  manufacturer: string | null;
  model: string | null;
  stock_quantity: number;
  minimum_quantity: number;
  purchase_net: number;
  sale_net: number;
  unit: string;
  is_active: boolean;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

interface OrderItemsSectionProps {
  orderId: string;
  orderItems: OrderItem[];
  isCompleted: boolean;
  onItemsChanged: () => void;
}

export function OrderItemsSection({ orderId, orderItems, isCompleted, onItemsChanged }: OrderItemsSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"inventory" | "custom">("inventory");
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedInvItem, setSelectedInvItem] = useState<InventoryItem | null>(null);
  const [invQuantity, setInvQuantity] = useState("1");
  const [invSaleNet, setInvSaleNet] = useState("");
  const [customItem, setCustomItem] = useState({ name: "", quantity: "1", sale_net: "", purchase_net: "", note: "" });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, sku, manufacturer, model, stock_quantity, minimum_quantity, purchase_net, sale_net, unit, is_active, inventory_number, compatible_models, category")
        .eq("is_active", true)
        .eq("is_archived", false)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  const filteredInventory = useMemo(() => {
    if (!inventorySearch) return inventoryItems;
    const q = inventorySearch.toLowerCase();
    return inventoryItems.filter((i: any) =>
      i.name.toLowerCase().includes(q) ||
      i.sku?.toLowerCase().includes(q) ||
      i.inventory_number?.toLowerCase().includes(q) ||
      i.manufacturer?.toLowerCase().includes(q) ||
      i.model?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      (i.compatible_models || []).some((m: string) => m.toLowerCase().includes(q))
    );
  }, [inventoryItems, inventorySearch]);

  function selectInventoryItem(item: InventoryItem) {
    setSelectedInvItem(item);
    setInvQuantity("1");
    setInvSaleNet(item.sale_net.toString());
  }

  function resetDialog() {
    setDialogOpen(false);
    setSelectedInvItem(null);
    setInventorySearch("");
    setInvQuantity("1");
    setInvSaleNet("");
    setCustomItem({ name: "", quantity: "1", sale_net: "", purchase_net: "", note: "" });
    setDialogTab("inventory");
  }

  // ── Add inventory item ──
  const addInventoryItem = useMutation({
    mutationFn: async () => {
      if (!selectedInvItem) throw new Error("Nie wybrano pozycji");
      const qty = parseFloat(invQuantity) || 1;
      const saleNet = parseFloat(invSaleNet) || 0;
      const purchaseNet = selectedInvItem.purchase_net;

      // Check stock
      if (qty > selectedInvItem.stock_quantity) {
        throw new Error(`Niewystarczający stan magazynowy. Dostępne: ${selectedInvItem.stock_quantity} ${selectedInvItem.unit}`);
      }

      const { error } = await supabase.from("service_order_items").insert({
        order_id: orderId,
        inventory_item_id: selectedInvItem.id,
        item_name_snapshot: selectedInvItem.name,
        quantity: qty,
        sale_net: saleNet,
        purchase_net: purchaseNet,
        total_sale_net: qty * saleNet,
        total_purchase_net: qty * purchaseNet,
        created_by: user?.id,
      });
      if (error) throw error;

      // Create inventory OUT movement immediately (reserve stock)
      await supabase.from("inventory_movements").insert({
        item_id: selectedInvItem.id,
        movement_type: "OUT",
        quantity: qty,
        source_type: "SERVICE_ORDER",
        source_id: orderId,
        sale_net: saleNet,
        purchase_net: purchaseNet,
        notes: `Zlecenie: ${orderId.slice(0, 8)}...`,
        created_by: user?.id,
      });

      // Log audit
      await supabase.from("activity_logs").insert({
        entity_type: "service_order",
        entity_id: orderId,
        action_type: "INVENTORY_OUT",
        user_id: user?.id,
        description: `Użyto ${qty}× ${selectedInvItem.name} z magazynu`,
        entity_name: selectedInvItem.name,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-items", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items-active"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
      onItemsChanged();
      resetDialog();
      toast.success("Dodano część z magazynu");
    },
    onError: (err: any) => toast.error(err.message || "Błąd dodawania"),
  });

  // ── Add custom item ──
  const addCustomItem = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(customItem.quantity) || 1;
      const saleNet = parseFloat(customItem.sale_net) || 0;
      const purchaseNet = parseFloat(customItem.purchase_net) || 0;
      if (!customItem.name.trim()) throw new Error("Podaj nazwę pozycji");

      const { error } = await supabase.from("service_order_items").insert({
        order_id: orderId,
        inventory_item_id: null,
        item_name_snapshot: customItem.name.trim(),
        quantity: qty,
        sale_net: saleNet,
        purchase_net: purchaseNet,
        total_sale_net: qty * saleNet,
        total_purchase_net: qty * purchaseNet,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-items", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      onItemsChanged();
      resetDialog();
      toast.success("Dodano pozycję niestandardową");
    },
    onError: (err: any) => toast.error(err.message || "Błąd dodawania"),
  });

  // ── Delete item ──
  const deleteItem = useMutation({
    mutationFn: async (item: OrderItem) => {
      // If linked to inventory, reverse the movement
      if (item.inventory_item_id) {
        // Delete the OUT movement linked to this order + item
        const { data: movements } = await supabase
          .from("inventory_movements")
          .select("id")
          .eq("item_id", item.inventory_item_id)
          .eq("source_id", orderId)
          .eq("source_type", "SERVICE_ORDER")
          .eq("movement_type", "OUT");

        if (movements && movements.length > 0) {
          // Create a reversal IN movement
          await supabase.from("inventory_movements").insert({
            item_id: item.inventory_item_id,
            movement_type: "IN",
            quantity: item.quantity,
            source_type: "SERVICE_ORDER",
            source_id: orderId,
            notes: `Zwrot: usunięto z zlecenia`,
            created_by: user?.id,
          });
        }
      }

      const { error } = await supabase.from("service_order_items").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-items", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items-active"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
      onItemsChanged();
      toast.success("Usunięto pozycję (stan magazynowy przywrócony)");
    },
  });

  const stockWarning = selectedInvItem && parseFloat(invQuantity) > selectedInvItem.stock_quantity;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Pozycje / Części</span>
          <span className="text-xs text-muted-foreground">({orderItems.length})</span>
        </div>
        {!isCompleted && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Plus className="mr-1 h-3 w-3" />Dodaj</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader><DialogTitle>Dodaj pozycję do zlecenia</DialogTitle></DialogHeader>
              <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="w-full">
                  <TabsTrigger value="inventory" className="flex-1"><Package className="mr-1 h-3 w-3" />Z magazynu</TabsTrigger>
                  <TabsTrigger value="custom" className="flex-1"><PenLine className="mr-1 h-3 w-3" />Niestandardowa</TabsTrigger>
                </TabsList>

                <TabsContent value="inventory" className="flex-1 overflow-hidden flex flex-col space-y-3 mt-3">
                  {!selectedInvItem ? (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Szukaj: ID, nazwa, producent, model kompatybilny..."
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          className="pl-9"
                          autoFocus
                        />
                      </div>
                      <div className="flex-1 overflow-auto border rounded-md">
                        <Table>
                          <TableHeader>
                             <TableRow>
                              <TableHead>ID / Nazwa</TableHead>
                              <TableHead className="text-right">Stan</TableHead>
                              <TableHead className="text-right">Zakup</TableHead>
                              <TableHead className="text-right">Sprzedaż</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredInventory.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                  {inventorySearch ? "Brak wyników" : "Brak pozycji magazynowych"}
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredInventory.map((item: any) => {
                                const isLow = item.stock_quantity <= item.minimum_quantity;
                                const noStock = item.stock_quantity <= 0;
                                return (
                                  <TableRow
                                    key={item.id}
                                    className={cn(
                                      "cursor-pointer hover:bg-muted/50 transition-colors",
                                      noStock && "opacity-50",
                                      isLow && !noStock && "bg-amber-500/5"
                                    )}
                                    onClick={() => !noStock && selectInventoryItem(item)}
                                  >
                                    <TableCell>
                                      {item.inventory_number && <div className="font-mono text-[10px] text-primary">{item.inventory_number}</div>}
                                      <div className="font-medium text-sm">{item.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {[item.manufacturer, item.model].filter(Boolean).join(" ")}
                                        {(item.compatible_models || []).length > 0 && (
                                          <span className="ml-1">· {item.compatible_models.slice(0, 2).join(", ")}{item.compatible_models.length > 2 ? "..." : ""}</span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      <div className="flex items-center justify-end gap-1">
                                        {isLow && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                                        <span className={cn("font-medium", noStock && "text-destructive")}>
                                          {item.stock_quantity} {item.unit}
                                        </span>
                                      </div>
                                      {isLow && (
                                        <div className="text-[10px] text-amber-400">min: {item.minimum_quantity}</div>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-xs">{formatCurrency(item.purchase_net)}</TableCell>
                                    <TableCell className="text-right tabular-nums text-xs">{formatCurrency(item.sale_net)}</TableCell>
                                    <TableCell>
                                      {noStock ? (
                                        <Badge variant="outline" className="text-[10px] text-destructive">Brak</Badge>
                                      ) : (
                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); selectInventoryItem(item); }}>
                                          Wybierz
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{selectedInvItem.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {[selectedInvItem.manufacturer, selectedInvItem.model].filter(Boolean).join(" ")}
                              {selectedInvItem.sku && ` · SKU: ${selectedInvItem.sku}`}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedInvItem(null)} className="text-xs">
                            Zmień
                          </Button>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Stan: </span>
                            <span className={cn("font-medium", selectedInvItem.stock_quantity <= selectedInvItem.minimum_quantity && "text-amber-400")}>
                              {selectedInvItem.stock_quantity} {selectedInvItem.unit}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Zakup: </span>
                            <span className="font-mono">{formatCurrency(selectedInvItem.purchase_net)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label>Ilość *</Label>
                          <Input
                            type="number"
                            min="1"
                            max={selectedInvItem.stock_quantity}
                            value={invQuantity}
                            onChange={(e) => setInvQuantity(e.target.value)}
                          />
                          {stockWarning && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Niewystarczający stan! Dostępne: {selectedInvItem.stock_quantity}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label>Cena sprzedaży netto</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={invSaleNet}
                            onChange={(e) => setInvSaleNet(e.target.value)}
                            placeholder={selectedInvItem.sale_net.toString()}
                          />
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Koszt zakupu:</span>
                          <span className="font-mono">{formatCurrency((parseFloat(invQuantity) || 0) * selectedInvItem.purchase_net)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Przychód sprzedaży:</span>
                          <span className="font-mono">{formatCurrency((parseFloat(invQuantity) || 0) * (parseFloat(invSaleNet) || selectedInvItem.sale_net))}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1">
                          <span className="font-medium">Zysk:</span>
                          <span className={cn(
                            "font-mono font-medium",
                            ((parseFloat(invQuantity) || 0) * ((parseFloat(invSaleNet) || selectedInvItem.sale_net) - selectedInvItem.purchase_net)) >= 0
                              ? "text-primary" : "text-destructive"
                          )}>
                            {formatCurrency((parseFloat(invQuantity) || 0) * ((parseFloat(invSaleNet) || selectedInvItem.sale_net) - selectedInvItem.purchase_net))}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={resetDialog}>Anuluj</Button>
                        <Button
                          onClick={() => addInventoryItem.mutate()}
                          disabled={!selectedInvItem || !!stockWarning || addInventoryItem.isPending}
                        >
                          {addInventoryItem.isPending ? "Dodawanie..." : "Dodaj część z magazynu"}
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="custom" className="space-y-4 mt-3">
                  <div className="space-y-1">
                    <Label>Nazwa *</Label>
                    <Input
                      value={customItem.name}
                      onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                      placeholder="np. Adapter USB-C"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Ilość</Label>
                      <Input type="number" min="1" value={customItem.quantity} onChange={(e) => setCustomItem({ ...customItem, quantity: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cena sprzedaży netto</Label>
                      <Input type="number" step="0.01" value={customItem.sale_net} onChange={(e) => setCustomItem({ ...customItem, sale_net: e.target.value })} placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cena zakupu netto</Label>
                      <Input type="number" step="0.01" value={customItem.purchase_net} onChange={(e) => setCustomItem({ ...customItem, purchase_net: e.target.value })} placeholder="0.00" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notatka</Label>
                    <Input value={customItem.note} onChange={(e) => setCustomItem({ ...customItem, note: e.target.value })} placeholder="Opcjonalna notatka" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetDialog}>Anuluj</Button>
                    <Button
                      onClick={() => addCustomItem.mutate()}
                      disabled={!customItem.name.trim() || addCustomItem.isPending}
                    >
                      {addCustomItem.isPending ? "Dodawanie..." : "Dodaj pozycję niestandardową"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Items table */}
      {orderItems.length > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazwa</TableHead>
                <TableHead className="text-center w-14">Ilość</TableHead>
                <TableHead className="text-right">Zakup</TableHead>
                <TableHead className="text-right">Sprzedaż</TableHead>
                <TableHead className="text-right">Zysk</TableHead>
                <TableHead className="text-center w-16">Źródło</TableHead>
                {!isCompleted && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderItems.map((item) => {
                const profit = item.total_sale_net - item.total_purchase_net;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.item_name_snapshot}</TableCell>
                    <TableCell className="text-center tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{formatCurrency(item.total_purchase_net)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{formatCurrency(item.total_sale_net)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums text-xs font-medium", profit >= 0 ? "text-primary" : "text-destructive")}>
                      {formatCurrency(profit)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px]">
                        {item.inventory_item_id ? "Magazyn" : "Własna"}
                      </Badge>
                    </TableCell>
                    {!isCompleted && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => deleteItem.mutate(item)}
                          disabled={deleteItem.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {/* Totals row */}
              <TableRow className="bg-muted/30 font-medium">
                <TableCell>Razem</TableCell>
                <TableCell className="text-center tabular-nums">{orderItems.reduce((s, i) => s + i.quantity, 0)}</TableCell>
                <TableCell className="text-right tabular-nums text-xs">{formatCurrency(orderItems.reduce((s, i) => s + i.total_purchase_net, 0))}</TableCell>
                <TableCell className="text-right tabular-nums text-xs">{formatCurrency(orderItems.reduce((s, i) => s + i.total_sale_net, 0))}</TableCell>
                <TableCell className={cn(
                  "text-right tabular-nums text-xs",
                  orderItems.reduce((s, i) => s + i.total_sale_net - i.total_purchase_net, 0) >= 0 ? "text-primary" : "text-destructive"
                )}>
                  {formatCurrency(orderItems.reduce((s, i) => s + i.total_sale_net - i.total_purchase_net, 0))}
                </TableCell>
                <TableCell></TableCell>
                {!isCompleted && <TableCell></TableCell>}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-md">
          Brak pozycji — dodaj część z magazynu lub niestandardową
        </p>
      )}
    </div>
  );
}
