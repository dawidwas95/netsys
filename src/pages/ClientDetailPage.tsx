import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Phone, Mail, MapPin, Building2, Pencil, Archive, ClipboardList, Monitor, Banknote, History } from "lucide-react";
import { toast } from "sonner";
import { CLIENT_TYPE_LABELS, BUSINESS_ROLE_LABELS, DEVICE_CATEGORY_LABELS, type Client, type ClientType, type Device, type DeviceCategory, type BusinessRole } from "@/types/database";
import { OrderStatusBadge } from "@/pages/DashboardPage";
import { ClientFormDialog } from "@/components/ClientFormDialog";
import { DeviceFormDialog } from "@/components/DeviceFormDialog";
import { DeviceHistoryDialog } from "@/components/DeviceHistoryDialog";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDeviceDialogOpen, setEditDeviceDialogOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [archiveDevice, setArchiveDevice] = useState<Device | null>(null);
  const [historyDevice, setHistoryDevice] = useState<Device | null>(null);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Client;
    },
    enabled: !!id,
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["client-devices", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("devices")
        .select("*")
        .eq("client_id", id!)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      return (data ?? []) as Device[];
    },
    enabled: !!id,
  });

  const { data: orders = [] } = useQuery({
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

  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("client_id", id!)
        .eq("is_archived", false)
        .order("issue_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const archiveDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase.from("devices").update({ is_archived: true }).eq("id", deviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-devices", id] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Urządzenie zarchiwizowane");
      setArchiveDevice(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const totalRepairValue = orders.reduce((sum: number, o: any) => sum + (o.total_gross ?? 0), 0);

  function getDeviceOrderCount(deviceId: string) {
    return orders.filter((o: any) => o.device_id === deviceId).length;
  }

  function getDeviceOrders(deviceId: string) {
    return orders.filter((o: any) => o.device_id === deviceId);
  }

  if (isLoading) return <p className="text-muted-foreground p-4">Ładowanie...</p>;
  if (!client) return <p className="text-muted-foreground p-4">Klient nie znaleziony</p>;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/clients" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{client.display_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{CLIENT_TYPE_LABELS[client.client_type as ClientType]}</Badge>
              <Badge variant="outline">{BUSINESS_ROLE_LABELS[(client as any).business_role as BusinessRole] ?? "Klient"}</Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
          <Pencil className="mr-1 h-4 w-4" /> Edytuj klienta
        </Button>
      </div>

      {/* Summary statistics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Zlecenia</p>
              <p className="text-2xl font-bold">{orders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Urządzenia</p>
              <p className="text-2xl font-bold">{devices.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Banknote className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Łączna wartość napraw</p>
              <p className="text-2xl font-bold">{totalRepairValue.toFixed(2)} zł</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dane">
        <TabsList>
          <TabsTrigger value="dane">Dane</TabsTrigger>
          <TabsTrigger value="devices">Urządzenia ({devices.length})</TabsTrigger>
          <TabsTrigger value="history">Historia napraw ({orders.length})</TabsTrigger>
          <TabsTrigger value="documents">Dokumenty ({documents.length})</TabsTrigger>
        </TabsList>

        {/* Dane tab */}
        <TabsContent value="dane" className="mt-4">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Kontakt</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {client.first_name && <div><span className="text-muted-foreground">Imię:</span> {client.first_name}</div>}
                {client.last_name && <div><span className="text-muted-foreground">Nazwisko:</span> {client.last_name}</div>}
                {client.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{client.phone}</div>}
                {client.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{client.email}</div>}
                {client.address_city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {[client.address_street, client.address_postal_code, client.address_city].filter(Boolean).join(", ")}
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
                  {client.website && <div>WWW: <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{client.website}</a></div>}
                </CardContent>
              </Card>
            )}

            {client.notes && (
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Uwagi</CardTitle></CardHeader>
                <CardContent><p className="text-sm whitespace-pre-wrap">{client.notes}</p></CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Devices tab */}
        <TabsContent value="devices" className="mt-4">
          <div className="mb-3 flex justify-end">
            <DeviceFormDialog clientId={id} />
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {!devices.length ? (
              <p className="text-center text-muted-foreground py-8">Brak urządzeń</p>
            ) : devices.map((device) => {
              const deviceOrders = getDeviceOrders(device.id);
              return (
                <Card key={device.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{device.manufacturer} {device.model}</span>
                      <Badge variant="secondary">{DEVICE_CATEGORY_LABELS[device.device_category as DeviceCategory]}</Badge>
                    </div>
                    {device.serial_number && <div className="text-xs text-muted-foreground font-mono">S/N: {device.serial_number}</div>}
                    <div className="text-xs text-muted-foreground">Naprawy: {deviceOrders.length}</div>
                    {deviceOrders.length > 0 && (
                      <div className="border-t pt-2 mt-2 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Historia napraw:</p>
                        {deviceOrders.slice(0, 3).map((o: any) => (
                          <Link key={o.id} to={`/orders/${o.id}`} className="text-xs text-primary hover:underline block">
                            {o.order_number} — {o.repair_description || o.problem_description || "—"}
                          </Link>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setHistoryDevice(device)}>
                        <History className="h-3.5 w-3.5 mr-1" />Historia
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setEditDevice(device); setEditDeviceDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />Edytuj
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setArchiveDevice(device)}>
                        <Archive className="h-3.5 w-3.5 mr-1" />Archiwizuj
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="data-table-wrapper hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Producent / Model</TableHead>
                  <TableHead>Nr seryjny</TableHead>
                  <TableHead>Naprawy</TableHead>
                  <TableHead>Ostatnia naprawa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!devices.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Brak urządzeń</TableCell></TableRow>
                ) : (
                  devices.map((device) => {
                    const deviceOrders = getDeviceOrders(device.id);
                    const lastOrder = deviceOrders[0];
                    return (
                      <TableRow key={device.id}>
                        <TableCell>{DEVICE_CATEGORY_LABELS[device.device_category as DeviceCategory]}</TableCell>
                        <TableCell className="font-medium">{device.manufacturer} {device.model}</TableCell>
                        <TableCell className="font-mono text-sm">{device.serial_number ?? "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{deviceOrders.length}</Badge></TableCell>
                        <TableCell>
                          {lastOrder ? (
                            <div>
                              <Link to={`/orders/${lastOrder.id}`} className="text-primary hover:underline text-sm font-mono">{lastOrder.order_number}</Link>
                              <p className="text-xs text-muted-foreground truncate max-w-48">{lastOrder.repair_description || lastOrder.problem_description || ""}</p>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell><Badge variant="secondary">{device.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditDevice(device); setEditDeviceDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setArchiveDevice(device)}>
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history" className="mt-4">
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {!orders.length ? (
              <p className="text-center text-muted-foreground py-8">Brak zleceń</p>
            ) : orders.map((order: any) => (
              <Link key={order.id} to={`/orders/${order.id}`} className="block">
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-primary">{order.order_number}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.devices ? `${order.devices.manufacturer} ${order.devices.model}` : "—"}
                    </p>
                    <p className="text-sm truncate">{order.repair_description || order.problem_description || "—"}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(order.received_at).toLocaleDateString("pl-PL")}</span>
                      {order.total_gross != null && <span className="font-medium text-foreground">{Number(order.total_gross).toFixed(2)} zł</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="data-table-wrapper hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr zlecenia</TableHead>
                  <TableHead>Urządzenie</TableHead>
                  <TableHead>Opis naprawy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data przyjęcia</TableHead>
                  <TableHead className="text-right">Koszt brutto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!orders.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Brak zleceń</TableCell></TableRow>
                ) : (
                  orders.map((order: any) => (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Link to={`/orders/${order.id}`} className="font-medium text-primary hover:underline font-mono">{order.order_number}</Link>
                      </TableCell>
                      <TableCell>{order.devices ? `${order.devices.manufacturer} ${order.devices.model}` : "—"}</TableCell>
                      <TableCell className="max-w-64 truncate text-sm">{order.repair_description || order.problem_description || "—"}</TableCell>
                      <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                      <TableCell className="text-sm">{new Date(order.received_at).toLocaleDateString("pl-PL")}</TableCell>
                      <TableCell className="text-right font-medium">{order.total_gross != null ? `${Number(order.total_gross).toFixed(2)} zł` : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Documents tab */}
        <TabsContent value="documents" className="mt-4">
          <div className="data-table-wrapper">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr dokumentu</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Data wystawienia</TableHead>
                  <TableHead className="text-right">Brutto</TableHead>
                  <TableHead>Status płatności</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!documents.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Brak dokumentów</TableCell></TableRow>
                ) : (
                  documents.map((doc: any) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-mono text-sm">{doc.document_number}</TableCell>
                      <TableCell><Badge variant="secondary">{doc.document_type}</Badge></TableCell>
                      <TableCell className="text-sm">{new Date(doc.issue_date).toLocaleDateString("pl-PL")}</TableCell>
                      <TableCell className="text-right font-medium">{Number(doc.gross_amount).toFixed(2)} zł</TableCell>
                      <TableCell><Badge variant={doc.payment_status === "PAID" ? "default" : "secondary"}>{doc.payment_status}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit client dialog */}
      <ClientFormDialog
        externalOpen={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editClient={client}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["client", id] });
          setEditDialogOpen(false);
        }}
      />

      {/* Edit device dialog */}
      <DeviceFormDialog
        clientId={id}
        externalOpen={editDeviceDialogOpen}
        onOpenChange={setEditDeviceDialogOpen}
        editDevice={editDevice}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["client-devices", id] });
          setEditDeviceDialogOpen(false);
        }}
      />

      {/* Archive device confirmation */}
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
            <AlertDialogAction onClick={() => archiveDevice && archiveDeviceMutation.mutate(archiveDevice.id)}>
              Archiwizuj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
