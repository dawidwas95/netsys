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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Trash2, ArrowDownToLine, ArrowUpFromLine, Search, PackagePlus, PackageMinus, FileText,
} from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { format } from "date-fns";

type WarehouseDocType = "PZ" | "WZ" | "PW" | "RW" | "CORRECTION";

const DOC_TYPE_CONFIG: Record<WarehouseDocType, { label: string; color: string; icon: typeof ArrowDownToLine; movementType: string; description: string }> = {
  PZ: { label: "PZ – Przyjęcie zewnętrzne", color: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30", icon: ArrowDownToLine, movementType: "IN", description: "Przyjęcie towaru od dostawcy" },
  WZ: { label: "WZ – Wydanie zewnętrzne", color: "bg-red-500/20 text-red-700 border-red-500/30", icon: ArrowUpFromLine, movementType: "OUT", description: "Wydanie towaru na zewnątrz" },
  PW: { label: "PW – Przyjęcie wewnętrzne", color: "bg-blue-500/20 text-blue-700 border-blue-500/30", icon: PackagePlus, movementType: "IN", description: "Wewnętrzne przyjęcie na magazyn" },
  RW: { label: "RW – Rozchód wewnętrzny", color: "bg-amber-500/20 text-amber-700 border-amber-500/30", icon: PackageMinus, movementType: "OUT", description: "Wewnętrzne wydanie / zużycie" },
  CORRECTION: { label: "KM – Korekta magazynowa", color: "bg-purple-500/20 text-purple-700 border-purple-500/30", icon: FileText, movementType: "ADJUSTMENT", description: "Ręczna korekta stanu magazynowego" },
};

const DOC_TYPE_SHORT: Record<WarehouseDocType, string> = {
  PZ: "PZ", WZ: "WZ", PW: "PW", RW: "RW", CORRECTION: "Korekta",
};

interface FormItem {
  inventory_item_id: string;
  quantity: string;
  price_net: string;
  notes: string;
}

const emptyItem = (): FormItem => ({ inventory_item_id: "", quantity: "1", price_net: "0", notes: "" });

export default function WarehouseDocumentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showTypeChooser, setShowTypeChooser] = useState(false);

  // Form state
  const [formType, setFormType] = useState<WarehouseDocType>("PZ");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formClientId, setFormClientId] = useState("");
  const [formOrderId, setFormOrderId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<FormItem[]>([emptyItem()]);

  // Queries
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["warehouse-documents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("warehouse_documents" as any)
        .select("*, warehouse_document_items(*)")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("id, name, inventory_number, stock_quantity, purchase_net, sale_net, unit")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-warehouse"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, company_name, first_name, last_name, display_name, nip")
        .eq("is_active", true)
        .order("company_name");
      return data || [];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders-for-warehouse"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("id, order_number")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, first_name, last_name");
      return data || [];
    },
  });

  const profileName = (uid: string | null) => {
    if (!uid) return "—";
    const p = profiles.find((pr: any) => pr.user_id === uid);
    return p ? (p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—") : "—";
  };

  // Mutations
  const saveMut = useMutation({
    mutationFn: async () => {
      const validItems = formItems.filter(i => i.inventory_item_id);
      if (!validItems.length) throw new Error("Dodaj przynajmniej jedną pozycję");

      if (editId) {
        // Delete old items & movements, then re-insert
        const { data: oldItems } = await supabase.from("warehouse_document_items" as any).select("id").eq("warehouse_document_id", editId);
        if (oldItems?.length) {
          for (const oi of oldItems) {
            await supabase.from("inventory_movements").delete().eq("source_id", (oi as any).id).eq("source_type", "DOCUMENT" as any);
          }
          await supabase.from("warehouse_document_items" as any).delete().eq("warehouse_document_id", editId);
        }
        await (supabase.from("warehouse_documents" as any) as any).update({
          document_date: formDate,
          client_id: formClientId || null,
          related_order_id: formOrderId || null,
          notes: formNotes || null,
        }).eq("id", editId);

        for (let i = 0; i < validItems.length; i++) {
          const it = validItems[i];
          const { data: inserted } = await supabase.from("warehouse_document_items" as any).insert({
            warehouse_document_id: editId,
            inventory_item_id: it.inventory_item_id,
            quantity: parseFloat(it.quantity) || 1,
            price_net: parseFloat(it.price_net) || 0,
            notes: it.notes || null,
            sort_order: i,
          }).select().single();

          if (inserted) {
            const cfg = DOC_TYPE_CONFIG[formType];
            await (supabase.from("inventory_movements") as any).insert({
              item_id: it.inventory_item_id,
              movement_type: cfg.movementType,
              quantity: parseFloat(it.quantity) || 1,
              purchase_net: parseFloat(it.price_net) || 0,
              source_id: (inserted as any).id,
              source_type: "DOCUMENT",
              notes: `${DOC_TYPE_SHORT[formType]} - ${formNotes || ""}`.trim(),
              created_by: user?.id || null,
            });
          }
        }
      } else {
        const { data: doc, error } = await supabase.from("warehouse_documents" as any).insert({
          document_type: formType,
          document_date: formDate,
          client_id: formClientId || null,
          related_order_id: formOrderId || null,
          notes: formNotes || null,
          created_by: user?.id || null,
        }).select().single();

        if (error || !doc) throw error || new Error("Nie udało się utworzyć dokumentu");

        for (let i = 0; i < validItems.length; i++) {
          const it = validItems[i];
          const { data: inserted } = await supabase.from("warehouse_document_items" as any).insert({
            warehouse_document_id: (doc as any).id,
            inventory_item_id: it.inventory_item_id,
            quantity: parseFloat(it.quantity) || 1,
            price_net: parseFloat(it.price_net) || 0,
            notes: it.notes || null,
            sort_order: i,
          }).select().single();

          if (inserted) {
            const cfg = DOC_TYPE_CONFIG[formType];
            await (supabase.from("inventory_movements") as any).insert({
              item_id: it.inventory_item_id,
              movement_type: cfg.movementType,
              quantity: parseFloat(it.quantity) || 1,
              purchase_net: parseFloat(it.price_net) || 0,
              source_id: (inserted as any).id,
              source_type: "DOCUMENT",
              notes: `${DOC_TYPE_SHORT[formType]} - ${formNotes || ""}`.trim(),
              created_by: user?.id || null,
            });
          }
        }
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Dokument zaktualizowany" : "Dokument utworzony");
      qc.invalidateQueries({ queryKey: ["warehouse-documents"] });
      qc.invalidateQueries({ queryKey: ["inventory-items-active"] });
      closeForm();
    },
    onError: (e: any) => toast.error(e.message || "Błąd zapisu"),
  });

  const deleteMut = useMutation({
    mutationFn: async (docId: string) => {
      const { data: items } = await supabase.from("warehouse_document_items" as any).select("id").eq("warehouse_document_id", docId);
      if (items?.length) {
        for (const it of items) {
          await supabase.from("inventory_movements").delete().eq("source_id", (it as any).id).eq("source_type", "DOCUMENT" as any);
        }
      }
      await supabase.from("warehouse_document_items" as any).delete().eq("warehouse_document_id", docId);
      await supabase.from("warehouse_documents" as any).delete().eq("id", docId);
    },
    onSuccess: () => {
      toast.success("Dokument usunięty");
      qc.invalidateQueries({ queryKey: ["warehouse-documents"] });
      qc.invalidateQueries({ queryKey: ["inventory-items-active"] });
    },
  });

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setFormItems([emptyItem()]);
    setFormNotes("");
    setFormClientId("");
    setFormOrderId("");
    setFormDate(format(new Date(), "yyyy-MM-dd"));
  }

  function openNew(type: WarehouseDocType) {
    setFormType(type);
    setEditId(null);
    setFormItems([emptyItem()]);
    setFormNotes("");
    setFormClientId("");
    setFormOrderId("");
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setShowTypeChooser(false);
    setShowForm(true);
  }

  function openEdit(doc: any) {
    setFormType(doc.document_type);
    setEditId(doc.id);
    setFormDate(doc.document_date);
    setFormClientId(doc.client_id || "");
    setFormOrderId(doc.related_order_id || "");
    setFormNotes(doc.notes || "");
    const items = (doc.warehouse_document_items || []).map((i: any) => ({
      inventory_item_id: i.inventory_item_id,
      quantity: String(i.quantity),
      price_net: String(i.price_net || 0),
      notes: i.notes || "",
    }));
    setFormItems(items.length ? items : [emptyItem()]);
    setShowForm(true);
  }

  // Filter
  const filtered = useMemo(() => {
    let list = docs;
    if (tab !== "ALL") list = list.filter((d: any) => d.document_type === tab);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((d: any) =>
        (d.document_number || "").toLowerCase().includes(s) ||
        (d.notes || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [docs, tab, search]);

  // Inventory item options
  const invOptions = inventoryItems.map((i: any) => ({
    value: i.id,
    label: `${i.inventory_number || ""} ${i.name}`.trim(),
    searchText: `${i.inventory_number || ""} ${i.name} ${i.stock_quantity}`,
  }));

  const clientOptions = clients.map((c: any) => ({
    value: c.id,
    label: c.company_name || c.display_name || `${c.first_name || ""} ${c.last_name || ""}`.trim(),
    searchText: `${c.company_name || ""} ${c.nip || ""} ${c.first_name || ""} ${c.last_name || ""}`,
  }));

  const orderOptions = orders.map((o: any) => ({
    value: o.id,
    label: o.order_number,
    searchText: o.order_number,
  }));

  function updateItem(idx: number, field: keyof FormItem, value: string) {
    const copy = [...formItems];
    copy[idx] = { ...copy[idx], [field]: value };
    // Auto-fill price from inventory
    if (field === "inventory_item_id") {
      const inv = inventoryItems.find((i: any) => i.id === value);
      if (inv) {
        copy[idx].price_net = String((inv as any).purchase_net || 0);
      }
    }
    setFormItems(copy);
  }

  const showPrice = formType === "PZ" || formType === "WZ";
  const showOrder = formType === "WZ" || formType === "RW";
  const showClient = formType === "PZ" || formType === "WZ";

  const cfg = DOC_TYPE_CONFIG[formType];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Dokumenty magazynowe</h1>
        <Button onClick={() => setShowTypeChooser(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nowy dokument
        </Button>
      </div>

      {/* Type chooser */}
      <Dialog open={showTypeChooser} onOpenChange={setShowTypeChooser}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Wybierz typ dokumentu</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {(Object.keys(DOC_TYPE_CONFIG) as WarehouseDocType[]).map(t => {
              const c = DOC_TYPE_CONFIG[t];
              const Icon = c.icon;
              return (
                <button
                  key={t}
                  onClick={() => openNew(t)}
                  className="flex items-center gap-3 rounded-lg border p-4 text-left hover:bg-accent transition-colors"
                >
                  <div className={`rounded-md p-2 ${c.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{c.label}</div>
                    <div className="text-sm text-muted-foreground">{c.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Search & Tabs */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Szukaj..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ALL">Wszystkie</TabsTrigger>
          <TabsTrigger value="PZ">PZ</TabsTrigger>
          <TabsTrigger value="WZ">WZ</TabsTrigger>
          <TabsTrigger value="PW">PW</TabsTrigger>
          <TabsTrigger value="RW">RW</TabsTrigger>
          <TabsTrigger value="CORRECTION">Korekty</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numer</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Powiązanie</TableHead>
                <TableHead>Pozycje</TableHead>
                <TableHead>Notatki</TableHead>
                <TableHead>Utworzył</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Ładowanie...</TableCell></TableRow>
              ) : !filtered.length ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Brak dokumentów</TableCell></TableRow>
              ) : filtered.map((d: any) => {
                const tc = DOC_TYPE_CONFIG[d.document_type as WarehouseDocType];
                return (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(d)}>
                    <TableCell className="font-medium">{d.document_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={tc?.color}>
                        {DOC_TYPE_SHORT[d.document_type as WarehouseDocType] || d.document_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{d.document_date}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.related_order_id ? orders.find((o: any) => o.id === d.related_order_id)?.order_number || "Zlecenie" : ""}
                      {d.notes?.startsWith("Auto z faktury") ? <Badge variant="outline" className="ml-1 text-[10px]">Auto</Badge> : ""}
                      {d.notes?.startsWith("Auto z zlecenia") ? <Badge variant="outline" className="ml-1 text-[10px]">Auto</Badge> : ""}
                    </TableCell>
                    <TableCell>{(d.warehouse_document_items || []).length}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{d.notes || "—"}</TableCell>
                    <TableCell>{profileName(d.created_by)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); deleteMut.mutate(d.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {cfg && <Badge variant="outline" className={cfg.color}>{DOC_TYPE_SHORT[formType]}</Badge>}
              {editId ? "Edytuj dokument" : "Nowy dokument"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Data dokumentu</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              {showClient && (
                <div>
                  <Label>{formType === "PZ" ? "Dostawca" : "Odbiorca"}</Label>
                  <SearchableSelect
                    options={clientOptions}
                    value={formClientId}
                    onChange={setFormClientId}
                    placeholder="Wybierz kontrahenta..."
                  />
                </div>
              )}
              {showOrder && (
                <div>
                  <Label>Powiązane zlecenie</Label>
                  <SearchableSelect
                    options={orderOptions}
                    value={formOrderId}
                    onChange={setFormOrderId}
                    placeholder="Wybierz zlecenie..."
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Uwagi</Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Notatki do dokumentu..." />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Pozycje</Label>
                <Button variant="outline" size="sm" onClick={() => setFormItems([...formItems, emptyItem()])}>
                  <Plus className="mr-1 h-3 w-3" /> Dodaj pozycję
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[250px]">Pozycja magazynowa</TableHead>
                      <TableHead className="w-24">Ilość</TableHead>
                      {showPrice && <TableHead className="w-28">Cena netto</TableHead>}
                      <TableHead>Notatka</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <SearchableSelect
                            options={invOptions}
                            value={item.inventory_item_id}
                            onChange={v => updateItem(idx, "inventory_item_id", v)}
                            placeholder="Wybierz produkt..."
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={e => updateItem(idx, "quantity", e.target.value)}
                          />
                        </TableCell>
                        {showPrice && (
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price_net}
                              onChange={e => updateItem(idx, "price_net", e.target.value)}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Input value={item.notes} onChange={e => updateItem(idx, "notes", e.target.value)} placeholder="..." />
                        </TableCell>
                        <TableCell>
                          {formItems.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeForm}>Anuluj</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {saveMut.isPending ? "Zapisuję..." : editId ? "Zapisz zmiany" : "Utwórz dokument"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
