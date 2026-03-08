import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ScrollText, Filter, X } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Utworzenie",
  UPDATE: "Edycja",
  DELETE: "Usunięcie",
  STATUS_CHANGE: "Zmiana statusu",
  PAYMENT: "Płatność",
  INVENTORY_IN: "Przyjęcie mag.",
  INVENTORY_OUT: "Wydanie mag.",
  COMMENT: "Komentarz",
  ARCHIVE: "Archiwizacja",
  CANCEL: "Anulowanie",
  CORRECTION: "Korekta",
};

const ENTITY_LABELS: Record<string, string> = {
  service_order: "Zlecenie",
  document: "Dokument",
  document_item: "Pozycja dokumentu",
  inventory_item: "Magazyn",
  inventory_movement: "Ruch magazynowy",
  cash_transaction: "Kasa",
  it_work_entry: "Praca IT",
  client: "Klient",
  device: "Urządzenie",
  offer: "Oferta",
  comment: "Komentarz",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  UPDATE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DELETE: "bg-destructive/20 text-destructive border-destructive/30",
  STATUS_CHANGE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  PAYMENT: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  INVENTORY_IN: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  INVENTORY_OUT: "bg-red-500/20 text-red-400 border-red-500/30",
  CORRECTION: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  CANCEL: "bg-destructive/20 text-destructive border-destructive/30",
  ARCHIVE: "bg-muted text-muted-foreground border-border",
  COMMENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function SystemLogsPage() {
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterEntity, setFilterEntity] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["system-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let result = logs;
    if (filterAction) result = result.filter((l: any) => l.action_type === filterAction);
    if (filterEntity) result = result.filter((l: any) => l.entity_type === filterEntity);
    if (filterDateFrom) result = result.filter((l: any) => l.created_at >= filterDateFrom);
    if (filterDateTo) result = result.filter((l: any) => l.created_at <= filterDateTo + "T23:59:59");
    if (filterSearch) {
      const s = filterSearch.toLowerCase();
      result = result.filter(
        (l: any) =>
          (l.user_name || "").toLowerCase().includes(s) ||
          (l.entity_name || "").toLowerCase().includes(s) ||
          (l.description || "").toLowerCase().includes(s)
      );
    }
    return result;
  }, [logs, filterAction, filterEntity, filterDateFrom, filterDateTo, filterSearch]);

  const hasFilters = filterAction || filterEntity || filterDateFrom || filterDateTo || filterSearch;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6" /> Logi systemowe
        </h1>
        <p className="text-sm text-muted-foreground">Historia wszystkich operacji w systemie</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtry</span>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterAction("");
                  setFilterEntity("");
                  setFilterDateFrom("");
                  setFilterDateTo("");
                  setFilterSearch("");
                }}
              >
                <X className="h-3 w-3 mr-1" /> Wyczyść
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Szukaj</Label>
              <Input
                placeholder="Użytkownik, nazwa..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Akcja</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger><SelectValue placeholder="Wszystkie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Typ obiektu</Label>
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger><SelectValue placeholder="Wszystkie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Od daty</Label>
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Do daty</Label>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex gap-2 text-sm text-muted-foreground">
        <span>Wyników: <strong>{filtered.length}</strong></span>
        {hasFilters && <span>z {logs.length} łącznie</span>}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Data</TableHead>
                <TableHead>Użytkownik</TableHead>
                <TableHead>Akcja</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead>Opis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Ładowanie...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Brak logów do wyświetlenia
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {format(new Date(log.created_at), "dd.MM.yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(log as any).user_name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ACTION_COLORS[log.action_type] || "bg-muted text-muted-foreground"}
                      >
                        {ACTION_LABELS[log.action_type] || log.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {ENTITY_LABELS[log.entity_type] || log.entity_type}
                    </TableCell>
                    <TableCell className="text-sm font-mono max-w-[200px] truncate">
                      {(log as any).entity_name || log.entity_id?.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {(log as any).description || "—"}
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
