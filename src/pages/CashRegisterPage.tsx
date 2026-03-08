import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, ArrowDownToLine, ArrowUpFromLine, Wallet, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { format } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  IN: "Wpływ", OUT: "Wypływ", RESET: "Reset",
};
const SOURCE_LABELS: Record<string, string> = {
  SERVICE_ORDER: "Zlecenie serwisowe", MANUAL: "Ręczny", WITHDRAWAL: "Wypłata", CORRECTION: "Korekta",
};

export default function CashRegisterPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [revertTx, setRevertTx] = useState<any | null>(null);
  const [filterDate, setFilterDate] = useState("");

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["cash_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_transactions")
        .select("*, service_orders(order_number)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      // Use gross_amount if available, fallback to amount
      return (data ?? []).map((t: any) => ({
        ...t,
        display_amount: t.gross_amount && t.gross_amount > 0 ? t.gross_amount : t.amount,
      }));
    },
  });

  const filtered = useMemo(() => {
    if (!filterDate) return transactions;
    return transactions.filter((t: any) => t.transaction_date === filterDate);
  }, [transactions, filterDate]);

  const balance = useMemo(() => {
    return transactions.reduce((sum: number, t: any) => {
      const amt = t.display_amount || Number(t.amount);
      if (t.transaction_type === "IN") return sum + amt;
      if (t.transaction_type === "OUT") return sum - amt;
      return 0; // RESET
    }, 0);
  }, [transactions]);

  const todayIn = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return transactions
      .filter((t: any) => t.transaction_date === today && t.transaction_type === "IN")
      .reduce((sum: number, t: any) => sum + (t.display_amount || Number(t.amount)), 0);
  }, [transactions]);

  const todayOut = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return transactions
      .filter((t: any) => t.transaction_date === today && t.transaction_type === "OUT")
      .reduce((sum: number, t: any) => sum + (t.display_amount || Number(t.amount)), 0);
  }, [transactions]);

  const { data: myRoles = [] } = useQuery({
    queryKey: ["my-roles-cash"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user?.id);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const canCorrectCash = myRoles.some((r: any) => r.role === "ADMIN" || r.role === "MANAGER");

  const addTransaction = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("cash_transactions").insert({
        ...data,
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      setAddOpen(false);
      setWithdrawOpen(false);
      toast.success("Zapisano operację kasową");
    },
    onError: () => toast.error("Błąd zapisu operacji"),
  });

  const reverseTransaction = useMutation({
    mutationFn: async (tx: any) => {
      const amount = Number(tx.display_amount || tx.gross_amount || tx.amount || 0);
      if (amount <= 0) throw new Error("Nieprawidłowa kwota do korekty");
      const { error } = await supabase.from("cash_transactions").insert({
        transaction_type: tx.transaction_type === "IN" ? "OUT" : "IN",
        source_type: "CORRECTION",
        related_order_id: tx.related_order_id ?? null,
        amount,
        gross_amount: amount,
        vat_amount: 0,
        payment_method: tx.payment_method ?? "CASH",
        description: `Korekta wpisu kasowego ${tx.id}`,
        transaction_date: new Date().toISOString().split("T")[0],
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      toast.success("Dodano korektę wpisu kasowego");
      setRevertTx(null);
    },
    onError: (err: any) => toast.error(err?.message || "Błąd korekty kasowej"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kasa gotówkowa</h1>
          <p className="text-sm text-muted-foreground">Rejestr wpływów i wypływów gotówki</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowUpFromLine className="mr-2 h-4 w-4" />Wypłata z kasy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Wypłata z kasy</DialogTitle></DialogHeader>
              <CashForm
                type="OUT"
                sourceType="WITHDRAWAL"
                onSubmit={(d) => addTransaction.mutate(d)}
                loading={addTransaction.isPending}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Dodaj wpis</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nowa operacja kasowa</DialogTitle></DialogHeader>
              <CashForm
                type="IN"
                sourceType="MANUAL"
                onSubmit={(d) => addTransaction.mutate(d)}
                loading={addTransaction.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Wallet className="h-3.5 w-3.5" /> Stan kasy
            </div>
            <div className={`text-2xl font-bold tabular-nums ${balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {balance.toFixed(2)} zł
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Wpływy dziś
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-400">+{todayIn.toFixed(2)} zł</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingDown className="h-3.5 w-3.5" /> Wypływy dziś
            </div>
            <div className="text-2xl font-bold tabular-nums text-red-400">-{todayOut.toFixed(2)} zł</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground mb-1">Operacji łącznie</div>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Filtruj po dacie</Label>
          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-[200px]" />
        </div>
        {filterDate && (
          <Button variant="ghost" size="sm" onClick={() => setFilterDate("")}>Wyczyść filtr</Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Źródło</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead>Zlecenie</TableHead>
                <TableHead className="text-right">Kwota</TableHead>
                <TableHead className="w-[110px] text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Ładowanie...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Brak operacji</TableCell></TableRow>
              ) : (
                filtered.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{format(new Date(t.transaction_date), "dd.MM.yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        t.transaction_type === "IN"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : t.transaction_type === "OUT"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      }>
                        {t.transaction_type === "IN" ? <ArrowDownToLine className="h-3 w-3 mr-1" /> : <ArrowUpFromLine className="h-3 w-3 mr-1" />}
                        {TYPE_LABELS[t.transaction_type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{SOURCE_LABELS[t.source_type] || t.source_type}</TableCell>
                    <TableCell className="text-sm max-w-[250px] truncate">{t.description || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {t.service_orders?.order_number || "—"}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${t.transaction_type === "IN" ? "text-emerald-400" : "text-red-400"}`}>
                      {t.transaction_type === "IN" ? "+" : "-"}{Number(t.display_amount || t.amount).toFixed(2)} zł
                    </TableCell>
                    <TableCell className="text-right">
                      {canCorrectCash && t.source_type !== "CORRECTION" && (
                        <Button variant="outline" size="sm" onClick={() => setRevertTx(t)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Korekta
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!revertTx} onOpenChange={(open) => { if (!open) setRevertTx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cofnąć wpis kasowy?</AlertDialogTitle>
            <AlertDialogDescription>
              Zamiast usuwania zostanie dodana transakcja korygująca o przeciwnej wartości. To zachowuje pełną historię kasy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => revertTx && reverseTransaction.mutate(revertTx)}>
              {reverseTransaction.isPending ? "Korygowanie..." : "Dodaj korektę"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CashForm({ type, sourceType, onSubmit, loading }: {
  type: "IN" | "OUT";
  sourceType: string;
  onSubmit: (d: any) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [source, setSource] = useState(sourceType);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Kwota (zł) *</Label>
        <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <div className="space-y-1">
        <Label>Typ operacji</Label>
        <Select value={type === "OUT" ? "OUT" : source === "WITHDRAWAL" ? "OUT" : "IN"} disabled>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="IN">Wpływ</SelectItem>
            <SelectItem value="OUT">Wypływ</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Źródło</Label>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MANUAL">Ręczny</SelectItem>
            <SelectItem value="WITHDRAWAL">Wypłata</SelectItem>
            <SelectItem value="CORRECTION">Korekta</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Data operacji</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Opis</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="np. Wpłata od klienta" />
      </div>
      <Button className="w-full" disabled={loading || !amount} onClick={() => {
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) { toast.error("Podaj prawidłową kwotę"); return; }
        onSubmit({
          transaction_type: type === "OUT" || source === "WITHDRAWAL" ? "OUT" : "IN",
          source_type: source,
          amount: amt,
          description: description || null,
          transaction_date: date,
        });
      }}>
        {loading ? "Zapisywanie..." : type === "OUT" ? "Wypłać z kasy" : "Dodaj wpis"}
      </Button>
    </div>
  );
}
