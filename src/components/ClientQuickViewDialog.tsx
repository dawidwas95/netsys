import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, MapPin, Building2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CLIENT_TYPE_LABELS, BUSINESS_ROLE_LABELS, type Client, type ClientType, type BusinessRole } from "@/types/database";

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

  const { data: stats } = useQuery({
    queryKey: ["client-quick-stats", clientId],
    queryFn: async () => {
      const [{ count: ordersCount }, { count: devicesCount }] = await Promise.all([
        supabase.from("service_orders").select("*", { count: "exact", head: true }).eq("client_id", clientId!),
        supabase.from("devices").select("*", { count: "exact", head: true }).eq("client_id", clientId!).eq("is_archived", false),
      ]);
      return { orders: ordersCount ?? 0, devices: devicesCount ?? 0 };
    },
    enabled: !!clientId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {client?.display_name ?? "Ładowanie..."}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !client ? (
          <p className="text-sm text-muted-foreground py-4">Ładowanie...</p>
        ) : (
          <div className="space-y-4">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{CLIENT_TYPE_LABELS[client.client_type as ClientType]}</Badge>
              <Badge variant="outline">{BUSINESS_ROLE_LABELS[(client as any).business_role as BusinessRole] ?? "Klient"}</Badge>
            </div>

            {/* Contact info */}
            <div className="space-y-2 text-sm">
              {client.company_name && (
                <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{client.company_name}</div>
              )}
              {client.nip && (
                <div><span className="text-muted-foreground">NIP:</span> {client.nip}</div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{client.phone}</div>
              )}
              {client.email && (
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{client.email}</div>
              )}
              {client.address_city && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {[client.address_street, client.address_postal_code, client.address_city].filter(Boolean).join(", ")}
                </div>
              )}
              {client.notes && (
                <div className="text-muted-foreground text-xs mt-2 border-t pt-2">{client.notes}</div>
              )}
            </div>

            {/* Stats */}
            {stats && (
              <div className="flex gap-4 text-sm border-t pt-3">
                <div><span className="text-muted-foreground">Zlecenia:</span> <span className="font-semibold">{stats.orders}</span></div>
                <div><span className="text-muted-foreground">Urządzenia:</span> <span className="font-semibold">{stats.devices}</span></div>
              </div>
            )}

            {/* Link to full page */}
            <div className="border-t pt-3">
              <Link to={`/clients/${clientId}`} onClick={() => onOpenChange(false)}>
                <Button variant="outline" size="sm" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-1" /> Otwórz pełną kartę klienta
                </Button>
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
