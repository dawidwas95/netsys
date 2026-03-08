import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { Bell, Mail, MessageSquare, Save, Info } from "lucide-react";

const EVENT_LABELS: Record<string, string> = {
  READY_FOR_RETURN: "Gotowe do odbioru",
  COMPLETED: "Zakończone",
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "E-mail",
  SMS: "SMS",
};

const TEMPLATE_VARS = [
  { var: "{{order_number}}", desc: "Numer zlecenia" },
  { var: "{{device_name}}", desc: "Nazwa urządzenia (producent + model)" },
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

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ustawienia</h1>
        <p className="text-muted-foreground text-sm">Konfiguracja systemu</p>
      </div>

      <Tabs defaultValue="notifications">
        <TabsList>
          <TabsTrigger value="notifications">
            <Bell className="mr-1 h-4 w-4" /> Powiadomienia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotificationSettings() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<NotificationTemplate>>({});

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_templates")
        .select("*")
        .order("event_type")
        .order("channel");
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
      const { error } = await supabase
        .from("notification_templates")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      setEditingId(null);
      toast.success("Szablon zapisany");
    },
    onError: () => toast.error("Błąd zapisu szablonu"),
  });

  const toggleActive = (template: NotificationTemplate) => {
    updateTemplate.mutate({ id: template.id, is_active: !template.is_active });
  };

  const startEdit = (t: NotificationTemplate) => {
    setEditingId(t.id);
    setEditForm({ subject: t.subject, body_template: t.body_template });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateTemplate.mutate({ id: editingId, ...editForm });
  };

  const emailTemplates = templates.filter((t) => t.channel === "EMAIL");
  const smsTemplates = templates.filter((t) => t.channel === "SMS");

  return (
    <div className="space-y-6">
      {/* Variables reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Dostępne zmienne w szablonach
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {TEMPLATE_VARS.map((v) => (
              <div key={v.var} className="text-xs">
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{v.var}</code>
                <span className="text-muted-foreground ml-1">— {v.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" /> Szablony e-mail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isEditing={editingId === t.id}
              editForm={editForm}
              onToggle={() => toggleActive(t)}
              onStartEdit={() => startEdit(t)}
              onSave={saveEdit}
              onCancel={() => setEditingId(null)}
              onEditChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
            />
          ))}
        </CardContent>
      </Card>

      {/* SMS templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Szablony SMS
            <Badge variant="outline" className="ml-auto text-xs">Wkrótce</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {smsTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isEditing={editingId === t.id}
              editForm={editForm}
              onToggle={() => toggleActive(t)}
              onStartEdit={() => startEdit(t)}
              onSave={saveEdit}
              onCancel={() => setEditingId(null)}
              onEditChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
              disabled
            />
          ))}
        </CardContent>
      </Card>

      {/* Recent notification log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historia powiadomień</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Zlecenie</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Kanał</TableHead>
                <TableHead>Odbiorca</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Brak wysłanych powiadomień
                  </TableCell>
                </TableRow>
              ) : (
                recentLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.created_at).toLocaleString("pl-PL")}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.service_orders?.order_number ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.clients?.display_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {CHANNEL_LABELS[log.channel] ?? log.channel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.recipient ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          log.status === "SENT"
                            ? "bg-primary/10 text-primary border-primary/30"
                            : log.status === "FAILED"
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {log.status === "SENT" ? "Wysłano" : log.status === "FAILED" ? "Błąd" : "Oczekuje"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateCard({
  template,
  isEditing,
  editForm,
  onToggle,
  onStartEdit,
  onSave,
  onCancel,
  onEditChange,
  disabled = false,
}: {
  template: NotificationTemplate;
  isEditing: boolean;
  editForm: Partial<NotificationTemplate>;
  onToggle: () => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onEditChange: (field: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-4 space-y-3 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{EVENT_LABELS[template.event_type] ?? template.event_type}</Badge>
          <span className="text-sm text-muted-foreground">
            {template.channel === "EMAIL" ? "E-mail" : "SMS"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {template.is_active ? "Aktywny" : "Nieaktywny"}
            </span>
            <Switch
              checked={template.is_active}
              onCheckedChange={onToggle}
              disabled={disabled}
            />
          </div>
          {!isEditing && !disabled && (
            <Button variant="outline" size="sm" onClick={onStartEdit}>
              Edytuj
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          {template.channel === "EMAIL" && (
            <div className="space-y-1">
              <Label className="text-xs">Temat</Label>
              <Input
                value={editForm.subject ?? ""}
                onChange={(e) => onEditChange("subject", e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">{template.channel === "EMAIL" ? "Treść" : "Wiadomość SMS"}</Label>
            <Textarea
              value={editForm.body_template ?? ""}
              onChange={(e) => onEditChange("body_template", e.target.value)}
              rows={template.channel === "EMAIL" ? 8 : 3}
              className="font-mono text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave}>
              <Save className="mr-1 h-3.5 w-3.5" /> Zapisz
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel}>
              Anuluj
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {template.channel === "EMAIL" && (
            <p className="text-sm font-medium">{template.subject}</p>
          )}
          <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">
            {template.body_template || template.subject}
          </p>
        </div>
      )}
    </div>
  );
}
