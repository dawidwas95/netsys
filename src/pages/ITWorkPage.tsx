import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, FileText, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";

const BILLING_STATUS_LABELS: Record<string, string> = {
  UNBILLED: "Nierozliczone",
  BILLED: "Rozliczone",
  CANCELLED: "Anulowane",
};

const STATUS_COLORS: Record<string, string> = {
  UNBILLED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  BILLED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function ITWorkPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("UNBILLED");
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  // Dynamic categories from DB
  const { data: categories = [] } = useQuery({
    queryKey: ["service_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const categoryLabels = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c: any) => { map[c.name] = c.label; });
    return map;
  }, [categories]);

  const addCategoryMutation = useMutation({
    mutationFn: async (label: string) => {
      const name = label.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
      const { error } = await supabase.from("service_categories").insert({
        name, label, sort_order: 50,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_categories"] });
      setNewCategoryLabel("");
      setAddCategoryOpen(false);
      toast.success("Dodano kategorię");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Profiles for comment authors
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, first_name, last_name, email");
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p: any) => {
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
      map[p.user_id] = name || p.email || "Użytkownik";
    });
    return map;
  }, [profiles]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["it_work_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_work_entries")
        .select("*, clients(display_name, company_name, first_name, last_name)")
        .is("deleted_at", null)
        .order("work_date", { ascending: false });
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
    return entries.filter((e: any) => {
      if (filterClient !== "all" && e.client_id !== filterClient) return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      return true;
    });
  }, [entries, filterClient, filterStatus]);

  const selectedTotal = useMemo(() => {
    return filtered
      .filter((e: any) => selectedIds.includes(e.id))
      .reduce((sum: number, e: any) => sum + Number(e.amount_net || 0), 0);
  }, [filtered, selectedIds]);

  const addEntry = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("it_work_entries").insert({
        ...data,
        entry_number: "TEMP",
        assigned_user_id: user?.id,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["it_work_entries"] });
      setAddOpen(false);
      toast.success("Dodano wpis pracy IT");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createBatch = useMutation({
    mutationFn: async (data: { clientId: string; invoiceNumber: string; invoiceDate: string; notes: string }) => {
      const selectedEntries = filtered.filter((e: any) => selectedIds.includes(e.id) && e.status === "UNBILLED");
      if (selectedEntries.length === 0) throw new Error("Brak pozycji");

      const totalNet = selectedEntries.reduce((s: number, e: any) => s + Number(e.amount_net || 0), 0);
      const totalGross = totalNet * 1.23;
      const dates = selectedEntries.map((e: any) => e.work_date).sort();
      const batchNumber = `BILL/${new Date().getFullYear()}/${String(Date.now()).slice(-4)}`;

      const { data: batch, error: batchErr } = await supabase
        .from("billing_batches")
        .insert({
          batch_number: batchNumber, client_id: data.clientId,
          period_from: dates[0], period_to: dates[dates.length - 1],
          total_net: totalNet, total_gross: totalGross,
          invoice_number: data.invoiceNumber || null,
          notes: data.notes || null, created_by: user?.id,
        })
        .select().single();
      if (batchErr) throw batchErr;

      const items = selectedEntries.map((e: any) => ({ batch_id: batch.id, it_work_entry_id: e.id }));
      const { error: itemsErr } = await supabase.from("billing_batch_items").insert(items);
      if (itemsErr) throw itemsErr;

      for (const entry of selectedEntries) {
        await supabase.from("it_work_entries")
          .update({ status: "BILLED" as any, billing_batch_id: batch.id, updated_by: user?.id })
          .eq("id", entry.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["it_work_entries"] });
      setSelectedIds([]);
      setBillingOpen(false);
      toast.success("Utworzono rozliczenie zbiorcze");
    },
    onError: (e) => toast.error("Błąd: " + e.message),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectAllUnbilled = () => {
    const unbilledIds = filtered.filter((e: any) => e.status === "UNBILLED").map((e: any) => e.id);
    setSelectedIds(unbilledIds);
  };

  const clientName = (e: any) => {
    const c = e.clients;
    if (!c) return "—";
    return c.display_name || c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prace IT</h1>
          <p className="text-sm text-muted-foreground">Rejestr prac informatycznych i rozliczenia</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button variant="secondary" onClick={() => setBillingOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Rozlicz ({selectedIds.length}) — {selectedTotal.toFixed(2)} zł
            </Button>
          )}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Dodaj pracę</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nowy wpis pracy IT</DialogTitle></DialogHeader>
              <AddEntryForm
                clients={clients}
                categories={categories}
                onSubmit={(d) => addEntry.mutate(d)}
                loading={addEntry.isPending}
                onAddCategory={() => setAddCategoryOpen(true)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Add Category Dialog */}
      <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Dodaj kategorię</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nazwa kategorii</Label><Input value={newCategoryLabel} onChange={(e) => setNewCategoryLabel(e.target.value)} placeholder="np. Serwer, Backup..." /></div>
            <Button className="w-full" disabled={!newCategoryLabel.trim() || addCategoryMutation.isPending} onClick={() => addCategoryMutation.mutate(newCategoryLabel.trim())}>
              {addCategoryMutation.isPending ? "Dodawanie..." : "Dodaj"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Klient</Label>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy klienci</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.display_name || c.company_name || `${c.first_name} ${c.last_name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="UNBILLED">Nierozliczone</SelectItem>
                  <SelectItem value="BILLED">Rozliczone</SelectItem>
                  <SelectItem value="CANCELLED">Anulowane</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filterStatus === "UNBILLED" && (
              <Button variant="outline" size="sm" onClick={selectAllUnbilled}>
                Zaznacz wszystkie nierozliczone
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Numer</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Kategoria</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="text-right w-20">Czas</TableHead>
                <TableHead className="text-right w-28">Kwota</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Ładowanie...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Brak wpisów</TableCell></TableRow>
              ) : (
                filtered.map((e: any) => (
                  <TableRow key={e.id} className={selectedIds.includes(e.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      {e.status === "UNBILLED" && (
                        <Checkbox checked={selectedIds.includes(e.id)} onCheckedChange={() => toggleSelect(e.id)} />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.entry_number}</TableCell>
                    <TableCell className="text-sm">{format(new Date(e.work_date), "dd.MM.yyyy")}</TableCell>
                    <TableCell className="font-medium text-sm">{clientName(e)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[e.service_category] || e.service_category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{e.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(e.work_hours).toFixed(1)}h</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{Number(e.amount_net).toFixed(2)} zł</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[e.status] || ""}>
                        {BILLING_STATUS_LABELS[e.status] || e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCommentOpen(e.id)}>
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Billing Dialog */}
      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Utwórz rozliczenie zbiorcze</DialogTitle></DialogHeader>
          <BillingForm
            selectedCount={selectedIds.length}
            totalNet={selectedTotal}
            clientId={filterClient !== "all" ? filterClient : filtered.find((e: any) => selectedIds.includes(e.id))?.client_id}
            onSubmit={(d) => createBatch.mutate(d)}
            loading={createBatch.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog open={!!commentOpen} onOpenChange={(v) => !v && setCommentOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Komentarze wpisu</DialogTitle></DialogHeader>
          {commentOpen && <ITWorkComments entryId={commentOpen} userId={user?.id} profileMap={profileMap} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ITWorkComments({ entryId, userId, profileMap }: { entryId: string; userId?: string; profileMap: Record<string, string> }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments = [] } = useQuery({
    queryKey: ["it-work-comments", entryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_work_comments")
        .select("*")
        .eq("entry_id", entryId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("it_work_comments").insert({
        entry_id: entryId, user_id: userId, comment: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["it-work-comments", entryId] }); setText(""); },
  });

  return (
    <div className="space-y-3">
      {comments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Brak komentarzy</p>}
      {comments.map((c: any) => (
        <div key={c.id} className="border-b border-border pb-2 last:border-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
              {(profileMap[c.user_id] || "?")[0].toUpperCase()}
            </div>
            <span className="text-sm font-medium">{profileMap[c.user_id] || "Użytkownik"}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleDateString("pl-PL")} {new Date(c.created_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="text-sm ml-8">{c.comment}</p>
        </div>
      ))}
      <div className="flex gap-2">
        <Textarea placeholder="Dodaj komentarz..." value={text} onChange={(e) => setText(e.target.value)} rows={2} className="flex-1" />
        <Button size="icon" onClick={() => addComment.mutate()} disabled={!text.trim() || addComment.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AddEntryForm({ clients, categories, onSubmit, loading, onAddCategory }: {
  clients: any[]; categories: any[]; onSubmit: (d: any) => void; loading: boolean; onAddCategory: () => void;
}) {
  const [form, setForm] = useState({
    client_id: "",
    work_date: new Date().toISOString().split("T")[0],
    service_category: "OTHER",
    description: "",
    work_hours: "1",
    amount_net: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.description) {
      toast.error("Wypełnij wymagane pola");
      return;
    }
    const amountNet = parseFloat(form.amount_net) || 0;
    onSubmit({
      client_id: form.client_id,
      work_date: form.work_date,
      service_category: form.service_category,
      description: form.description,
      work_hours: parseFloat(form.work_hours) || 0,
      billable_hours: parseFloat(form.work_hours) || 0,
      hourly_rate: 0,
      amount_net: amountNet,
      amount_gross: amountNet * 1.23,
      notes: form.notes || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          <Label>Data pracy</Label>
          <Input type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label>Kategoria</Label>
          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={onAddCategory}>
            <Plus className="h-3 w-3 mr-1" /> Nowa
          </Button>
        </div>
        <Select value={form.service_category} onValueChange={(v) => setForm({ ...form, service_category: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((c: any) => (
              <SelectItem key={c.name} value={c.name}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Opis pracy *</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Czas pracy (godziny)</Label>
          <Input type="number" step="0.5" value={form.work_hours} onChange={(e) => setForm({ ...form, work_hours: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Kwota usługi (netto zł)</Label>
          <Input type="number" step="1" value={form.amount_net} onChange={(e) => setForm({ ...form, amount_net: e.target.value })} placeholder="0.00" />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Notatki</Label>
        <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Zapisywanie..." : "Dodaj wpis"}
      </Button>
    </form>
  );
}

function BillingForm({ selectedCount, totalNet, clientId, onSubmit, loading }: {
  selectedCount: number; totalNet: number; clientId?: string;
  onSubmit: (d: { clientId: string; invoiceNumber: string; invoiceDate: string; notes: string }) => void; loading: boolean;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded p-4 space-y-1 text-sm">
        <div>Zaznaczonych pozycji: <strong>{selectedCount}</strong></div>
        <div>Suma netto: <strong>{totalNet.toFixed(2)} zł</strong></div>
        <div>Suma brutto (23% VAT): <strong>{(totalNet * 1.23).toFixed(2)} zł</strong></div>
      </div>
      <div className="space-y-1">
        <Label>Numer faktury</Label>
        <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="np. FV/2026/001" />
      </div>
      <div className="space-y-1">
        <Label>Data faktury</Label>
        <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Notatki</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button className="w-full" disabled={loading || !clientId}
        onClick={() => onSubmit({ clientId: clientId!, invoiceNumber, invoiceDate, notes })}>
        {loading ? "Tworzenie..." : "Utwórz rozliczenie"}
      </Button>
      {!clientId && (
        <p className="text-xs text-destructive">Wybierz klienta w filtrach lub zaznacz pozycje jednego klienta.</p>
      )}
    </div>
  );
}
