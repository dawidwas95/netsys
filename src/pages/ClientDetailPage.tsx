import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Phone, Mail, MapPin, Building2, User } from "lucide-react";
import { CLIENT_TYPE_LABELS, DEVICE_CATEGORY_LABELS, type ClientType, type DeviceCategory } from "@/types/database";
import { OrderStatusBadge } from "@/pages/DashboardPage";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: devices } = useQuery({
    queryKey: ["client-devices", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("devices")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: orders } = useQuery({
    queryKey: ["client-orders", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("*, devices(manufacturer, model)")
        .eq("client_id", id!)
        .order("received_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  if (isLoading) return <p className="text-muted-foreground">Ładowanie...</p>;
  if (!client) return <p className="text-muted-foreground">Klient nie znaleziony</p>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/clients" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{client.display_name}</h1>
            <Badge variant="secondary">
              {CLIENT_TYPE_LABELS[client.client_type as ClientType]}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Kontakt</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {client.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{client.phone}</div>}
            {client.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{client.email}</div>}
            {client.address_city && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {[client.address_street, client.address_building, client.address_postal_code, client.address_city].filter(Boolean).join(", ")}
              </div>
            )}
          </CardContent>
        </Card>

        {client.client_type === "COMPANY" && (
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Dane firmy</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{client.company_name}</div>
              {client.nip && <div>NIP: <span className="font-mono">{client.nip}</span></div>}
              {client.regon && <div>REGON: <span className="font-mono">{client.regon}</span></div>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Statystyki</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Urządzenia: <span className="font-bold">{devices?.length ?? 0}</span></div>
            <div>Zlecenia: <span className="font-bold">{orders?.length ?? 0}</span></div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Zlecenia ({orders?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="devices">Urządzenia ({devices?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          <div className="data-table-wrapper">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr zlecenia</TableHead>
                  <TableHead>Urządzenie</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data przyjęcia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!orders?.length ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Brak zleceń</TableCell></TableRow>
                ) : (
                  orders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Link to={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                          {order.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>{order.devices ? `${order.devices.manufacturer} ${order.devices.model}` : "—"}</TableCell>
                      <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                      <TableCell className="text-sm">{new Date(order.received_at).toLocaleDateString("pl-PL")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="devices" className="mt-4">
          <div className="data-table-wrapper">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Producent</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Nr seryjny</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!devices?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Brak urządzeń</TableCell></TableRow>
                ) : (
                  devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>{DEVICE_CATEGORY_LABELS[device.device_category as DeviceCategory]}</TableCell>
                      <TableCell>{device.manufacturer}</TableCell>
                      <TableCell>{device.model}</TableCell>
                      <TableCell className="font-mono text-sm">{device.serial_number}</TableCell>
                      <TableCell><Badge variant="secondary">{device.status}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
