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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Key,
  Globe,
  Server,
  FileText,
  Search,
  Eye,
  EyeOff,
  Copy,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type ItDocCategory = "PASSWORD" | "NETWORK" | "LICENSE" | "NOTE";

const CATEGORY_LABELS: Record<ItDocCategory, string> = {
  PASSWORD: "Hasła",
  NETWORK: "Sieć",
  LICENSE: "Licencje",
  NOTE: "Notatki",
};

const CATEGORY_ICONS: Record<ItDocCategory, typeof Key> = {
  PASSWORD: Key,
  NETWORK: Server,
  LICENSE: Globe,
  NOTE: FileText,
};

const CATEGORY_COLORS: Record<ItDocCategory, string> = {
  PASSWORD: "bg-destructive/10 text-destructive",
  NETWORK: "bg-primary/10 text-primary",
  LICENSE: "bg-accent text-accent-foreground",
  NOTE: "bg-muted text-muted-foreground",
};

interface ITDoc {
  id: string;
  client_id: string;
  category: ItDocCategory;
  title: string;
  username: string | null;
  password_encrypted: string | null;
  url: string | null;
  ip_address: string | null;
  subnet_mask: string | null;
  gateway: string | null;
  dns_servers: string | null;
  vlan: string | null;
  software_name: string | null;
  license_key: string | null;
  seats: number | null;
  license_expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  clients?: { display_name: string | null; company_name: string | null; first_name: string | null; last_name: string | null } | null;
}

const emptyForm = {
  client_id: "",
  category: "PASSWORD" as ItDocCategory,
  title: "",
  username: "",
  password_encrypted: "",
  url: "",
  ip_address: "",
  subnet_mask: "",
  gateway: "",
  dns_servers: "",
  vlan: "",
  software_name: "",
  license_key: "",
  seats: "",
  license_expires_at: "",
  notes: "",
};

function getClientName(c: ITDoc["clients"]) {
  if (!c) return "—";
  return c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}

export default function ITDocsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterClient, setFilterClient] = useState<string>("ALL");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["it-docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_it_documents")
        .select("*, clients(display_name, company_name, first_name, last_name)")
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ITDoc[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, display_name, company_name, first_name, last_name")
        .eq("is_active", true)
        .order("display_name");
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload: Record<string, unknown> = {
        client_id: values.client_id,
        category: values.category,
        title: values.title,
        username: values.username || null,
        password_encrypted: values.password_encrypted || null,
        url: values.url || null,
        ip_address: values.ip_address || null,
        subnet_mask: values.subnet_mask || null,
        gateway: values.gateway || null,
        dns_servers: values.dns_servers || null,
        vlan: values.vlan || null,
        software_name: values.software_name || null,
        license_key: values.license_key || null,
        seats: values.seats ? parseInt(values.seats) : null,
        license_expires_at: values.license_expires_at || null,
        notes: values.notes || null,
      };

      if (editId) {
        payload.updated_by = user?.id;
        const { error } = await supabase.from("client_it_documents").update(payload as any).eq("id", editId);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("client_it_documents").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-docs"] });
      toast.success(editId ? "Zaktualizowano dokument" : "Dodano dokument");
      resetForm();
    },
    onError: () => toast.error("Błąd zapisu"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_it_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-docs"] });
      toast.success("Usunięto dokument");
    },
  });

  function resetForm() {
    setForm(emptyForm);
    setEditId(null);
    setOpen(false);
  }

  function openEdit(doc: ITDoc) {
    setEditId(doc.id);
    setForm({
      client_id: doc.client_id,
      category: doc.category,
      title: doc.title,
      username: doc.username ?? "",
      password_encrypted: doc.password_encrypted ?? "",
      url: doc.url ?? "",
      ip_address: doc.ip_address ?? "",
      subnet_mask: doc.subnet_mask ?? "",
      gateway: doc.gateway ?? "",
      dns_servers: doc.dns_servers ?? "",
      vlan: doc.vlan ?? "",
      software_name: doc.software_name ?? "",
      license_key: doc.license_key ?? "",
      seats: doc.seats?.toString() ?? "",
      license_expires_at: doc.license_expires_at ?? "",
      notes: doc.notes ?? "",
    });
    setOpen(true);
  }

  function togglePassword(id: string) {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Skopiowano do schowka");
  }

  const filtered = docs.filter((d) => {
    if (filterCategory !== "ALL" && d.category !== filterCategory) return false;
    if (filterClient !== "ALL" && d.client_id !== filterClient) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        d.title.toLowerCase().includes(s) ||
        d.username?.toLowerCase().includes(s) ||
        d.url?.toLowerCase().includes(s) ||
        d.ip_address?.toLowerCase().includes(s) ||
        d.software_name?.toLowerCase().includes(s) ||
        d.notes?.toLowerCase().includes(s) ||
        getClientName(d.clients).toLowerCase().includes(s)
      );
    }
    return true;
  });

  const stats = {
    PASSWORD: docs.filter((d) => d.category === "PASSWORD").length,
    NETWORK: docs.filter((d) => d.category === "NETWORK").length,
    LICENSE: docs.filter((d) => d.category === "LICENSE").length,
    NOTE: docs.filter((d) => d.category === "NOTE").length,
  };

  function renderFormFields() {
    return (
      <>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Klient *</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Wybierz klienta" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Kategoria *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as ItDocCategory })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as ItDocCategory[]).map((k) => (
                  <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Tytuł *</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="np. Panel administracyjny routera" />
        </div>

        {form.category === "PASSWORD" && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">Dane logowania</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Użytkownik</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
              <div><Label>Hasło</Label><Input value={form.password_encrypted} onChange={(e) => setForm({ ...form, password_encrypted: e.target.value })} /></div>
            </div>
            <div><Label>URL / Adres</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
          </div>
        )}

        {form.category === "NETWORK" && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">Konfiguracja sieciowa</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Adres IP</Label><Input value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} placeholder="192.168.1.1" /></div>
              <div><Label>Maska</Label><Input value={form.subnet_mask} onChange={(e) => setForm({ ...form, subnet_mask: e.target.value })} placeholder="255.255.255.0" /></div>
              <div><Label>Brama</Label><Input value={form.gateway} onChange={(e) => setForm({ ...form, gateway: e.target.value })} /></div>
              <div><Label>DNS</Label><Input value={form.dns_servers} onChange={(e) => setForm({ ...form, dns_servers: e.target.value })} /></div>
            </div>
            <div><Label>VLAN</Label><Input value={form.vlan} onChange={(e) => setForm({ ...form, vlan: e.target.value })} /></div>
          </div>
        )}

        {form.category === "LICENSE" && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">Dane licencji</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Oprogramowanie</Label><Input value={form.software_name} onChange={(e) => setForm({ ...form, software_name: e.target.value })} /></div>
              <div><Label>Klucz licencji</Label><Input value={form.license_key} onChange={(e) => setForm({ ...form, license_key: e.target.value })} /></div>
              <div><Label>Ilość stanowisk</Label><Input type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></div>
              <div><Label>Wygasa</Label><Input type="date" value={form.license_expires_at} onChange={(e) => setForm({ ...form, license_expires_at: e.target.value })} /></div>
            </div>
          </div>
        )}

        <div>
          <Label>Notatki</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dokumentacja IT</h1>
          <p className="text-muted-foreground">Hasła, sieci, licencje i notatki techniczne klientów</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Dodaj wpis</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Edytuj wpis" : "Nowy wpis dokumentacji"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {renderFormFields()}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetForm}>Anuluj</Button>
                <Button
                  onClick={() => saveMutation.mutate(form)}
                  disabled={!form.client_id || !form.title || saveMutation.isPending}
                >
                  {saveMutation.isPending ? "Zapisywanie..." : editId ? "Zapisz zmiany" : "Dodaj"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {(Object.keys(stats) as ItDocCategory[]).map((cat) => {
          const Icon = CATEGORY_ICONS[cat];
          return (
            <Card key={cat} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterCategory(filterCategory === cat ? "ALL" : cat)}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-lg p-2 ${CATEGORY_COLORS[cat]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats[cat]}</p>
                  <p className="text-sm text-muted-foreground">{CATEGORY_LABELS[cat]}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Szukaj..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Klient" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszyscy klienci</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs by category */}
      <Tabs value={filterCategory} onValueChange={setFilterCategory}>
        <TabsList>
          <TabsTrigger value="ALL">Wszystkie ({docs.length})</TabsTrigger>
          {(Object.keys(CATEGORY_LABELS) as ItDocCategory[]).map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {CATEGORY_LABELS[cat]} ({stats[cat]})
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Ładowanie...</div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Brak wpisów dokumentacji</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((doc) => {
                const Icon = CATEGORY_ICONS[doc.category];
                const showPw = visiblePasswords.has(doc.id);
                return (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`rounded-lg p-2 mt-0.5 shrink-0 ${CATEGORY_COLORS[doc.category]}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate">{doc.title}</h3>
                              <Badge variant="outline" className="shrink-0">{CATEGORY_LABELS[doc.category]}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{getClientName(doc.clients)}</p>

                            {doc.category === "PASSWORD" && (
                              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm mt-2">
                                {doc.username && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">User:</span>
                                    <span className="font-mono">{doc.username}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyText(doc.username!)}><Copy className="h-3 w-3" /></Button>
                                  </div>
                                )}
                                {doc.password_encrypted && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Pass:</span>
                                    <span className="font-mono">{showPw ? doc.password_encrypted : "••••••••"}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => togglePassword(doc.id)}>
                                      {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyText(doc.password_encrypted!)}><Copy className="h-3 w-3" /></Button>
                                  </div>
                                )}
                                {doc.url && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">URL:</span>
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{doc.url}</a>
                                  </div>
                                )}
                              </div>
                            )}

                            {doc.category === "NETWORK" && (
                              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm mt-2">
                                {doc.ip_address && <div><span className="text-muted-foreground">IP:</span> <span className="font-mono">{doc.ip_address}</span></div>}
                                {doc.subnet_mask && <div><span className="text-muted-foreground">Maska:</span> <span className="font-mono">{doc.subnet_mask}</span></div>}
                                {doc.gateway && <div><span className="text-muted-foreground">Brama:</span> <span className="font-mono">{doc.gateway}</span></div>}
                                {doc.dns_servers && <div><span className="text-muted-foreground">DNS:</span> <span className="font-mono">{doc.dns_servers}</span></div>}
                                {doc.vlan && <div><span className="text-muted-foreground">VLAN:</span> <span className="font-mono">{doc.vlan}</span></div>}
                              </div>
                            )}

                            {doc.category === "LICENSE" && (
                              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm mt-2">
                                {doc.software_name && <div><span className="text-muted-foreground">Software:</span> {doc.software_name}</div>}
                                {doc.license_key && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Klucz:</span>
                                    <span className="font-mono text-xs">{doc.license_key}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyText(doc.license_key!)}><Copy className="h-3 w-3" /></Button>
                                  </div>
                                )}
                                {doc.seats && <div><span className="text-muted-foreground">Stanowiska:</span> {doc.seats}</div>}
                                {doc.license_expires_at && <div><span className="text-muted-foreground">Wygasa:</span> {doc.license_expires_at}</div>}
                              </div>
                            )}

                            {doc.notes && <p className="text-sm text-muted-foreground mt-2 italic">{doc.notes}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(doc)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(doc.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
