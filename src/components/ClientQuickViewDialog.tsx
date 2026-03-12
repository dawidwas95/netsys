import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, Building2, ExternalLink, ClipboardList, Monitor, Banknote } from "lucide-react";
import { Link } from "react-router-dom";
import {
  CLIENT_TYPE_LABELS, BUSINESS_ROLE_LABELS, DEVICE_CATEGORY_LABELS,
  ORDER_STATUS_LABELS,
  type Client, type ClientType, type Device, type DeviceCategory, type BusinessRole,
} from "@/types/database";
import { OrderStatusBadge } from "@/pages/DashboardPage";

interface ClientQuickViewDialogProps {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientQuickViewDialog({ clientId, open, onOpenChange }: ClientQuickViewDialogProps) {
  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId!).single();
      if (error) throw error;
      return data as Client;
    },
    enabled: !!clientId && open,
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["client-devices", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("devices").select("*")
        .eq("client_id", clientId!)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      return (data ?? []) as Device[];
    },
    enabled: !!clientId && open,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["client-orders", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("*, devices(manufacturer, model)")
        .eq("client_id", clientId!)
        .order("received_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!clientId && open,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents").select("*")
        .eq("client_id", clientId!)
        .eq("is_archived", false)
        .order("issue_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!clientId && open,
  });

  const totalRepairValue = orders.reduce((sum: number, o: any) => sum + (o.total_gross ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0">
        {isLoading || !client ? (
          <div className="p-6 text-sm text-muted-foreground">Ładowanie...</div>
        ) : (
          <>
            {/* Header */}
            <DialogHeader className="p-6 pb-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <DialogTitle className="text-xl">{client.display_name}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary">{CLIENT_TYPE_LABELS[client.client_type as ClientType]}</Badge>
                    <Badge variant="outline">{BUSINESS_ROLE_LABELS[(client as any).business_role as BusinessRole] ?? "Klient"}</Badge>
                  </div>
                </div>
                <Link to={`/clients/${clientId}`} onClick={() => onOpenChange(false)}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" /> Pełna karta
                  </Button>
                </Link>
              </div>
            </DialogHeader>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 px-6 pt-4">
              <Card>
                <CardContent className="flex items-center gap-2.5 p-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Zlecenia</p>
                    <p className="text-lg font-bold">{orders.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-2.5 p-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Monitor className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Urządzenia</p>
                    <p className="text-lg font-bold">{devices.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-2.5 p-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Banknote className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Wartość napraw</p>
                    <p className="text-lg font-bold">{totalRepairValue.toFixed(2)} zł</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <div className="px-6 pb-6 pt-4">
              <Tabs defaultValue="dane">
                <TabsList>
                  <TabsTrigger value="dane">Dane</TabsTrigger>
                  <TabsTrigger value="devices">Urządzenia ({devices.length})</TabsTrigger>
                  <TabsTrigger value="history">Historia ({orders.length})</TabsTrigger>
                  <TabsTrigger value="documents">Dokumenty ({documents.length})</TabsTrigger>
                </TabsList>

                {/* Dane */}
                <TabsContent value="dane" className="mt-4">
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Kontakt</CardTitle></CardHeader>
                      <CardContent className="space-y-1.5 text-sm">
                        {client.first_name && <div><span className="text-muted-foreground">Imię:</span> {client.first_name}</div>}
                        {client.last_name && <div><span className="text-muted-foreground">Nazwisko:</span> {client.last_name}</div>}
                        {client.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{client.phone}</div>}
                        {client.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{client.email}</div>}
                        {client.address_city && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {[client.address_street, client.address_building, client.address_local].filter(Boolean).join(" ")}
                            {client.address_postal_code && `, ${client.address_postal_code}`} {client.address_city}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {client.client_type === "COMPANY" && (
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Dane firmy</CardTitle></CardHeader>
                        <CardContent className="space-y-1.5 text-sm">
                          <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{client.company_name}</div>
                          {client.nip && <div>NIP: <span className="font-mono">{client.nip}</span></div>}
                          {(client as any).regon && <div>REGON: <span className="font-mono">{(client as any).regon}</span></div>}
                          {client.website && <div>WWW: <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{client.website}</a></div>}
                        </CardContent>
                      </Card>
                    )}

                    {client.notes && (
                      <Card className="sm:col-span-2">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Uwagi</CardTitle></CardHeader>
                        <CardContent><p className="text-sm whitespace-pre-wrap">{client.notes}</p></CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                {/* Urządzenia */}
                <TabsContent value="devices" className="mt-4">
                  <div className="overflow-auto max-h-[40vh]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kategoria</TableHead>
                          <TableHead>Producent / Model</TableHead>
                          <TableHead>Nr seryjny</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!devices.length ? (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Brak urządzeń</TableCell></TableRow>
                        ) : devices.map((device) => (
                          <TableRow key={device.id}>
                            <TableCell className="text-sm">{DEVICE_CATEGORY_LABELS[device.device_category as DeviceCategory]}</TableCell>
                            <TableCell className="font-medium text-sm">{device.manufacturer} {device.model}</TableCell>
                            <TableCell className="font-mono text-xs">{device.serial_number ?? "—"}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{device.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Historia napraw */}
                <TabsContent value="history" className="mt-4">
                  <div className="overflow-auto max-h-[40vh]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nr zlecenia</TableHead>
                          <TableHead>Urządzenie</TableHead>
                          <TableHead>Opis</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Brutto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!orders.length ? (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Brak zleceń</TableCell></TableRow>
                        ) : orders.map((order: any) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Link to={`/orders/${order.id}`} onClick={() => onOpenChange(false)} className="font-mono text-primary hover:underline text-sm">
                                {order.order_number}
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm">{order.devices ? `${order.devices.manufacturer} ${order.devices.model}` : "—"}</TableCell>
                            <TableCell className="text-sm max-w-48 truncate">{order.repair_description || order.problem_description || "—"}</TableCell>
                            <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                            <TableCell className="text-sm">{new Date(order.received_at).toLocaleDateString("pl-PL")}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{order.total_gross != null ? `${Number(order.total_gross).toFixed(2)} zł` : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Dokumenty */}
                <TabsContent value="documents" className="mt-4">
                  <div className="overflow-auto max-h-[40vh]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nr dokumentu</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Data wystawienia</TableHead>
                          <TableHead className="text-right">Brutto</TableHead>
                          <TableHead>Płatność</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!documents.length ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Brak dokumentów</TableCell></TableRow>
                        ) : documents.map((doc: any) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-mono text-sm">{doc.document_number}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{doc.document_type}</Badge></TableCell>
                            <TableCell className="text-sm">{new Date(doc.issue_date).toLocaleDateString("pl-PL")}</TableCell>
                            <TableCell className="text-right font-medium text-sm">{Number(doc.gross_amount).toFixed(2)} zł</TableCell>
                            <TableCell><Badge variant={doc.payment_status === "PAID" ? "default" : "secondary"} className="text-xs">{doc.payment_status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
