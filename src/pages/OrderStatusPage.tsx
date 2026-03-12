import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Search, Monitor, Calendar, FileText, DollarSign, CheckCircle, Clock, AlertTriangle, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { ORDER_STATUS_LABELS, DEVICE_CATEGORY_LABELS, type OrderStatus, type DeviceCategory } from "@/types/database";

import CustomerMessagesPublic from "@/components/CustomerMessagesPublic";

interface PublicOrderData {
  order_id: string;
  order_number: string;
  status: OrderStatus;
  received_at: string;
  problem_description: string | null;
  diagnosis: string | null;
  repair_description: string | null;
  total_gross: number | null;
  is_paid: boolean;
  estimated_completion_date: string | null;
  unread_messages: number;
  estimated_repair_cost_gross: number | null;
  repair_approval_status: string | null;
  repair_approval_at: string | null;
  repair_approval_note: string | null;
  device: { manufacturer: string; model: string; category: DeviceCategory } | null;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  DIAGNOSIS: "bg-yellow-100 text-yellow-800",
  DIAGNOSIS_QUOTE: "bg-yellow-100 text-yellow-800",
  TODO: "bg-cyan-100 text-cyan-800",
  IN_PROGRESS: "bg-orange-100 text-orange-800",
  WAITING: "bg-indigo-100 text-indigo-800",
  WAITING_CLIENT: "bg-purple-100 text-purple-800",
  READY_FOR_RETURN: "bg-green-100 text-green-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
  ARCHIVED: "bg-gray-100 text-gray-800",
};

export default function OrderStatusPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<PublicOrderData | null>(null);

  useEffect(() => {
    if (token) {
      fetchByToken(token);
    }
  }, [token]);

  async function fetchByToken(t: string) {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("order-status", {
        body: { token: t },
      });
      if (fnError || data?.error) throw new Error(data?.error || "Nie znaleziono zlecenia");
      setOrder(data);
    } catch (e: any) {
      setError(e.message || "Błąd");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim() || !phone.trim()) {
      setError("Podaj numer zlecenia i numer telefonu");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("order-status", {
        body: { order_number: orderNumber.trim(), phone: phone.trim() },
      });
      if (fnError || data?.error) throw new Error(data?.error || "Nie znaleziono zlecenia");
      setOrder(data);
    } catch (e: any) {
      setError(e.message || "Błąd");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background px-4 py-4">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <Wrench className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-lg font-bold">Sprawdź status zlecenia</h1>
            <p className="text-xs text-muted-foreground">Portal klienta serwisu</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 space-y-6">
        {!order && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" /> Wyszukaj zlecenie
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && !token ? (
                <p className="text-muted-foreground text-sm">Wyszukiwanie...</p>
              ) : token && loading ? (
                <p className="text-muted-foreground text-sm">Ładowanie zlecenia...</p>
              ) : (
                <form onSubmit={handleSearch} className="space-y-4">
                  <div>
                    <Label>Numer zlecenia</Label>
                    <Input
                      placeholder="np. SRV/2026/0012"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label>Numer telefonu</Label>
                    <Input
                      placeholder="np. 531167884"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      type="tel"
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4" /> {error}
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    <Search className="mr-2 h-4 w-4" /> Sprawdź status
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {order && (
          <OrderStatusView
            order={order}
            onBack={() => setOrder(null)}
            token={token}
            orderNumber={orderNumber}
            phone={phone}
            onOrderUpdated={(updated) => setOrder(updated)}
          />
        )}
      </main>
    </div>
  );
}

function OrderStatusView({ order, onBack, token, orderNumber, phone, onOrderUpdated }: {
  order: PublicOrderData;
  onBack: () => void;
  token?: string | null;
  orderNumber?: string;
  phone?: string;
  onOrderUpdated: (order: PublicOrderData) => void;
}) {
  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
  const statusColor = STATUS_COLORS[order.status] || "bg-muted text-foreground";

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Wyszukaj inne zlecenie
      </Button>

      {/* Status hero */}
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground font-mono">{order.order_number}</p>
          <Badge className={`text-sm px-4 py-1 ${statusColor}`}>{statusLabel}</Badge>
          {order.status === "READY_FOR_RETURN" && (
            <p className="text-sm text-green-700 font-medium flex items-center justify-center gap-1">
              <CheckCircle className="h-4 w-4" /> Urządzenie gotowe do odbioru!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Device */}
      {order.device && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Monitor className="h-4 w-4" /> Urządzenie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {order.device.manufacturer} {order.device.model}
            </p>
            <p className="text-xs text-muted-foreground">
              {DEVICE_CATEGORY_LABELS[order.device.category] || order.device.category}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dates */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Terminy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Data przyjęcia</span>
            <span>{new Date(order.received_at).toLocaleDateString("pl-PL")}</span>
          </div>
          {order.estimated_completion_date && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Planowane zakończenie</span>
              <span>{new Date(order.estimated_completion_date).toLocaleDateString("pl-PL")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Opis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {order.problem_description && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Zgłoszony problem</p>
              <p>{order.problem_description}</p>
            </div>
          )}
          {order.diagnosis && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Diagnostyka</p>
              <p>{order.diagnosis}</p>
            </div>
          )}
          {order.repair_description && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Opis naprawy</p>
              <p>{order.repair_description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repair Approval Section */}
      <RepairApprovalSection
        order={order}
        token={token}
        orderNumber={orderNumber}
        phone={phone}
        onOrderUpdated={onOrderUpdated}
      />

      {/* Cost */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Koszt i płatność
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {order.total_gross != null && order.total_gross > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Koszt brutto</span>
              <span className="font-medium">
                {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(order.total_gross)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status płatności</span>
            {order.is_paid ? (
              <Badge variant="outline" className="text-green-700 border-green-300">
                <CheckCircle className="mr-1 h-3 w-3" /> Opłacone
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-700 border-amber-300">
                <Clock className="mr-1 h-3 w-3" /> Do zapłaty
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customer messages */}
      <CustomerMessagesPublic
        token={token}
        orderNumber={orderNumber}
        phone={phone}
      />

      <p className="text-center text-xs text-muted-foreground pt-4">
        W razie pytań skontaktuj się z serwisem telefonicznie lub wyślij wiadomość powyżej.
      </p>
    </div>
  );
}

// ═══ REPAIR APPROVAL SECTION ═══
function RepairApprovalSection({ order, token, orderNumber, phone, onOrderUpdated }: {
  order: PublicOrderData;
  token?: string | null;
  orderNumber?: string;
  phone?: string;
  onOrderUpdated: (order: PublicOrderData) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const isWaiting = order.repair_approval_status === "WAITING_FOR_CUSTOMER";
  const isApproved = order.repair_approval_status === "APPROVED_BY_CUSTOMER";
  const isRejected = order.repair_approval_status === "REJECTED_BY_CUSTOMER";
  const hasDecision = isApproved || isRejected;

  // Don't show if no approval needed
  if (order.repair_approval_status === "NONE" || !order.repair_approval_status) {
    return null;
  }

  async function handleDecision(decision: "APPROVED_BY_CUSTOMER" | "REJECTED_BY_CUSTOMER") {
    setSubmitting(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("order-status", {
        body: {
          action: "repair_approval",
          token: token || undefined,
          order_number: orderNumber || undefined,
          phone: phone || undefined,
          decision,
          note: note.trim() || undefined,
        },
      });
      if (fnError || data?.error) throw new Error(data?.error || "Błąd");
      // Update local state
      onOrderUpdated({
        ...order,
        repair_approval_status: decision,
        repair_approval_at: new Date().toISOString(),
        repair_approval_note: note.trim() || null,
      });
    } catch (e: any) {
      setError(e.message || "Błąd zapisu decyzji");
    } finally {
      setSubmitting(false);
    }
  }

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);

  return (
    <Card className={isWaiting ? "border-amber-300 bg-amber-50/50" : isApproved ? "border-green-300 bg-green-50/50" : isRejected ? "border-red-300 bg-red-50/50" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {isWaiting && <AlertTriangle className="h-4 w-4 text-amber-600" />}
          {isApproved && <ThumbsUp className="h-4 w-4 text-green-600" />}
          {isRejected && <ThumbsDown className="h-4 w-4 text-red-600" />}
          Decyzja o naprawie
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show diagnosis if available */}
        {order.diagnosis && isWaiting && (
          <div className="text-sm">
            <p className="text-xs text-muted-foreground font-medium mb-1">Wynik diagnostyki</p>
            <p className="bg-background rounded-md p-2 border border-border">{order.diagnosis}</p>
          </div>
        )}

        {/* Show estimated cost */}
        {order.estimated_repair_cost_gross != null && order.estimated_repair_cost_gross > 0 && (
          <div className="text-sm">
            <p className="text-xs text-muted-foreground font-medium mb-1">Szacunkowy koszt naprawy</p>
            <p className="text-xl font-bold font-mono text-foreground">
              {formatCurrency(order.estimated_repair_cost_gross)}
            </p>
          </div>
        )}

        {/* Waiting: show action buttons */}
        {isWaiting && (
          <>
            <p className="text-sm text-amber-800 font-medium">
              Prosimy o potwierdzenie, czy akceptują Państwo koszt naprawy.
            </p>

            <div className="space-y-2">
              <Label className="text-xs">Uwagi (opcjonalnie)</Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Dodatkowe uwagi..."
                className="text-sm"
                maxLength={500}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" /> {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => handleDecision("APPROVED_BY_CUSTOMER")}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
                Akceptuję naprawę
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleDecision("REJECTED_BY_CUSTOMER")}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
                Odrzucam
              </Button>
            </div>
          </>
        )}

        {/* Decision made */}
        {hasDecision && (
          <div className="space-y-2">
            {isApproved && (
              <Badge className="bg-green-100 text-green-800 border-green-300">
                <ThumbsUp className="mr-1 h-3 w-3" /> Naprawa zaakceptowana
              </Badge>
            )}
            {isRejected && (
              <Badge className="bg-red-100 text-red-800 border-red-300">
                <ThumbsDown className="mr-1 h-3 w-3" /> Naprawa odrzucona
              </Badge>
            )}
            {order.repair_approval_at && (
              <p className="text-xs text-muted-foreground">
                Decyzja z dnia: {new Date(order.repair_approval_at).toLocaleString("pl-PL")}
              </p>
            )}
            {order.repair_approval_note && (
              <p className="text-sm text-muted-foreground">
                Uwagi: {order.repair_approval_note}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
