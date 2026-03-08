import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Pencil, Archive, History } from "lucide-react";
import { toast } from "sonner";
import { DEVICE_CATEGORY_LABELS, type Device, type DeviceCategory } from "@/types/database";
import { Link } from "react-router-dom";
import { DeviceFormDialog } from "@/components/DeviceFormDialog";
import { DeviceHistoryDialog } from "@/components/DeviceHistoryDialog";

export default function DevicesPage() {
  const [search, setSearch] = useState("");
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveDevice, setArchiveDevice] = useState<Device | null>(null);
  const [historyDevice, setHistoryDevice] = useState<Device | null>(null);
  const queryClient = useQueryClient();

  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices", search],
    queryFn: async () => {
      let query = supabase
        .from("devices")
        .select("*, clients(display_name)")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (search) {
        query = query.or(
          `manufacturer.ilike.%${search}%,model.ilike.%${search}%,serial_number.ilike.%${search}%,imei.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Device & { clients: { display_name: string } | null })[];
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase.from("devices").update({ is_archived: true }).eq("id", deviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Urządzenie zarchiwizowane");
      setArchiveDevice(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusLabels: Record<string, string> = {
    ACTIVE: "Aktywne",
    IN_SERVICE: "W serwisie",
    RETIRED: "Wycofane",
  };

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-primary/10 text-primary",
    IN_SERVICE: "bg-accent text-accent-foreground",
    RETIRED: "bg-muted text-muted-foreground",
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Urządzenia</h1>
          <p className="text-muted-foreground text-sm">{devices?.length ?? 0} urządzeń</p>
        </div>
        <DeviceFormDialog />
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj po producencie, modelu, S/N, IMEI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="data-table-wrapper">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategoria</TableHead>
              <TableHead>Producent</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Nr seryjny</TableHead>
              <TableHead>IMEI</TableHead>
              <TableHead>Klient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Ładowanie...</TableCell></TableRow>
            ) : !devices?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Brak urządzeń</TableCell></TableRow>
            ) : (
              devices.map((device) => (
                <TableRow key={device.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Badge variant="secondary">
                      {DEVICE_CATEGORY_LABELS[device.device_category as DeviceCategory]}
                    </Badge>
                  </TableCell>
                  <TableCell>{device.manufacturer ?? "—"}</TableCell>
                  <TableCell>{device.model ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{device.serial_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{device.imei ?? "—"}</TableCell>
                  <TableCell>
                    {device.clients ? (
                      <Link to={`/clients/${device.client_id}`} className="text-primary hover:underline">
                        {device.clients.display_name}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`status-badge ${statusColor[device.status] ?? ""}`}>
                      {statusLabels[device.status] ?? device.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Historia" onClick={() => setHistoryDevice(device)}>
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditDevice(device); setEditDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setArchiveDevice(device)}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <DeviceFormDialog
        externalOpen={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editDevice={editDevice}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["devices"] });
          setEditDialogOpen(false);
        }}
      />

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveDevice} onOpenChange={(o) => !o && setArchiveDevice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiwizować urządzenie?</AlertDialogTitle>
            <AlertDialogDescription>
              Urządzenie „{archiveDevice?.manufacturer} {archiveDevice?.model}" zostanie zarchiwizowane i ukryte z listy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveDevice && archiveMutation.mutate(archiveDevice.id)}>
              Archiwizuj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Device history dialog */}
      <DeviceHistoryDialog
        open={!!historyDevice}
        onOpenChange={(o) => !o && setHistoryDevice(null)}
        deviceId={historyDevice?.id ?? ""}
        deviceName={`${historyDevice?.manufacturer ?? ""} ${historyDevice?.model ?? ""}`.trim() || "Urządzenie"}
      />
    </div>
  );
}
