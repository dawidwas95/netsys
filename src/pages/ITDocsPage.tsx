import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Key, Globe, Server, FileText, Search, Eye, EyeOff,
  Copy, Pencil, Trash2, Upload, Download, File, X,
} from "lucide-react";
import { toast } from "sonner";

type ItDocCategory = "PASSWORD" | "NETWORK" | "LICENSE" | "NOTE";

const CATEGORY_LABELS: Record<ItDocCategory, string> = {
  PASSWORD: "Hasła / Logowania",
  NETWORK: "Sieć",
  LICENSE: "Licencje",
  NOTE: "Notatki / Pliki",
};

const CATEGORY_ICONS: Record<ItDocCategory, typeof Key> = {
  PASSWORD: Key, NETWORK: Server, LICENSE: Globe, NOTE: FileText,
};

const CATEGORY_COLORS: Record<ItDocCategory, string> = {
  PASSWORD: "bg-destructive/10 text-destructive",
  NETWORK: "bg-primary/10 text-primary",
  LICENSE: "bg-accent text-accent-foreground",
  NOTE: "bg-muted text-muted-foreground",
};

const NETWORK_DEVICE_TYPES = [
  { value: "ROUTER", label: "Router" },
  { value: "SWITCH", label: "Switch" },
  { value: "AP", label: "Access Point" },
  { value: "SERVER", label: "Serwer" },
  { value: "COMPUTER", label: "Komputer" },
  { value: "PRINTER", label: "Drukarka" },
  { value: "NVR", label: "Rejestrator / NVR" },
  { value: "CAMERA", label: "Kamera" },
  { value: "OTHER", label: "Inne" },
];

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
  file_path: string | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
  clients?: { display_name: string | null; company_name: string | null; first_name: string | null; last_name: string | null } | null;
}

interface NetworkDevice {
  id?: string;
  device_type: string;
  device_name: string;
  ip_address: string;
  subnet_mask: string;
  gateway: string;
  dns_servers: string;
  vlan: string;
  username: string;
  password_encrypted: string;
  notes: string;
}

const emptyForm = {
  client_id: "", category: "PASSWORD" as ItDocCategory, title: "",
  username: "", password_encrypted: "", url: "",
  ip_address: "", subnet_mask: "", gateway: "", dns_servers: "", vlan: "",
  software_name: "", license_key: "", seats: "", license_expires_at: "",
  notes: "",
};

const emptyNetworkDevice: NetworkDevice = {
  device_type: "ROUTER", device_name: "", ip_address: "", subnet_mask: "255.255.255.0",
  gateway: "", dns_servers: "", vlan: "", username: "", password_encrypted: "", notes: "",
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
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterClient, setFilterClient] = useState<string>("ALL");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const { data } = await supabase.from("clients")
        .select("id, display_name, company_name, first_name, last_name")
        .eq("is_active", true).order("display_name");
      return data ?? [];
    },
  });

  // Fetch network devices for a doc
  const { data: allNetDevices = [] } = useQuery({
    queryKey: ["network-devices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("network_devices").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      let filePath: string | null = null;
      let fileName: string | null = null;

      // Upload file if selected
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop();
        const path = `${values.client_id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("it-docs-files").upload(path, selectedFile);
        if (uploadErr) throw uploadErr;
        filePath = path;
        fileName = selectedFile.name;
      }

      const payload: Record<string, unknown> = {
        client_id: values.client_id, category: values.category, title: values.title,
        username: values.username || null, password_encrypted: values.password_encrypted || null,
        url: values.url || null, ip_address: values.ip_address || null,
        subnet_mask: values.subnet_mask || null, gateway: values.gateway || null,
        dns_servers: values.dns_servers || null, vlan: values.vlan || null,
        software_name: values.software_name || null, license_key: values.license_key || null,
        seats: values.seats ? parseInt(values.seats) : null,
        license_expires_at: values.license_expires_at || null,
        notes: values.notes || null,
      };
      if (filePath) { payload.file_path = filePath; payload.file_name = fileName; }

      let docId = editId;
      if (editId) {
        payload.updated_by = user?.id;
        const { error } = await supabase.from("client_it_documents").update(payload as any).eq("id", editId);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { data, error } = await supabase.from("client_it_documents").insert(payload as any).select("id").single();
        if (error) throw error;
        docId = data.id;
      }

      // Save network devices if NETWORK category
      if (values.category === "NETWORK" && docId) {
        // Delete existing then re-insert
        await supabase.from("network_devices").delete().eq("document_id", docId);
        if (networkDevices.length > 0) {
          const devs = networkDevices.map((d, i) => ({
            document_id: docId!,
            device_type: d.device_type,
            device_name: d.device_name,
            ip_address: d.ip_address || null,
            subnet_mask: d.subnet_mask || null,
            gateway: d.gateway || null,
            dns_servers: d.dns_servers || null,
            vlan: d.vlan || null,
            username: d.username || null,
            password_encrypted: d.password_encrypted || null,
            notes: d.notes || null,
            sort_order: i,
          }));
          const { error: devErr } = await supabase.from("network_devices").insert(devs);
          if (devErr) throw devErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-docs"] });
      qc.invalidateQueries({ queryKey: ["network-devices"] });
      toast.success(editId ? "Zaktualizowano" : "Dodano wpis");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Błąd zapisu"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_it_documents").update({ is_archived: true } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["it-docs"] }); toast.success("Zarchiwizowano"); },
  });

  function resetForm() {
    setForm(emptyForm); setEditId(null); setOpen(false);
    setNetworkDevices([]); setSelectedFile(null);
  }

  function openEdit(doc: ITDoc) {
    setEditId(doc.id);
    setForm({
      client_id: doc.client_id, category: doc.category, title: doc.title,
      username: doc.username ?? "", password_encrypted: doc.password_encrypted ?? "",
      url: doc.url ?? "", ip_address: doc.ip_address ?? "", subnet_mask: doc.subnet_mask ?? "",
      gateway: doc.gateway ?? "", dns_servers: doc.dns_servers ?? "", vlan: doc.vlan ?? "",
      software_name: doc.software_name ?? "", license_key: doc.license_key ?? "",
      seats: doc.seats?.toString() ?? "", license_expires_at: doc.license_expires_at ?? "",
      notes: doc.notes ?? "",
    });
    // Load network devices for this doc
    const devs = allNetDevices.filter((d: any) => d.document_id === doc.id);
    setNetworkDevices(devs.map((d: any) => ({
      id: d.id, device_type: d.device_type, device_name: d.device_name,
      ip_address: d.ip_address ?? "", subnet_mask: d.subnet_mask ?? "",
      gateway: d.gateway ?? "", dns_servers: d.dns_servers ?? "",
      vlan: d.vlan ?? "", username: d.username ?? "",
      password_encrypted: d.password_encrypted ?? "", notes: d.notes ?? "",
    })));
    setOpen(true);
  }

  function togglePassword(id: string) {
    setVisiblePasswords((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Skopiowano");
  }

  async function downloadFile(filePath: string, fileName: string) {
    const { data, error } = await supabase.storage.from("it-docs-files").download(filePath);
    if (error) { toast.error("Błąd pobierania pliku"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = docs.filter((d) => {
    if (filterCategory !== "ALL" && d.category !== filterCategory) return false;
    if (filterClient !== "ALL" && d.client_id !== filterClient) return false;
    if (search) {
      const s = search.toLowerCase();
      return d.title.toLowerCase().includes(s) || d.username?.toLowerCase().includes(s) ||
        d.url?.toLowerCase().includes(s) || d.ip_address?.toLowerCase().includes(s) ||
        d.software_name?.toLowerCase().includes(s) || d.notes?.toLowerCase().includes(s) ||
        getClientName(d.clients).toLowerCase().includes(s);
    }
    return true;
  });

  const stats = {
    PASSWORD: docs.filter((d) => d.category === "PASSWORD").length,
    NETWORK: docs.filter((d) => d.category === "NETWORK").length,
    LICENSE: docs.filter((d) => d.category === "LICENSE").length,
    NOTE: docs.filter((d) => d.category === "NOTE").length,
  };

  function addNetworkDevice() {
    setNetworkDevices([...networkDevices, { ...emptyNetworkDevice }]);
  }

  function updateNetworkDevice(index: number, field: keyof NetworkDevice, value: string) {
    const updated = [...networkDevices];
    (updated[index] as any)[field] = value;
    setNetworkDevices(updated);
  }

  function removeNetworkDevice(index: number) {
    setNetworkDevices(networkDevices.filter((_, i) => i !== index));
  }

  function renderFormFields() {
    return (
      <>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Klient *</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Wybierz klienta" /></SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => (
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
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="np. Panel routera, VPN, Active Directory" />
        </div>

        {/* PASSWORD / LOGIN */}
        {form.category === "PASSWORD" && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">Dane logowania</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Login / Użytkownik</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
              <div><Label>Hasło</Label><Input value={form.password_encrypted} onChange={(e) => setForm({ ...form, password_encrypted: e.target.value })} /></div>
            </div>
            <div><Label>URL / Adres</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
          </div>
        )}

        {/* NETWORK - multiple devices */}
        {form.category === "NETWORK" && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Urządzenia sieciowe</p>
              <Button type="button" variant="outline" size="sm" onClick={addNetworkDevice}>
                <Plus className="h-3 w-3 mr-1" /> Dodaj urządzenie
              </Button>
            </div>
            {networkDevices.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Dodaj urządzenia do konfiguracji sieci</p>
            )}
            {networkDevices.map((dev, i) => (
              <div key={i} className="rounded-md border border-border p-3 space-y-2 relative">
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 absolute top-2 right-2 text-destructive" onClick={() => removeNetworkDevice(i)}>
                  <X className="h-3 w-3" />
                </Button>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Typ</Label>
                    <Select value={dev.device_type} onValueChange={(v) => updateNetworkDevice(i, "device_type", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NETWORK_DEVICE_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Nazwa urządzenia *</Label>
                    <Input className="h-8 text-xs" value={dev.device_name} onChange={(e) => updateNetworkDevice(i, "device_name", e.target.value)} placeholder="np. Router Mikrotik RB750" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div><Label className="text-xs">IP</Label><Input className="h-8 text-xs font-mono" value={dev.ip_address} onChange={(e) => updateNetworkDevice(i, "ip_address", e.target.value)} placeholder="192.168.1.1" /></div>
                  <div><Label className="text-xs">Maska</Label><Input className="h-8 text-xs font-mono" value={dev.subnet_mask} onChange={(e) => updateNetworkDevice(i, "subnet_mask", e.target.value)} /></div>
                  <div><Label className="text-xs">Brama</Label><Input className="h-8 text-xs font-mono" value={dev.gateway} onChange={(e) => updateNetworkDevice(i, "gateway", e.target.value)} /></div>
                  <div><Label className="text-xs">VLAN</Label><Input className="h-8 text-xs font-mono" value={dev.vlan} onChange={(e) => updateNetworkDevice(i, "vlan", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">DNS</Label><Input className="h-8 text-xs font-mono" value={dev.dns_servers} onChange={(e) => updateNetworkDevice(i, "dns_servers", e.target.value)} /></div>
                  <div><Label className="text-xs">Login</Label><Input className="h-8 text-xs" value={dev.username} onChange={(e) => updateNetworkDevice(i, "username", e.target.value)} /></div>
                  <div><Label className="text-xs">Hasło</Label><Input className="h-8 text-xs" value={dev.password_encrypted} onChange={(e) => updateNetworkDevice(i, "password_encrypted", e.target.value)} /></div>
                </div>
                <div><Label className="text-xs">Notatki</Label><Input className="h-8 text-xs" value={dev.notes} onChange={(e) => updateNetworkDevice(i, "notes", e.target.value)} /></div>
              </div>
            ))}
          </div>
        )}

        {/* LICENSE */}
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

        {/* File upload */}
        <div className="space-y-2">
          <Label>Plik załącznika</Label>
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> Wybierz plik
            </Button>
            {selectedFile && <span className="text-xs text-muted-foreground">{selectedFile.name}</span>}
          </div>
        </div>

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
          <p className="text-muted-foreground">Hasła, sieci, licencje, notatki i pliki</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Dodaj wpis</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Edytuj wpis" : "Nowy wpis dokumentacji"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {renderFormFields()}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetForm}>Anuluj</Button>
                <Button onClick={() => saveMutation.mutate(form)} disabled={!form.client_id || !form.title || saveMutation.isPending}>
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
                <div className={`rounded-lg p-2 ${CATEGORY_COLORS[cat]}`}><Icon className="h-5 w-5" /></div>
                <div><p className="text-2xl font-bold">{stats[cat]}</p><p className="text-sm text-muted-foreground">{CATEGORY_LABELS[cat]}</p></div>
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
            {clients.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={filterCategory} onValueChange={setFilterCategory}>
        <TabsList>
          <TabsTrigger value="ALL">Wszystkie ({docs.length})</TabsTrigger>
          {(Object.keys(CATEGORY_LABELS) as ItDocCategory[]).map((cat) => (
            <TabsTrigger key={cat} value={cat}>{CATEGORY_LABELS[cat]} ({stats[cat]})</TabsTrigger>
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
                const docNetDevices = allNetDevices.filter((d: any) => d.document_id === doc.id);
                return (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`rounded-lg p-2 mt-0.5 shrink-0 ${CATEGORY_COLORS[doc.category]}`}><Icon className="h-4 w-4" /></div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate">{doc.title}</h3>
                              <Badge variant="outline" className="shrink-0">{CATEGORY_LABELS[doc.category]}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{getClientName(doc.clients)}</p>

                            {/* PASSWORD display */}
                            {doc.category === "PASSWORD" && (
                              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm mt-2">
                                {doc.username && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Login:</span>
                                    <span className="font-mono">{doc.username}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyText(doc.username!)}><Copy className="h-3 w-3" /></Button>
                                  </div>
                                )}
                                {doc.password_encrypted && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Hasło:</span>
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

                            {/* NETWORK display - multiple devices */}
                            {doc.category === "NETWORK" && docNetDevices.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {docNetDevices.map((dev: any) => (
                                  <div key={dev.id} className="rounded border border-border p-2 text-xs">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline" className="text-[10px]">{NETWORK_DEVICE_TYPES.find(t => t.value === dev.device_type)?.label || dev.device_type}</Badge>
                                      <span className="font-medium">{dev.device_name}</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-x-3 gap-y-0.5 text-muted-foreground">
                                      {dev.ip_address && <div>IP: <span className="font-mono text-foreground">{dev.ip_address}</span></div>}
                                      {dev.subnet_mask && <div>Maska: <span className="font-mono text-foreground">{dev.subnet_mask}</span></div>}
                                      {dev.gateway && <div>Brama: <span className="font-mono text-foreground">{dev.gateway}</span></div>}
                                      {dev.vlan && <div>VLAN: <span className="font-mono text-foreground">{dev.vlan}</span></div>}
                                      {dev.username && <div>Login: <span className="text-foreground">{dev.username}</span></div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* NETWORK display - legacy single device */}
                            {doc.category === "NETWORK" && docNetDevices.length === 0 && (
                              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm mt-2">
                                {doc.ip_address && <div><span className="text-muted-foreground">IP:</span> <span className="font-mono">{doc.ip_address}</span></div>}
                                {doc.subnet_mask && <div><span className="text-muted-foreground">Maska:</span> <span className="font-mono">{doc.subnet_mask}</span></div>}
                                {doc.gateway && <div><span className="text-muted-foreground">Brama:</span> <span className="font-mono">{doc.gateway}</span></div>}
                                {doc.dns_servers && <div><span className="text-muted-foreground">DNS:</span> <span className="font-mono">{doc.dns_servers}</span></div>}
                                {doc.vlan && <div><span className="text-muted-foreground">VLAN:</span> <span className="font-mono">{doc.vlan}</span></div>}
                              </div>
                            )}

                            {/* LICENSE display */}
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

                            {/* File attachment */}
                            {doc.file_name && doc.file_path && (
                              <div className="mt-2 flex items-center gap-2">
                                <File className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{doc.file_name}</span>
                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => downloadFile(doc.file_path!, doc.file_name!)}>
                                  <Download className="h-3 w-3 mr-1" /> Pobierz
                                </Button>
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
