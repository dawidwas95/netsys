import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ScheduleOrderDialogProps {
  orderId: string;
  orderNumber: string;
  currentDate?: string | null;
  currentTime?: string | null;
  /** Trigger element — if not provided, renders default button */
  trigger?: React.ReactNode;
  /** Compact mode for list views */
  compact?: boolean;
}

export function ScheduleOrderDialog({
  orderId,
  orderNumber,
  currentDate,
  currentTime,
  trigger,
  compact,
}: ScheduleOrderDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [techId, setTechId] = useState<string>("__keep__");

  const isScheduled = !!currentDate;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDate(currentDate ?? format(new Date(), "yyyy-MM-dd"));
      setTime(currentTime?.slice(0, 5) ?? "");
      setTechId("__keep__");
    }
  }, [open, currentDate, currentTime]);

  const { data: staffUsers = [] } = useQuery({
    queryKey: ["staff-for-schedule"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .eq("is_active", true);
      return (data ?? []).map((p: any) => ({
        id: p.user_id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Użytkownik",
      }));
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Get current technician assignments
  const { data: currentTechs = [] } = useQuery({
    queryKey: ["order-techs-schedule", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_technicians")
        .select("user_id, is_primary")
        .eq("order_id", orderId);
      return data ?? [];
    },
    enabled: open,
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      // Update order scheduling fields
      const updates: Record<string, any> = {
        planned_execution_date: date || null,
        planned_execution_time: time || null,
        updated_by: user?.id,
      };
      const { error } = await supabase
        .from("service_orders")
        .update(updates)
        .eq("id", orderId);
      if (error) throw error;

      // Assign technician if selected
      if (techId && techId !== "__keep__") {
        await supabase.from("order_technicians").upsert(
          { order_id: orderId, user_id: techId, is_primary: true, assigned_by: user?.id } as any,
          { onConflict: "order_id,user_id", ignoreDuplicates: true }
        );
        await supabase.from("activity_logs").insert({
          entity_type: "service_order",
          entity_id: orderId,
          action_type: "TECHNICIAN_ASSIGNED",
          entity_name: orderNumber,
          description: "Technik przypisany z planowania dnia",
          user_id: user?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["daily-plan-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      setOpen(false);
      toast.success(date ? "Zlecenie zaplanowane" : "Usunięto z planu");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removePlan = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("service_orders")
        .update({ planned_execution_date: null, planned_execution_time: null, updated_by: user?.id })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["daily-plan-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      setOpen(false);
      toast.success("Usunięto z planu dnia");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const primaryTech = currentTechs.find((t: any) => t.is_primary);

  const defaultTrigger = compact ? (
    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
      <CalendarDays className="h-3.5 w-3.5" />
      {isScheduled ? "Zmień plan" : "Zaplanuj"}
    </Button>
  ) : (
    <Button variant="outline" size="sm" className="gap-1.5">
      <CalendarDays className="h-4 w-4" />
      {isScheduled ? "Zmień plan dnia" : "Dodaj do planu dnia"}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {isScheduled ? "Edytuj plan" : "Dodaj do planu dnia"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="text-sm text-muted-foreground">
            Zlecenie: <span className="font-mono font-medium text-foreground">{orderNumber}</span>
          </div>

          {/* Technician */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Technik</Label>
            {primaryTech && (
              <p className="text-xs text-muted-foreground mb-1">
                Aktualny: {staffUsers.find((u) => u.id === primaryTech.user_id)?.name ?? "—"}
              </p>
            )}
            <Select value={techId} onValueChange={setTechId}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Wybierz technika" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__keep__">
                  {primaryTech ? "Bez zmian" : "— nie przypisuj —"}
                </SelectItem>
                {staffUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Data realizacji</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-[44px]"
            />
          </div>

          {/* Time */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Godzina (opcjonalnie)</Label>
            <div className="flex gap-2">
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="min-h-[44px] flex-1"
              />
              {time && (
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setTime("")}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Quick date buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant={date === format(new Date(), "yyyy-MM-dd") ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}
            >
              Dziś
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setDate(format(tomorrow, "yyyy-MM-dd"));
              }}
            >
              Jutro
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                const d = new Date();
                // Next Monday
                d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
                setDate(format(d, "yyyy-MM-dd"));
              }}
            >
              Pon.
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-between pt-2">
            {isScheduled && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => removePlan.mutate()}
                disabled={removePlan.isPending}
              >
                Usuń z planu
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
              <Button
                onClick={() => savePlan.mutate()}
                disabled={!date || savePlan.isPending}
              >
                {savePlan.isPending ? "Zapisywanie..." : "Zapisz plan"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Badge showing the current schedule state of an order */
export function ScheduleBadgeWithAction({
  orderId,
  orderNumber,
  date,
  time,
}: {
  orderId: string;
  orderNumber: string;
  date?: string | null;
  time?: string | null;
}) {
  if (!date) {
    return (
      <ScheduleOrderDialog
        orderId={orderId}
        orderNumber={orderNumber}
        currentDate={date}
        currentTime={time}
        compact
        trigger={
          <button className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
            <CalendarDays className="h-3 w-3" />
            Zaplanuj
          </button>
        }
      />
    );
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const isToday = date === today;
  const isPast = date < today;

  return (
    <ScheduleOrderDialog
      orderId={orderId}
      orderNumber={orderNumber}
      currentDate={date}
      currentTime={time}
      compact
      trigger={
        <button className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
          isPast
            ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
            : isToday
              ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
              : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
        }`}>
          📅 {isToday ? (time ? time.slice(0, 5) : "Dziś") : new Date(date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
          {time && !isToday && ` ${time.slice(0, 5)}`}
        </button>
      }
    />
  );
}
