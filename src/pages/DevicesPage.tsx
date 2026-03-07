import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { DEVICE_CATEGORY_LABELS, type DeviceCategory } from "@/types/database";
import { Link } from "react-router-dom";
import { DeviceFormDialog } from "@/components/DeviceFormDialog";

export default function DevicesPage() {
  const [search, setSearch] = useState("");

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
      return data;
    },
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Ładowanie...</TableCell></TableRow>
            ) : !devices?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Brak urządzeń</TableCell></TableRow>
            ) : (
              devices.map((device: any) => (
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
