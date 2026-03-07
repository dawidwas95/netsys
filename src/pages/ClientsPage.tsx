import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { CLIENT_TYPE_LABELS, type Client, type ClientInsert, type ClientType } from "@/types/database";
import { Link } from "react-router-dom";

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", search],
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select("*")
        .eq("is_active", true)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (search) {
        query = query.or(
          `display_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,nip.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createClient = useMutation({
    mutationFn: async (data: ClientInsert) => {
      const { error } = await supabase.from("clients").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDialogOpen(false);
      toast.success("Klient dodany");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Klienci</h1>
          <p className="text-muted-foreground text-sm">{clients?.length ?? 0} klientów</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Dodaj klienta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nowy klient</DialogTitle>
            </DialogHeader>
            <ClientForm
              onSubmit={(data) => createClient.mutate({ ...data, created_by: user?.id })}
              loading={createClient.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj po nazwie, telefonie, NIP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="data-table-wrapper">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Miasto</TableHead>
              <TableHead>NIP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Ładowanie...</TableCell>
              </TableRow>
            ) : !clients?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Brak klientów</TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50">
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ClientForm({ onSubmit, loading }: { onSubmit: (data: ClientInsert) => void; loading: boolean }) {
  const [clientType, setClientType] = useState<ClientType>("PRIVATE");
  const [formData, setFormData] = useState<Partial<ClientInsert>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, client_type: clientType } as ClientInsert);
  };

  const set = (field: keyof ClientInsert, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Typ klienta</Label>
        <Select value={clientType} onValueChange={(v) => setClientType(v as ClientType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PRIVATE">Osoba prywatna</SelectItem>
            <SelectItem value="COMPANY">Firma</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {clientType === "COMPANY" && (
        <>
          <div className="space-y-1.5">
            <Label>Nazwa firmy *</Label>
            <Input required onChange={(e) => set("company_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>NIP</Label>
              <Input onChange={(e) => set("nip", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>REGON</Label>
              <Input onChange={(e) => set("regon", e.target.value)} />
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{clientType === "COMPANY" ? "Imię kontaktowe" : "Imię *"}</Label>
          <Input required={clientType === "PRIVATE"} onChange={(e) => set("first_name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{clientType === "COMPANY" ? "Nazwisko kontaktowe" : "Nazwisko *"}</Label>
          <Input required={clientType === "PRIVATE"} onChange={(e) => set("last_name", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Telefon</Label>
          <Input onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input type="email" onChange={(e) => set("email", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Ulica</Label>
          <Input onChange={(e) => set("address_street", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Kod pocztowy</Label>
          <Input onChange={(e) => set("address_postal_code", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Miasto</Label>
          <Input onChange={(e) => set("address_city", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Uwagi</Label>
        <Textarea rows={2} onChange={(e) => set("notes", e.target.value)} />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Zapisywanie..." : "Zapisz klienta"}
      </Button>
    </form>
  );
}
