import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  KANBAN_COLUMNS,
  ORDER_PRIORITY_LABELS,
  DEPARTMENT_ICONS,
  DEPARTMENT_LABELS,
  type OrderStatus,
  type ServiceOrderWithRelations,
} from "@/types/database";
import { Monitor, Clock, AlertTriangle, Maximize, Minimize, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL = 12_000;

// Generate a soft notification beep using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);

    // Play a second gentle tone for a "bell" effect
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.05);
    gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc2.start(ctx.currentTime + 0.05);
    osc2.stop(ctx.currentTime + 0.6);
  } catch {
    // Web Audio not available — silent fallback
  }
}

export default function ServiceBoardDisplay() {
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  // Track known order IDs to detect new ones
  const knownOrderIdsRef = useRef<Set<string> | null>(null);
  const isFirstLoadRef = useRef(true);

  // Clock update
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Fullscreen tracking
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Clear highlight after 8 seconds
  useEffect(() => {
    if (newOrderIds.size === 0) return;
    const t = setTimeout(() => setNewOrderIds(new Set()), 8000);
    return () => clearTimeout(t);
  }, [newOrderIds]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  const handleNewOrders = useCallback(
    (orders: ServiceOrderWithRelations[]) => {
      const currentIds = new Set(orders.map((o) => o.id));

      if (isFirstLoadRef.current) {
        // First load — seed known IDs, don't alert
        knownOrderIdsRef.current = currentIds;
        isFirstLoadRef.current = false;
        return;
      }

      const known = knownOrderIdsRef.current ?? new Set<string>();
      const freshIds = new Set<string>();

      for (const order of orders) {
        if (!known.has(order.id) && order.status === "NEW") {
          freshIds.add(order.id);
        }
      }

      if (freshIds.size > 0) {
        setNewOrderIds(freshIds);
        if (soundEnabled) {
          playNotificationSound();
        }
      }

      knownOrderIdsRef.current = currentIds;
    },
    [soundEnabled],
  );

  const { data: orders = [] } = useQuery({
    queryKey: ["board-display-orders", deptFilter],
    queryFn: async () => {
      let query = supabase
        .from("service_orders")
        .select("*, clients(display_name, phone), devices(manufacturer, model)")
        .not("status", "in", '("ARCHIVED","CANCELLED")')
        .order("received_at", { ascending: false });

      if (deptFilter !== "all") {
        query = query.eq("service_type", deptFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      const result = (data ?? []) as unknown as ServiceOrderWithRelations[];
      handleNewOrders(result);
      return result;
    },
    refetchInterval: REFRESH_INTERVAL,
  });

  // Fetch technician assignments for all orders
  const orderIds = orders.map((o) => o.id);
  const { data: techData = [] } = useQuery({
    queryKey: ["board-display-techs", orderIds],
    queryFn: async () => {
      if (!orderIds.length) return [];
      const { data: rows } = await supabase
        .from("order_technicians")
        .select("order_id, user_id, is_primary")
        .in("order_id", orderIds);
      if (!rows?.length) return [];

      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);

      const pMap: Record<string, string> = {};
      profiles?.forEach((p) => {
        pMap[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "—";
      });

      return rows.map((r) => ({
        order_id: r.order_id,
        name: pMap[r.user_id] || "—",
        is_primary: r.is_primary,
      }));
    },
    enabled: orderIds.length > 0,
    refetchInterval: REFRESH_INTERVAL,
  });

  const getTechs = (orderId: string) =>
    techData.filter((t) => t.order_id === orderId);

  const getColumnOrders = (status: OrderStatus) =>
    orders.filter((o) => o.status === status);

  const priorityColors: Record<string, string> = {
    LOW: "border-l-blue-400",
    NORMAL: "border-l-emerald-400",
    HIGH: "border-l-amber-400",
    URGENT: "border-l-red-500",
  };

  const deptOptions = [
    { value: "all", label: "Wszystkie", icon: "📋" },
    { value: "PHONE_SERVICE", label: "Serwis telefonów", icon: "📱" },
    { value: "COMPUTER_SERVICE", label: "Serwis komputerów", icon: "💻" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">
            🔧 Tablica serwisu
          </h1>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {deptOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDeptFilter(opt.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  deptFilter === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="mr-1">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              soundEnabled
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
            )}
            title={soundEnabled ? "Dźwięk powiadomień: WŁĄCZONY" : "Dźwięk powiadomień: WYŁĄCZONY"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {soundEnabled ? "Dźwięk: WŁ" : "Dźwięk: WYŁ"}
            </span>
          </button>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <span className="text-lg font-mono tabular-nums">
              {now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            {orders.length} zleceń
          </span>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Kanban columns */}
      <div className="flex-1 flex gap-3 p-4 overflow-x-auto">
        {KANBAN_COLUMNS.map((col) => {
          const colOrders = getColumnOrders(col.status);
          return (
            <div
              key={col.status}
              className="flex-1 min-w-[220px] flex flex-col bg-card rounded-xl border border-border overflow-hidden"
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${col.color}`} />
                  <span className="text-base font-semibold">{col.label}</span>
                </div>
                <span className="text-sm font-bold bg-muted text-muted-foreground rounded-full px-2.5 py-0.5">
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {colOrders.map((order) => {
                  const techs = getTechs(order.id);
                  const device = (order as any).devices;
                  const isNew = newOrderIds.has(order.id);

                  return (
                    <div
                      key={order.id}
                      className={cn(
                        "rounded-lg bg-background border border-border p-3.5 border-l-4 shadow-sm transition-all duration-500",
                        priorityColors[order.priority] || "border-l-transparent",
                        isNew && "ring-2 ring-primary animate-pulse",
                      )}
                    >
                      {/* Order number + priority + NEW badge */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-mono font-bold text-primary">
                            {order.order_number}
                          </span>
                          {isNew && (
                            <span className="text-[10px] font-bold uppercase bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                              Nowe!
                            </span>
                          )}
                        </div>
                        {order.priority === "URGENT" && (
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                        )}
                        {order.priority === "HIGH" && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>

                      {/* Device */}
                      {device && (
                        <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
                          <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {device.manufacturer} {device.model}
                          </span>
                        </div>
                      )}

                      {/* Description */}
                      {order.problem_description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {order.problem_description}
                        </p>
                      )}

                      {/* Technician */}
                      {techs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-auto">
                          {techs.map((t, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${
                                t.is_primary
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Department icon */}
                      {deptFilter === "all" && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {DEPARTMENT_ICONS[order.service_type]} {DEPARTMENT_LABELS[order.service_type] ?? ""}
                        </div>
                      )}
                    </div>
                  );
                })}

                {colOrders.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                    Brak zleceń
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
