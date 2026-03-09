import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  ScanLine, Plus, ListTodo, Package, MessageSquare, Search,
  KanbanSquare, Wrench, ClipboardList,
} from "lucide-react";
import { useState } from "react";
import { QRScanner } from "@/components/QRScanner";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { resolveOrderRouteFromScan } from "@/lib/qrScanRouting";

export default function MobileHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: myOrderCount = 0 } = useQuery({
    queryKey: ["my-order-count", user?.id],
    queryFn: async () => {
      const { data: techRows } = await supabase
        .from("order_technicians")
        .select("order_id")
        .eq("user_id", user!.id);
      if (!techRows?.length) return 0;
      const { count } = await supabase
        .from("service_orders")
        .select("id", { count: "exact", head: true })
        .in("id", techRows.map((r: any) => r.order_id))
        .not("status", "in", '("COMPLETED","ARCHIVED","CANCELLED")');
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["unread-customer-messages"],
    queryFn: async () => {
      const { count } = await supabase
        .from("customer_messages")
        .select("id", { count: "exact", head: true })
        .eq("is_read_by_staff", false)
        .eq("sender_type", "customer");
      return count ?? 0;
    },
  });

  const firstName = profile?.first_name || "Technik";

  const handleScan = async (value: string) => {
    const cleaned = value.trim();
    setScannerOpen(false);

    const directOrderRoute = await resolveOrderRouteFromScan(cleaned);
    if (directOrderRoute) {
      navigate(directOrderRoute);
      return;
    }

    // Try inventory
    const { data: invItem } = await supabase
      .from("inventory_items")
      .select("id")
      .or(`sku.eq.${cleaned},inventory_number.eq.${cleaned}`)
      .maybeSingle();
    if (invItem) {
      navigate(`/inventory`);
      return;
    }

    navigate(`/orders?search=${encodeURIComponent(cleaned)}`);
  };

  const actions = [
    {
      label: "Skanuj QR",
      icon: ScanLine,
      color: "bg-primary text-primary-foreground",
      onClick: () => setScannerOpen(true),
    },
    {
      label: "Moje zlecenia",
      icon: ClipboardList,
      color: "bg-primary/10 text-primary",
      href: "/my-orders",
      badge: myOrderCount > 0 ? myOrderCount : undefined,
    },
    {
      label: "Nowe zlecenie",
      icon: Plus,
      color: "bg-primary/10 text-primary",
      href: "/orders",
    },
    {
      label: "Szukaj",
      icon: Search,
      color: "bg-muted text-foreground",
      href: "/orders",
    },
    {
      label: "Tablica",
      icon: KanbanSquare,
      color: "bg-muted text-foreground",
      href: "/orders/kanban",
    },
    {
      label: "Magazyn",
      icon: Package,
      color: "bg-muted text-foreground",
      href: "/inventory",
    },
    {
      label: "Wiadomości",
      icon: MessageSquare,
      color: "bg-muted text-foreground",
      href: "/orders",
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    },
    {
      label: "Wszystkie zlecenia",
      icon: ListTodo,
      color: "bg-muted text-foreground",
      href: "/orders",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cześć, {firstName}!</h1>
        <p className="text-muted-foreground text-sm">Co chcesz zrobić?</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const content = (
            <div
              key={action.label}
              className={`relative rounded-xl p-5 flex flex-col items-center justify-center gap-2 min-h-[110px] active:scale-95 transition-transform ${action.color}`}
              onClick={action.onClick}
            >
              <action.icon className="h-7 w-7" />
              <span className="text-sm font-medium text-center">{action.label}</span>
              {action.badge && (
                <Badge variant="destructive" className="absolute top-2 right-2 min-w-[22px] h-[22px] flex items-center justify-center text-xs">
                  {action.badge}
                </Badge>
              )}
            </div>
          );

          if (action.href) {
            return (
              <Link key={action.label} to={action.href}>
                {content}
              </Link>
            );
          }
          return <div key={action.label} className="cursor-pointer">{content}</div>;
        })}
      </div>

      {/* Quick stats */}
      <div className="bg-card rounded-xl border p-4 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Podsumowanie</h2>
        <div className="flex justify-between text-sm">
          <span>Moje aktywne zlecenia</span>
          <span className="font-bold text-primary">{myOrderCount}</span>
        </div>
        {unreadMessages > 0 && (
          <div className="flex justify-between text-sm">
            <span>Nieprzeczytane wiadomości</span>
            <span className="font-bold text-destructive">{unreadMessages}</span>
          </div>
        )}
      </div>

      {scannerOpen && (
        <QRScanner
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          onScan={handleScan}
        />
      )}
    </div>
  );
}
