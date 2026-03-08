import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ShoppingCart, Package, AlertTriangle, Check, Search,
} from "lucide-react";
import { Link } from "react-router-dom";

function calcSuggestedOrder(minimum: number, current: number): number {
  const suggested = (minimum * 2) - current;
  return Math.max(suggested, 1);
}

export default function PurchaseListPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [orderQtyOverrides, setOrderQtyOverrides] = useState<Record<string, number>>({});
  const [orderedItems, setOrderedItems] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

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

  const lowStockItems = useMemo(() => {
    return items
      .filter((i: any) => {
        if (!i.is_active || i.is_archived) return false;
        const minQty = Number(i.minimum_quantity);
        if (minQty <= 0) return false;
        const available = Number(i.stock_quantity) - (reservedMap[i.id] || 0);
        return available <= minQty;
      })
      .filter((i: any) => !orderedItems.has(i.id));
  }, [items, reservedMap, orderedItems]);

  const filteredItems = useMemo(() => {
    if (!search) return lowStockItems;
    const q = search.toLowerCase();
    return lowStockItems.filter((i: any) =>
      i.name?.toLowerCase().includes(q) ||
      i.sku?.toLowerCase().includes(q) ||
      i.manufacturer?.toLowerCase().includes(q)
    );
  }, [lowStockItems, search]);

  const handleMarkOrdered = (itemId: string) => {
    setOrderedItems((prev) => new Set(prev).add(itemId));
    toast.success("Oznaczono jako zamówione");
  };

  const getOrderQty = (item: any) => {
    if (orderQtyOverrides[item.id] !== undefined) return orderQtyOverrides[item.id];
    const available = Number(item.stock_quantity) - (reservedMap[item.id] || 0);
    return calcSuggestedOrder(Number(item.minimum_quantity), available);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zakupy / Do zamówienia</h1>
          <p className="text-muted-foreground text-sm">
            Produkty z niskim stanem magazynowym wymagające zamówienia
          </p>
        </div>
        <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-lg px-3 py-1">
          <ShoppingCart className="h-4 w-4 mr-1" />
          {lowStockItems.length}
        </Badge>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj produktu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" asChild>
          <Link to="/inventory">
            <Package className="h-4 w-4 mr-2" />
            Magazyn
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Ładowanie...</p>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="text-lg font-medium">Wszystko w porządku!</p>
            <p className="text-muted-foreground text-sm">Brak produktów wymagających zamówienia.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produkt</TableHead>
                  <TableHead className="text-right">Stan</TableHead>
                  <TableHead className="text-right">Zarezerwowane</TableHead>
                  <TableHead className="text-right">Dostępne</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead className="text-right">Do zamówienia</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item: any) => {
                  const stock = Number(item.stock_quantity);
                  const reserved = reservedMap[item.id] || 0;
                  const available = stock - reserved;
                  const minimum = Number(item.minimum_quantity);
                  const orderQty = getOrderQty(item);

                  return (
                    <TableRow key={item.id} className="border-amber-500/10">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                          <div>
                            <span className="font-medium">{item.name}</span>
                            {item.sku && (
                              <span className="text-xs text-muted-foreground font-mono ml-2">
                                ({item.sku})
                              </span>
                            )}
                            {item.manufacturer && (
                              <div className="text-xs text-muted-foreground">{item.manufacturer}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {stock} {item.unit}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {reserved > 0 ? `${reserved} ${item.unit}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={available <= 0 ? "text-destructive font-bold" : "text-amber-500 font-medium"}>
                          {available} {item.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {minimum} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={1}
                          value={orderQty}
                          onChange={(e) =>
                            setOrderQtyOverrides((prev) => ({
                              ...prev,
                              [item.id]: Math.max(1, parseInt(e.target.value) || 1),
                            }))
                          }
                          className="w-20 ml-auto text-right font-mono"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkOrdered(item.id)}
                          className="text-primary border-primary/30 hover:bg-primary/10"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Zamówione
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {orderedItems.size > 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Oznaczono jako zamówione: {orderedItems.size} pozycji
          <Button
            variant="link"
            size="sm"
            className="ml-2"
            onClick={() => setOrderedItems(new Set())}
          >
            Pokaż ponownie
          </Button>
        </div>
      )}
    </div>
  );
}
