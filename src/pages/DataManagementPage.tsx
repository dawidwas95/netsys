import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download, Database, RotateCcw, Trash2, Archive, FileCode } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ENTITY_TABLES = [
  { key: "clients", label: "Klienci", table: "clients" },
  { key: "service_orders", label: "Zlecenia serwisowe", table: "service_orders" },
  { key: "documents", label: "Dokumenty", table: "documents" },
  { key: "inventory_items", label: "Magazyn", table: "inventory_items" },
  { key: "cash_transactions", label: "Kasa gotówkowa", table: "cash_transactions" },
  { key: "it_work_entries", label: "Prace IT", table: "it_work_entries" },
  { key: "devices", label: "Urządzenia", table: "devices" },
] as const;

const SOFT_DELETE_TABLES = [
  { table: "clients", label: "Klienci", nameField: "display_name" },
  { table: "service_orders", label: "Zlecenia", nameField: "order_number" },
  { table: "documents", label: "Dokumenty", nameField: "document_number" },
  { table: "inventory_items", label: "Magazyn", nameField: "name" },
  { table: "it_work_entries", label: "Prace IT", nameField: "entry_number" },
  { table: "devices", label: "Urządzenia", nameField: "model" },
] as const;

function escapeSQL(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) return `'{${val.map((v: any) => `"${String(v).replace(/"/g, '\\"')}"`).join(",")}}'`;
  if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function rowsToSQL(tableName: string, rows: Record<string, any>[]): string {
  if (!rows.length) return `-- No data in ${tableName}\n`;
  const cols = Object.keys(rows[0]);
  const header = `-- Export: ${tableName} (${rows.length} rows)\n-- Generated: ${new Date().toISOString()}\n\n`;
  const inserts = rows.map((row) => {
    const values = cols.map((c) => escapeSQL(row[c])).join(", ");
    return `INSERT INTO public.${tableName} (${cols.join(", ")}) VALUES (${values});`;
  });
  return header + inserts.join("\n") + "\n";
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataManagementPage() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"json" | "sql">("json");
  const [restoreItem, setRestoreItem] = useState<{ table: string; id: string; name: string } | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string[]>([]);

  async function cleanupData() {
    setCleaning(true);
    setCleanResult([]);
    try {
      const res = await supabase.functions.invoke("cleanup-data");
      if (res.error) throw res.error;
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
      setCleanResult(data?.progress ?? ["Gotowe"]);
      toast.success("Baza wyczyszczona!");
    } catch (e: any) {
      toast.error("Błąd: " + (e?.message || "unknown"));
    } finally {
      setCleaning(false);
    }
  }


  // Check admin role
  const { data: myRoles = [] } = useQuery({
    queryKey: ["my-roles-data-mgmt"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user?.id);
      return data ?? [];
    },
    enabled: !!user?.id,
  });
  const isAdmin = myRoles.some((r: any) => r.role === "ADMIN");

  // Fetch deleted records
  const { data: deletedRecords = [], refetch: refetchDeleted } = useQuery({
    queryKey: ["deleted-records"],
    queryFn: async () => {
      const results: any[] = [];
      for (const t of SOFT_DELETE_TABLES) {
        const { data } = await supabase
          .from(t.table as any)
          .select("id, deleted_at, " + t.nameField)
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(50);
        if (data?.length) {
          results.push(...data.map((r: any) => ({
            ...r,
            _table: t.table,
            _tableLabel: t.label,
            _name: r[t.nameField] || r.id?.slice(0, 8),
          })));
        }
      }
      return results.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
    },
    enabled: isAdmin,
  });

  async function exportSqlViaEdge(tables?: string[]) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session");
    const res = await supabase.functions.invoke("sql-dump", {
      body: tables ? { tables } : {},
    });
    if (res.error) throw res.error;
    // res.data is the SQL string
    const text = typeof res.data === "string" ? res.data : await (res.data as Blob).text();
    return text;
  }

  async function exportTable(tableKey: string, label: string) {
    setExporting(tableKey);
    try {
      const ts = format(new Date(), "yyyy-MM-dd_HHmm");
      if (exportFormat === "sql") {
        const sql = await exportSqlViaEdge([tableKey]);
        downloadFile(sql, `${tableKey}_${ts}.sql`, "text/sql");
      } else {
        const { data, error } = await supabase.from(tableKey as any).select("*");
        if (error) throw error;
        downloadFile(JSON.stringify(data, null, 2), `${tableKey}_${ts}.json`, "application/json");
      }
      toast.success(`Wyeksportowano: ${label} (${exportFormat.toUpperCase()})`);
    } catch {
      toast.error("Błąd eksportu");
    } finally {
      setExporting(null);
    }
  }

  async function exportAll() {
    setExporting("all");
    try {
      const ts = format(new Date(), "yyyy-MM-dd_HHmm");
      if (exportFormat === "sql") {
        const sql = await exportSqlViaEdge();
        downloadFile(sql, `full_backup_${ts}.sql`, "text/sql");
      } else {
        const allData: Record<string, any> = {};
        for (const t of ENTITY_TABLES) {
          const { data } = await supabase.from(t.table as any).select("*");
          allData[t.key] = data ?? [];
        }
        allData._exported_at = new Date().toISOString();
        downloadFile(JSON.stringify(allData, null, 2), `full_backup_${ts}.json`, "application/json");
      }
      toast.success(`Pełny backup wyeksportowany (${exportFormat.toUpperCase()})`);
    } catch {
      toast.error("Błąd eksportu");
    } finally {
      setExporting(null);
    }
  }

  async function restoreRecord(table: string, id: string) {
    try {
      const { error } = await supabase
        .from(table as any)
        .update({ deleted_at: null, is_archived: false } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("Przywrócono rekord");
      refetchDeleted();
      setRestoreItem(null);
    } catch {
      toast.error("Błąd przywracania");
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
        Brak uprawnień. Wymagana rola ADMIN.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" /> Zarządzanie danymi
        </h1>
        <p className="text-sm text-muted-foreground">Eksport danych, przywracanie usuniętych rekordów</p>
      </div>

      {/* Cleanup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trash2 className="h-5 w-5" /> Czyszczenie bazy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Usuń wszystkie dane z bazy (klienci, zlecenia, dokumenty, urządzenia, magazyn, kasa, oferty).
            Operacja jest nieodwracalna!
          </p>
          <Button onClick={cleanupData} disabled={cleaning} variant="destructive">
            {cleaning ? "⏳ Czyszczenie w toku..." : "🧹 Wyczyść całą bazę"}
          </Button>
          {cleanResult.length > 0 && (
            <div className="mt-3 space-y-1">
              {cleanResult.map((line, i) => (
                <p key={i} className="text-sm text-muted-foreground">✅ {line}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5" /> Eksport danych
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Tabs value={exportFormat} onValueChange={(v) => setExportFormat(v as "json" | "sql")}>
              <TabsList>
                <TabsTrigger value="json">JSON</TabsTrigger>
                <TabsTrigger value="sql" className="gap-1">
                  <FileCode className="h-3.5 w-3.5" /> SQL
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={exportAll} disabled={!!exporting} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              {exporting === "all" ? "Eksportowanie..." : `Pełny backup (${exportFormat.toUpperCase()})`}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {ENTITY_TABLES.map((t) => (
              <Button
                key={t.key}
                variant="outline"
                size="sm"
                disabled={!!exporting}
                onClick={() => exportTable(t.key, t.label)}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                {exporting === t.key ? "..." : t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Deleted Records / Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Archive className="h-5 w-5" /> Usunięte rekordy
            {deletedRecords.length > 0 && (
              <Badge variant="secondary">{deletedRecords.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead>Data usunięcia</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deletedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Brak usuniętych rekordów
                  </TableCell>
                </TableRow>
              ) : (
                deletedRecords.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant="outline">{r._tableLabel}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{r._name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(r.deleted_at), "dd.MM.yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRestoreItem({ table: r._table, id: r.id, name: r._name })}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Przywróć
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Restore confirm */}
      <AlertDialog open={!!restoreItem} onOpenChange={(open) => { if (!open) setRestoreItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Przywrócić rekord?</AlertDialogTitle>
            <AlertDialogDescription>
              Rekord „{restoreItem?.name}" zostanie przywrócony i będzie ponownie widoczny w systemie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => restoreItem && restoreRecord(restoreItem.table, restoreItem.id)}>
              Przywróć
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
