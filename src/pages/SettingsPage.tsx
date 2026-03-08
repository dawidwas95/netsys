import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Bell, Mail, MessageSquare, Save, Info, FileText, Building2,
  ChevronUp, ChevronDown, Eye, GripVertical, Users, MoreHorizontal,
  Pencil, UserX, Trash2, Shield, Plus,
} from "lucide-react";
import type { PdfSection, PdfSettings, PdfTemplateConfig } from "@/lib/pdfEngine";
import { DEFAULT_SETTINGS, SERVICE_ORDER_SECTIONS } from "@/lib/pdfEngine";

// ══════════════════════════════════════════════
// Main Settings Page
// ══════════════════════════════════════════════

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ustawienia</h1>
        <p className="text-muted-foreground text-sm">Konfiguracja systemu</p>
      </div>
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company"><Building2 className="mr-1 h-4 w-4" /> Firma</TabsTrigger>
          <TabsTrigger value="team"><Users className="mr-1 h-4 w-4" /> Zespół</TabsTrigger>
          <TabsTrigger value="pdf"><FileText className="mr-1 h-4 w-4" /> Szablony PDF</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1 h-4 w-4" /> Powiadomienia</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><CompanySettings /></TabsContent>
        <TabsContent value="team"><TeamManagement /></TabsContent>
        <TabsContent value="pdf"><PdfTemplateSettings /></TabsContent>
        <TabsContent value="notifications"><NotificationSettings /></TabsContent>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════
// Team Management
// ══════════════════════════════════════════════

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  MANAGER: "Manager",
  TECHNICIAN: "Technik",
  OFFICE: "Biuro",
  EMPLOYEE: "Pracownik",
};

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Administrator" },
  { value: "TECHNICIAN", label: "Technik" },
  { value: "OFFICE", label: "Biuro" },
  { value: "MANAGER", label: "Manager" },
  { value: "EMPLOYEE", label: "Pracownik" },
];

function TeamManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserName, setDeleteUserName] = useState("");
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "TECHNICIAN",
    is_active: true,
  });
  const [creating, setCreating] = useState(false);

  const { data: currentUserRole } = useQuery({
    queryKey: ["current-user-role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.role ?? null;
    },
    enabled: !!user,
  });

  const isAdmin = currentUserRole === "ADMIN";

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["team-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const { data: roles } = await supabase.from("user_roles").select("*");
      
      return (profiles ?? []).map((p: any) => ({
        ...p,
        role: (roles ?? []).find((r: any) => r.user_id === p.user_id)?.role ?? "EMPLOYEE",
      }));
    },
  });

  const manageUser = useMutation({
    mutationFn: async ({ action, target_user_id, updates }: { action: string; target_user_id: string; updates?: any }) => {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action, target_user_id, updates },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
    },
  });

  const handleDelete = async () => {
    if (!deleteUserId) return;
    try {
      await manageUser.mutateAsync({ action: "delete", target_user_id: deleteUserId });
      toast.success("Użytkownik został usunięty");
      setDeleteUserId(null);
    } catch (e: any) {
      toast.error(e.message || "Błąd usuwania użytkownika");
    }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      await manageUser.mutateAsync({ action: "toggle_active", target_user_id: userId });
      toast.success("Status użytkownika zmieniony");
    } catch (e: any) {
      toast.error(e.message || "Błąd zmiany statusu");
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await manageUser.mutateAsync({ action: "update_role", target_user_id: userId, updates: { role } });
      toast.success("Rola zmieniona");
    } catch (e: any) {
      toast.error(e.message || "Błąd zmiany roli");
    }
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    try {
      await manageUser.mutateAsync({
        action: "update_profile",
        target_user_id: editUser.user_id,
        updates: editForm,
      });
      toast.success("Dane użytkownika zaktualizowane");
      setEditUser(null);
    } catch (e: any) {
      toast.error(e.message || "Błąd zapisu");
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) {
      toast.error("Podaj e-mail i hasło");
      return;
    }
    if (createForm.password.length < 6) {
      toast.error("Hasło musi mieć minimum 6 znaków");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "create_user", new_user: createForm },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Użytkownik został utworzony");
      setShowCreateDialog(false);
      setCreateForm({ first_name: "", last_name: "", email: "", password: "", role: "TECHNICIAN", is_active: true });
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
    } catch (e: any) {
      toast.error(e.message || "Błąd tworzenia użytkownika");
    } finally {
      setCreating(false);
    }
  };

  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  const startEdit = (u: any) => {
    setEditUser(u);
    setEditForm({
      first_name: u.first_name ?? "",
      last_name: u.last_name ?? "",
      phone: u.phone ?? "",
      email: u.email ?? "",
      role: u.role ?? "EMPLOYEE",
      is_active: u.is_active ? "true" : "false",
    });
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error("Hasło musi mieć minimum 6 znaków");
      return;
    }
    setResettingPassword(true);
    try {
      await manageUser.mutateAsync({
        action: "reset_password",
        target_user_id: resetPasswordUserId,
        updates: { password: newPassword },
      });
      toast.success("Hasło zostało zresetowane");
      setResetPasswordUserId(null);
      setNewPassword("");
    } catch (e: any) {
      toast.error(e.message || "Błąd resetowania hasła");
    } finally {
      setResettingPassword(false);
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Ładowanie...</p>;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Zarządzanie zespołem
            </CardTitle>
            {isAdmin && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-1 h-4 w-4" /> Utwórz użytkownika
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Użytkownik</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Utworzono</TableHead>
                {isAdmin && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u: any) => (
                <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                  <TableCell>
                    {isAdmin && u.user_id !== user?.id ? (
                      <Select value={u.role} onValueChange={(v) => handleRoleChange(u.user_id, v)}>
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "default" : "outline"} className={u.is_active ? "bg-primary/10 text-primary border-primary/30" : ""}>
                      {u.is_active ? "Aktywny" : "Nieaktywny"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("pl-PL")}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {u.user_id !== user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => startEdit(u)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edytuj
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(u.user_id)}>
                              <UserX className="mr-2 h-4 w-4" />
                              {u.is_active ? "Dezaktywuj" : "Aktywuj"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setDeleteUserId(u.user_id);
                                setDeleteUserName(
                                  [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "użytkownik"
                                );
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Usuń
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role legend */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" /> Uprawnienia ról
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium mb-1">Administrator</p>
              <p className="text-muted-foreground text-xs">Pełny dostęp do systemu, zarządzanie użytkownikami, ustawienia, finanse</p>
            </div>
            <div>
              <p className="font-medium mb-1">Technik</p>
              <p className="text-muted-foreground text-xs">Zlecenia serwisowe, diagnostyka, komentarze, magazyn. Bez dostępu do finansów i ustawień</p>
            </div>
            <div>
              <p className="font-medium mb-1">Biuro</p>
              <p className="text-muted-foreground text-xs">Klienci, zlecenia, faktury, oferty, komunikacja z klientami</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć tego użytkownika?</AlertDialogTitle>
            <AlertDialogDescription>
              Użytkownik <strong>{deleteUserName}</strong> zostanie trwale usunięty z systemu.
              Istniejące rekordy (zlecenia, komentarze) zostaną zachowane.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń użytkownika
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj użytkownika</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Imię</Label>
              <Input
                value={editForm.first_name ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Nazwisko</Label>
              <Input
                value={editForm.last_name ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Telefon</Label>
              <Input
                value={editForm.phone ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Anuluj</Button>
            <Button onClick={handleEditSave} disabled={manageUser.isPending}>
              <Save className="mr-1 h-4 w-4" /> Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Utwórz nowego użytkownika</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Imię</Label>
                <Input
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, first_name: e.target.value }))}
                  placeholder="Jan"
                />
              </div>
              <div className="space-y-1">
                <Label>Nazwisko</Label>
                <Input
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, last_name: e.target.value }))}
                  placeholder="Kowalski"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="jan@firma.pl"
              />
            </div>
            <div className="space-y-1">
              <Label>Hasło tymczasowe *</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Minimum 6 znaków"
              />
            </div>
            <div className="space-y-1">
              <Label>Rola</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm((p) => ({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={createForm.is_active}
                onCheckedChange={(v) => setCreateForm((p) => ({ ...p, is_active: v }))}
              />
              <Label>Aktywny</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Anuluj</Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? "Tworzenie..." : "Utwórz użytkownika"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════
// Company Settings
// ══════════════════════════════════════════════

function CompanySettings() {
  const queryClient = useQueryClient();
  const { data: company, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").limit(1);
      return data?.[0] ?? null;
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const isDirty = Object.keys(form).length > 0;

  const merged = { ...company, ...form };

  const update = useMutation({
    mutationFn: async () => {
      if (!company?.id) return;
      const { error } = await supabase.from("company_settings").update(form).eq("id", company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      setForm({});
      toast.success("Dane firmy zapisane");
    },
    onError: () => toast.error("Błąd zapisu"),
  });

  if (isLoading) return <p className="text-muted-foreground">Ładowanie...</p>;

  const field = (key: string, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={merged[key] ?? ""}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Dane firmy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {field("company_name", "Nazwa firmy")}
          {field("nip", "NIP")}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field("address_street", "Ulica i numer")}
          {field("address_city", "Miasto")}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {field("address_postal_code", "Kod pocztowy")}
          {field("phone", "Telefon")}
          {field("email", "E-mail")}
        </div>
        {field("website", "Strona WWW")}
        {isDirty && (
          <Button onClick={() => update.mutate()} disabled={update.isPending}>
            <Save className="mr-1 h-4 w-4" /> Zapisz dane firmy
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════
// PDF Template Settings
// ══════════════════════════════════════════════

const DOC_TYPE_LABELS: Record<string, string> = {
  SERVICE_ORDER: "Zlecenie serwisowe",
  OFFER: "Oferta handlowa",
  IT_WORK_SUMMARY: "Podsumowanie prac IT",
  PICKUP: "Potwierdzenie odbioru",
};

const PDF_VARS = [
  { var: "{{order_number}}", desc: "Numer zlecenia" },
  { var: "{{client_name}}", desc: "Nazwa klienta" },
  { var: "{{client_phone}}", desc: "Telefon klienta" },
  { var: "{{client_email}}", desc: "E-mail klienta" },
  { var: "{{device_name}}", desc: "Producent + model" },
  { var: "{{device_serial}}", desc: "Nr seryjny" },
  { var: "{{imei}}", desc: "IMEI" },
  { var: "{{received_at}}", desc: "Data przyjęcia" },
  { var: "{{completed_at}}", desc: "Data zakończenia" },
  { var: "{{problem_description}}", desc: "Opis usterki" },
  { var: "{{diagnosis}}", desc: "Diagnoza" },
  { var: "{{repair_description}}", desc: "Opis naprawy" },
  { var: "{{revenue_gross}}", desc: "Przychód brutto" },
  { var: "{{pickup_code}}", desc: "Kod odbioru (losowy, nie hasło urządzenia)" },
  { var: "{{company_name}}", desc: "Nazwa firmy" },
  { var: "{{company_nip}}", desc: "NIP firmy" },
];

function PdfTemplateSettings() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["pdf-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pdf_templates").select("*").order("document_type");
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("pdf_templates").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdf-templates"] });
      toast.success("Status szablonu zmieniony");
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, config, name }: { id: string; config: PdfTemplateConfig; name?: string }) => {
      const updates: any = { config, updated_at: new Date().toISOString() };
      if (name) updates.name = name;
      const { error } = await supabase.from("pdf_templates").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdf-templates"] });
      setEditingId(null);
      toast.success("Szablon PDF zapisany");
    },
    onError: () => toast.error("Błąd zapisu szablonu"),
  });

  if (isLoading) return <p className="text-muted-foreground">Ładowanie...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" /> Dostępne zmienne w szablonach PDF
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PDF_VARS.map((v) => (
              <span key={v.var} className="text-xs">
                <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">{v.var}</code>
                <span className="text-muted-foreground ml-0.5">— {v.desc}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {templates.map((t: any) => (
        <Card key={t.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[t.document_type] ?? t.document_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t.is_active ? "Aktywny" : "Nieaktywny"}</span>
                  <Switch
                    checked={t.is_active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: t.id, is_active: v })}
                  />
                </div>
                {editingId !== t.id && (
                  <Button variant="outline" size="sm" onClick={() => setEditingId(t.id)}>
                    Edytuj
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          {editingId === t.id && (
            <CardContent>
              <PdfTemplateEditor
                template={t}
                onSave={(config, name) => updateTemplate.mutate({ id: t.id, config, name })}
                onCancel={() => setEditingId(null)}
                saving={updateTemplate.isPending}
              />
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// PDF Template Editor
// ══════════════════════════════════════════════

function PdfTemplateEditor({
  template,
  onSave,
  onCancel,
  saving,
}: {
  template: any;
  onSave: (config: PdfTemplateConfig, name?: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const config = (template.config ?? { settings: DEFAULT_SETTINGS, sections: SERVICE_ORDER_SECTIONS }) as PdfTemplateConfig;
  const [name, setName] = useState(template.name);
  const [settings, setSettings] = useState<PdfSettings>({ ...DEFAULT_SETTINGS, ...config.settings });
  const [sections, setSections] = useState<PdfSection[]>([...(config.sections ?? SERVICE_ORDER_SECTIONS)]);

  const toggleSection = (id: string) => {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const arr = [...sections];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setSections(arr);
  };

  const updateSetting = <K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave({ settings, sections }, name !== template.name ? name : undefined);
  };

  return (
    <div className="space-y-6">
      {/* Template name */}
      <div className="space-y-1">
        <Label>Nazwa szablonu</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {/* Layout settings */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Pozycja logo</Label>
          <Select value={settings.logoAlignment} onValueChange={(v) => updateSetting("logoAlignment", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Lewo</SelectItem>
              <SelectItem value="center">Środek</SelectItem>
              <SelectItem value="right">Prawo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Układ klient/urządzenie</Label>
          <Select value={settings.clientDeviceLayout} onValueChange={(v) => updateSetting("clientDeviceLayout", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="side-by-side">Obok siebie</SelectItem>
              <SelectItem value="stacked">Pod sobą</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Skala czcionki</Label>
          <Select value={settings.fontScale.toString()} onValueChange={(v) => updateSetting("fontScale", parseFloat(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0.85">Mniejsza (85%)</SelectItem>
              <SelectItem value="1">Normalna (100%)</SelectItem>
              <SelectItem value="1.15">Większa (115%)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: "showCompanyData" as const, label: "Dane firmy" },
          { key: "showTableBorders" as const, label: "Obramowania tabel" },
          { key: "showSectionSeparators" as const, label: "Separatory sekcji" },
          { key: "compactSpacing" as const, label: "Kompaktowe odstępy" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              checked={settings[key]}
              onCheckedChange={(v) => updateSetting(key, !!v)}
              id={key}
            />
            <Label htmlFor={key} className="text-xs cursor-pointer">{label}</Label>
          </div>
        ))}
      </div>

      {/* Footer text */}
      <div className="space-y-1">
        <Label className="text-xs">Tekst stopki</Label>
        <Input
          value={settings.footerText}
          onChange={(e) => updateSetting("footerText", e.target.value)}
          placeholder="Dziękujemy za skorzystanie z usług..."
        />
      </div>

      {/* Margins */}
      <div className="grid grid-cols-4 gap-3">
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <div key={side} className="space-y-1">
            <Label className="text-xs">Margines {side === "top" ? "górny" : side === "bottom" ? "dolny" : side === "left" ? "lewy" : "prawy"} (mm)</Label>
            <Input
              type="number"
              min={5}
              max={40}
              value={settings.margins[side]}
              onChange={(e) => updateSetting("margins", { ...settings.margins, [side]: parseInt(e.target.value) || 15 })}
            />
          </div>
        ))}
      </div>

      {/* Sections reorder */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Sekcje dokumentu (kolejność i widoczność)</Label>
        <div className="border rounded-md divide-y">
          {sections.map((sec, idx) => (
            <div key={sec.id} className="flex items-center gap-2 px-3 py-2">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <Checkbox
                checked={sec.enabled}
                onCheckedChange={() => toggleSection(sec.id)}
              />
              <span className={`text-sm flex-1 ${sec.enabled ? "" : "text-muted-foreground line-through"}`}>
                {sec.label}
              </span>
              <div className="flex gap-0.5">
                <Button
                  variant="ghost" size="icon" className="h-6 w-6"
                  onClick={() => moveSection(idx, -1)} disabled={idx === 0}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-6 w-6"
                  onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? "Zapisywanie..." : "Zapisz szablon"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Anuluj</Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Notification Settings (moved from previous code)
// ══════════════════════════════════════════════

const EVENT_LABELS: Record<string, string> = {
  READY_FOR_RETURN: "Gotowe do odbioru",
  COMPLETED: "Zakończone",
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "E-mail",
  SMS: "SMS",
};

const NOTIF_TEMPLATE_VARS = [
  { var: "{{order_number}}", desc: "Numer zlecenia" },
  { var: "{{device_name}}", desc: "Nazwa urządzenia" },
  { var: "{{client_name}}", desc: "Nazwa klienta" },
];

interface NotificationTemplate {
  id: string;
  event_type: string;
  channel: string;
  subject: string;
  body_template: string;
  is_active: boolean;
}

function NotificationSettings() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<NotificationTemplate>>({});

  const { data: templates = [] } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_templates").select("*").order("event_type").order("channel");
      if (error) throw error;
      return data as NotificationTemplate[];
    },
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ["notification-log-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_log")
        .select("*, service_orders(order_number), clients(display_name)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<NotificationTemplate>) => {
      const { error } = await supabase.from("notification_templates").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      setEditingId(null);
      toast.success("Szablon zapisany");
    },
    onError: () => toast.error("Błąd zapisu szablonu"),
  });

  const toggleActive = (t: NotificationTemplate) => updateTemplate.mutate({ id: t.id, is_active: !t.is_active });
  const startEdit = (t: NotificationTemplate) => { setEditingId(t.id); setEditForm({ subject: t.subject, body_template: t.body_template }); };
  const saveEdit = () => { if (editingId) updateTemplate.mutate({ id: editingId, ...editForm }); };

  const emailTemplates = templates.filter((t) => t.channel === "EMAIL");
  const smsTemplates = templates.filter((t) => t.channel === "SMS");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" /> Dostępne zmienne
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {NOTIF_TEMPLATE_VARS.map((v) => (
              <div key={v.var} className="text-xs">
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{v.var}</code>
                <span className="text-muted-foreground ml-1">— {v.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Mail className="h-5 w-5" /> Szablony e-mail</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {emailTemplates.map((t) => (
            <NotifTemplateCard key={t.id} template={t} isEditing={editingId === t.id} editForm={editForm}
              onToggle={() => toggleActive(t)} onStartEdit={() => startEdit(t)} onSave={saveEdit}
              onCancel={() => setEditingId(null)} onEditChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Szablony SMS
            <Badge variant="outline" className="ml-auto text-xs">Wkrótce</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {smsTemplates.map((t) => (
            <NotifTemplateCard key={t.id} template={t} isEditing={editingId === t.id} editForm={editForm}
              onToggle={() => toggleActive(t)} onStartEdit={() => startEdit(t)} onSave={saveEdit}
              onCancel={() => setEditingId(null)} onEditChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} disabled />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Historia powiadomień</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead><TableHead>Zlecenie</TableHead><TableHead>Klient</TableHead>
                <TableHead>Kanał</TableHead><TableHead>Odbiorca</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Brak wysłanych powiadomień</TableCell></TableRow>
              ) : recentLogs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">{new Date(log.created_at).toLocaleString("pl-PL")}</TableCell>
                  <TableCell className="font-mono text-sm">{log.service_orders?.order_number ?? "—"}</TableCell>
                  <TableCell className="text-sm">{log.clients?.display_name ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{CHANNEL_LABELS[log.channel] ?? log.channel}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.recipient ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={log.status === "SENT" ? "bg-primary/10 text-primary border-primary/30" : log.status === "FAILED" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-muted text-muted-foreground"}>
                      {log.status === "SENT" ? "Wysłano" : log.status === "FAILED" ? "Błąd" : "Oczekuje"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NotifTemplateCard({ template, isEditing, editForm, onToggle, onStartEdit, onSave, onCancel, onEditChange, disabled = false }: {
  template: NotificationTemplate; isEditing: boolean; editForm: Partial<NotificationTemplate>;
  onToggle: () => void; onStartEdit: () => void; onSave: () => void; onCancel: () => void;
  onEditChange: (f: string, v: string) => void; disabled?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-4 space-y-3 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{EVENT_LABELS[template.event_type] ?? template.event_type}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{template.is_active ? "Aktywny" : "Nieaktywny"}</span>
            <Switch checked={template.is_active} onCheckedChange={onToggle} disabled={disabled} />
          </div>
          {!isEditing && !disabled && <Button variant="outline" size="sm" onClick={onStartEdit}>Edytuj</Button>}
        </div>
      </div>
      {isEditing ? (
        <div className="space-y-3">
          {template.channel === "EMAIL" && (
            <div className="space-y-1"><Label className="text-xs">Temat</Label>
              <Input value={editForm.subject ?? ""} onChange={(e) => onEditChange("subject", e.target.value)} /></div>
          )}
          <div className="space-y-1"><Label className="text-xs">{template.channel === "EMAIL" ? "Treść" : "Wiadomość SMS"}</Label>
            <Textarea value={editForm.body_template ?? ""} onChange={(e) => onEditChange("body_template", e.target.value)}
              rows={template.channel === "EMAIL" ? 8 : 3} className="font-mono text-sm" /></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave}><Save className="mr-1 h-3.5 w-3.5" /> Zapisz</Button>
            <Button size="sm" variant="outline" onClick={onCancel}>Anuluj</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {template.channel === "EMAIL" && <p className="text-sm font-medium">{template.subject}</p>}
          <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">{template.body_template || template.subject}</p>
        </div>
      )}
    </div>
  );
}
