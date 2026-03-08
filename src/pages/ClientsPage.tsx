import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Phone, Mail, Archive, Pencil } from "lucide-react";
import { toast } from "sonner";
import { CLIENT_TYPE_LABELS, BUSINESS_ROLE_LABELS, type Client, type ClientType, type BusinessRole } from "@/types/database";
import { Link } from "react-router-dom";
import { ClientFormDialog } from "@/components/ClientFormDialog";
import { Badge } from "@/components/ui/badge";

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("customers");
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveClient, setArchiveClient] = useState<Client | null>(null);
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", search, roleFilter],
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select("*")
        .eq("is_active", true)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      // Filter by business role
      if (roleFilter === "customers") {
        query = query.in("business_role", ["CUSTOMER", "CUSTOMER_AND_SUPPLIER"]);
      } else if (roleFilter === "suppliers") {
        query = query.in("business_role", ["SUPPLIER", "CUSTOMER_AND_SUPPLIER"]);
      }
      // "all" shows everything

      if (search) {
        query = query.or(
          `display_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,nip.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Client[];
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ is_archived: true, is_active: false })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-select"] });
      toast.success("Klient zarchiwizowany");
      setArchiveClient(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {roleFilter === "suppliers" ? "Dostawcy" : roleFilter === "all" ? "Kontrahenci" : "Klienci"}
          </h1>
          <p className="text-muted-foreground text-sm">{clients?.length ?? 0} pozycji</p>
        </div>
        <ClientFormDialog />
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie, telefonie, NIP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 min-h-[44px]"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48 min-h-[44px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="customers">Klienci</SelectItem>
            <SelectItem value="suppliers">Dostawcy</SelectItem>
            <SelectItem value="all">Wszyscy</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile card view */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Ładowanie...</div>
        ) : !clients?.length ? (
          <div className="text-center py-8 text-muted-foreground">Brak klientów</div>
        ) : (
          clients.map((client) => (
            <div key={client.id} className="mobile-data-card">
              <div className="mobile-card-header">
                <Link to={`/clients/${client.id}`} className="font-medium text-primary hover:underline">
                  {client.display_name}
                </Link>
                <span className="status-badge bg-secondary text-secondary-foreground">
                  {CLIENT_TYPE_LABELS[client.client_type as ClientType]}
                </span>
              </div>
              {client.phone && (
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Telefon</span>
                  <span className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" />{client.phone}</span>
                </div>
              )}
              {client.email && (
                <div className="mobile-card-row">
                  <span className="mobile-card-label">E-mail</span>
                  <span className="flex items-center gap-1 text-sm"><Mail className="h-3 w-3" />{client.email}</span>
                </div>
              )}
              {client.address_city && (
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Miasto</span>
                  <span className="text-sm">{client.address_city}</span>
                </div>
              )}
              {client.nip && (
                <div className="mobile-card-row">
                  <span className="mobile-card-label">NIP</span>
                  <span className="text-sm font-mono">{client.nip}</span>
                </div>
              )}
              <div className="mobile-card-actions">
                <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => { setEditClient(client); setEditDialogOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />Edytuj
                </Button>
                <Button variant="ghost" size="sm" className="min-h-[44px] text-destructive" onClick={() => setArchiveClient(client)}>
                  <Archive className="h-3.5 w-3.5 mr-1" />Archiwizuj
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="data-table-wrapper hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Miasto</TableHead>
              <TableHead>NIP</TableHead>
              <TableHead className="w-20">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">Ładowanie...</TableCell>
              </TableRow>
            ) : !clients?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">Brak klientów</TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link to={`/clients/${client.id}`} className="font-medium text-primary hover:underline">
                      {client.display_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="status-badge bg-secondary text-secondary-foreground">
                      {CLIENT_TYPE_LABELS[client.client_type as ClientType]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {client.phone && (
                      <span className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" /> {client.phone}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.email && (
                      <span className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3" /> {client.email}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{client.address_city}</TableCell>
                  <TableCell className="text-sm font-mono">{client.nip}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditClient(client); setEditDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setArchiveClient(client)}>
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

      {/* Edit dialog — uses shared ClientFormDialog */}
      <ClientFormDialog
        externalOpen={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editClient={editClient}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["clients"] });
          setEditDialogOpen(false);
        }}
      />

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveClient} onOpenChange={(o) => !o && setArchiveClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiwizować klienta?</AlertDialogTitle>
            <AlertDialogDescription>
              Klient „{archiveClient?.display_name}" zostanie zarchiwizowany i ukryty z listy. Powiązane zlecenia i urządzenia pozostaną w systemie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveClient && archiveMutation.mutate(archiveClient.id)}>
              Archiwizuj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
