import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Monitor, Wrench, ScanLine } from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { QRScanner } from "@/components/QRScanner";
import { useIsMobile } from "@/hooks/use-mobile";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: "client" | "device" | "order";
  url: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const pattern = `%${q}%`;

    const [clientsRes, devicesRes, ordersRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, display_name, phone, email, nip, company_name")
        .eq("is_archived", false)
        .or(`display_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},nip.ilike.${pattern},company_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`)
        .limit(8),
      supabase
        .from("devices")
        .select("id, manufacturer, model, serial_number, imei, client_id, clients(display_name)")
        .eq("is_archived", false)
        .or(`manufacturer.ilike.${pattern},model.ilike.${pattern},serial_number.ilike.${pattern},imei.ilike.${pattern}`)
        .limit(8),
      supabase
        .from("service_orders")
        .select("id, order_number, problem_description, clients(display_name), devices(manufacturer, model, serial_number, imei)")
        .or(`order_number.ilike.${pattern},problem_description.ilike.${pattern}`)
        .limit(8),
    ]);

    const mapped: SearchResult[] = [];

    clientsRes.data?.forEach((c: any) =>
      mapped.push({
        id: c.id,
        title: c.display_name || "—",
        subtitle: [c.phone, c.email, c.nip].filter(Boolean).join(" · "),
        type: "client",
        url: `/clients/${c.id}`,
      })
    );

    devicesRes.data?.forEach((d: any) =>
      mapped.push({
        id: d.id,
        title: [d.manufacturer, d.model].filter(Boolean).join(" ") || "Urządzenie",
        subtitle: [d.serial_number && `S/N: ${d.serial_number}`, d.imei && `IMEI: ${d.imei}`, (d as any).clients?.display_name].filter(Boolean).join(" · "),
        type: "device",
        url: `/devices`,
      })
    );

    // Also search orders by device fields (serial, imei, model) and client name
    // We already fetched orders - now also search devices that match and find their orders
    if (q.length >= 2) {
      const { data: deviceOrderHits } = await supabase
        .from("service_orders")
        .select("id, order_number, status, clients(display_name), devices!inner(manufacturer, model, serial_number, imei)")
        .or(`manufacturer.ilike.${pattern},model.ilike.${pattern},serial_number.ilike.${pattern},imei.ilike.${pattern}`, { referencedTable: "devices" })
        .limit(8);

      const existingIds = new Set(ordersRes.data?.map((o: any) => o.id) ?? []);
      deviceOrderHits?.forEach((o: any) => {
        if (!existingIds.has(o.id)) {
          ordersRes.data?.push(o);
          existingIds.add(o.id);
        }
      });

      // Search orders by client name
      const { data: clientOrderHits } = await supabase
        .from("service_orders")
        .select("id, order_number, status, clients!inner(display_name), devices(manufacturer, model)")
        .ilike("clients.display_name", pattern)
        .limit(8);

      clientOrderHits?.forEach((o: any) => {
        if (!existingIds.has(o.id)) {
          ordersRes.data?.push(o);
          existingIds.add(o.id);
        }
      });
    }

    ordersRes.data?.forEach((o: any) => {
      const device = o.devices ? `${o.devices.manufacturer ?? ""} ${o.devices.model ?? ""}`.trim() : "";
      mapped.push({
        id: o.id,
        title: o.order_number,
        subtitle: [o.clients?.display_name, device].filter(Boolean).join(" · "),
        type: "order",
        url: `/orders/${o.id}`,
      });
    });

    setResults(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (url: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate(url);
  };

  const handleScan = useCallback(async (scannedValue: string) => {
    // Try to extract meaningful value from QR URL (e.g. /status?token=xxx or /orders/uuid)
    let searchValue = scannedValue;
    try {
      const url = new URL(scannedValue);
      const token = url.searchParams.get("token");
      if (token) {
        // It's a status QR - find order by status_token
        const { data } = await supabase
          .from("service_orders")
          .select("id")
          .eq("status_token", token)
          .maybeSingle();
        if (data) {
          navigate(`/orders/${data.id}`);
          return;
        }
      }
      // Check if path contains an order/inventory UUID
      const pathParts = url.pathname.split("/").filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart) searchValue = lastPart;
    } catch {
      // Not a URL, use raw value
    }

    // Try exact match: order_number
    const { data: orderMatch } = await supabase
      .from("service_orders")
      .select("id")
      .eq("order_number", searchValue.toUpperCase())
      .maybeSingle();
    if (orderMatch) {
      navigate(`/orders/${orderMatch.id}`);
      return;
    }

    // Try exact match: inventory SKU or inventory_number
    const { data: invMatch } = await supabase
      .from("inventory_items")
      .select("id")
      .or(`sku.eq.${searchValue},inventory_number.eq.${searchValue}`)
      .eq("is_archived", false)
      .maybeSingle();
    if (invMatch) {
      navigate(`/inventory`);
      return;
    }

    // Try exact match: device serial_number or imei
    const { data: devMatch } = await supabase
      .from("devices")
      .select("id")
      .or(`serial_number.eq.${searchValue},imei.eq.${searchValue},asset_tag.eq.${searchValue}`)
      .eq("is_archived", false)
      .maybeSingle();
    if (devMatch) {
      navigate(`/devices`);
      return;
    }

    // No exact match - open search with scanned value
    setQuery(searchValue);
    setOpen(true);
  }, [navigate]);

  const iconMap = {
    client: Users,
    device: Monitor,
    order: Wrench,
  };

  const labelMap = {
    client: "Klient",
    device: "Urządzenie",
    order: "Zlecenie",
  };

  const clients = results.filter((r) => r.type === "client");
  const devices = results.filter((r) => r.type === "device");
  const orders = results.filter((r) => r.type === "order");

  return (
    <>
      <div className="flex items-center gap-2 flex-1 max-w-lg">
        <button
          onClick={() => setOpen(true)}
          className="relative flex items-center gap-2 w-full h-9 rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">Szukaj klientów, zleceń, urządzeń...</span>
          <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
        <button
          onClick={() => setScannerOpen(true)}
          className="flex items-center justify-center h-9 w-9 shrink-0 rounded-md border border-input bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Skanuj kod QR / kreskowy"
        >
          <ScanLine className="h-4 w-4" />
        </button>
      </div>

      <QRScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Szukaj po nazwie, telefonie, S/N, IMEI, NIP..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Wyszukiwanie...</div>
          ) : query.length < 2 ? (
            <CommandEmpty>Wpisz co najmniej 2 znaki, aby wyszukać</CommandEmpty>
          ) : results.length === 0 ? (
            <CommandEmpty>Nie znaleziono wyników dla „{query}"</CommandEmpty>
          ) : (
            <>
              {clients.length > 0 && (
                <CommandGroup heading="Klienci">
                  {clients.map((r) => (
                    <CommandItem key={r.id} value={`client-${r.id}`} onSelect={() => handleSelect(r.url)}>
                      <Users className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{r.title}</span>
                        {r.subtitle && <span className="text-xs text-muted-foreground truncate">{r.subtitle}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {devices.length > 0 && (
                <>
                  {clients.length > 0 && <CommandSeparator />}
                  <CommandGroup heading="Urządzenia">
                    {devices.map((r) => (
                      <CommandItem key={r.id} value={`device-${r.id}`} onSelect={() => handleSelect(r.url)}>
                        <Monitor className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{r.title}</span>
                          {r.subtitle && <span className="text-xs text-muted-foreground truncate">{r.subtitle}</span>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
              {orders.length > 0 && (
                <>
                  {(clients.length > 0 || devices.length > 0) && <CommandSeparator />}
                  <CommandGroup heading="Zlecenia serwisowe">
                    {orders.map((r) => (
                      <CommandItem key={r.id} value={`order-${r.id}`} onSelect={() => handleSelect(r.url)}>
                        <Wrench className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium font-mono">{r.title}</span>
                          {r.subtitle && <span className="text-xs text-muted-foreground truncate">{r.subtitle}</span>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
