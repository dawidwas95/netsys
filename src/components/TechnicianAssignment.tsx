import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Check, Plus, Star, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Shared helper: fetch technicians for an order with profile names (no FK join needed)
async function fetchOrderTechnicians(orderId: string) {
  const { data: rows } = await supabase
    .from("order_technicians")
    .select("id, user_id, is_primary")
    .eq("order_id", orderId);

  if (!rows?.length) return [];

  const userIds = rows.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, first_name, last_name, email")
    .in("user_id", userIds);

  const profileMap: Record<string, { first_name: string | null; last_name: string | null; email: string | null }> = {};
  (profiles ?? []).forEach((p) => { profileMap[p.user_id] = p; });

  return rows.map((t) => {
    const p = profileMap[t.user_id];
    return {
      id: t.id,
      userId: t.user_id,
      isPrimary: Boolean(t.is_primary),
      name: p ? ([p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Użytkownik") : "Użytkownik",
    };
  });
}

interface TechnicianAvatarProps {
  name: string;
  isPrimary?: boolean;
  size?: "sm" | "md";
}

export function TechnicianAvatar({ name, isPrimary, size = "md" }: TechnicianAvatarProps) {
  const safeName = (name || "?").trim();
  const initials = safeName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const sizeClasses = size === "sm" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-xs";

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold shrink-0",
        sizeClasses,
        isPrimary
          ? "bg-primary/20 text-primary ring-1 ring-primary/40"
          : "bg-muted text-muted-foreground"
      )}
      title={`${name}${isPrimary ? " (główny)" : ""}`}
    >
      {initials}
    </div>
  );
}

interface TechnicianBadgesProps {
  orderId: string;
  compact?: boolean;
}

export function TechnicianBadges({ orderId, compact }: TechnicianBadgesProps) {
  const { data: techs = [] } = useQuery({
    queryKey: ["order-technicians", orderId],
    queryFn: () => fetchOrderTechnicians(orderId),
  });

  if (!techs.length) {
    return compact
      ? <span className="text-xs text-muted-foreground">Nieprzypisany</span>
      : <span className="text-xs text-muted-foreground">Nieprzypisany</span>;
  }

  const sorted = [...techs].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <TechnicianAvatar key={sorted[0].userId} name={sorted[0].name} isPrimary={sorted[0].isPrimary} size="sm" />
        <span className="text-xs truncate max-w-[120px]">{sorted[0].name}</span>
        {sorted.length > 1 && (
          <span className="text-[10px] text-muted-foreground">+{sorted.length - 1}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((t) => (
        <Badge key={t.userId} variant="outline" className={cn("text-xs gap-1", t.isPrimary && "border-primary/40 bg-primary/5")}>
          {t.isPrimary && <Star className="h-3 w-3 text-primary fill-primary" />}
          {t.name}
        </Badge>
      ))}
    </div>
  );
}

interface TechnicianAssignmentProps {
  orderId: string;
  orderNumber?: string;
}

export function TechnicianAssignment({ orderId, orderNumber }: TechnicianAssignmentProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: allUsers = [] } = useQuery({
    queryKey: ["assignable-staff-users"],
    queryFn: async () => {
      // Get users with ADMIN, KIEROWNIK, or SERWISANT roles (all can be assigned)
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["ADMIN", "KIEROWNIK", "SERWISANT"]);
      
      const assignableIds = (roleData ?? []).map((r: any) => r.user_id);
      if (!assignableIds.length) return [];

      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .eq("is_active", true)
        .in("user_id", assignableIds);
      
      return (data ?? []).map((p: any) => ({
        id: p.user_id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Użytkownik",
      }));
    },
  });

  const { data: assigned = [] } = useQuery({
    queryKey: ["order-technicians", orderId],
    queryFn: () => fetchOrderTechnicians(orderId),
  });

  const assignedIds = new Set(assigned.map((a: any) => a.userId));

  const assignTech = useMutation({
    mutationFn: async (userId: string) => {
      console.info("[TechnicianAssignment] assign start", { orderId, userId });
      if (assignedIds.has(userId)) {
        throw new Error("Technik jest już przypisany do tego zlecenia");
      }

      const isPrimary = assigned.length === 0;
      const { error } = await supabase.from("order_technicians").upsert({
        order_id: orderId,
        user_id: userId,
        is_primary: isPrimary,
        assigned_by: user?.id,
      } as any, { onConflict: "order_id,user_id", ignoreDuplicates: true });

      if (error) {
        console.error("[TechnicianAssignment] assign db error", { orderId, userId, error });
        throw error;
      }

      const techName = allUsers.find((u) => u.id === userId)?.name ?? "?";
      await supabase.from("activity_logs").insert({
        entity_type: "service_order",
        entity_id: orderId,
        action_type: "TECHNICIAN_ASSIGNED",
        entity_name: orderNumber ?? "",
        description: `Przypisano technika: ${techName}${isPrimary ? " (główny)" : ""}`,
        user_id: user?.id,
        new_value_json: { technician_id: userId, technician_name: techName, is_primary: isPrimary } as any,
      });

      console.info("[TechnicianAssignment] assign success", { orderId, userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-technicians", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-technician-ids", orderId] });
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-logs", orderId] });
      toast.success("Technik przypisany");
    },
    onError: (err: any) => {
      console.error("[TechnicianAssignment] assign failed", { orderId, error: err });
      toast.error(err?.message || "Błąd przypisywania technika");
    },
  });

  const removeTech = useMutation({
    mutationFn: async ({ rowId, userId, name }: { rowId: string; userId: string; name: string }) => {
      const { error } = await supabase.from("order_technicians").delete().eq("id", rowId);
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        entity_type: "service_order",
        entity_id: orderId,
        action_type: "TECHNICIAN_REMOVED",
        entity_name: orderNumber ?? "",
        description: `Usunięto technika: ${name}`,
        user_id: user?.id,
        old_value_json: { technician_id: userId, technician_name: name } as any,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-technicians", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-technician-ids", orderId] });
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-logs", orderId] });
      toast.success("Technik usunięty");
    },
    onError: (err: any) => toast.error(err?.message || "Błąd usuwania technika"),
  });

  const setPrimary = useMutation({
    mutationFn: async ({ rowId, userId, name }: { rowId: string; userId: string; name: string }) => {
      const { error: unsetError } = await supabase.from("order_technicians").update({ is_primary: false } as any).eq("order_id", orderId);
      if (unsetError) throw unsetError;

      const { error } = await supabase.from("order_technicians").update({ is_primary: true } as any).eq("id", rowId);
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        entity_type: "service_order",
        entity_id: orderId,
        action_type: "PRIMARY_TECHNICIAN_CHANGED",
        entity_name: orderNumber ?? "",
        description: `Zmieniono głównego technika na: ${name}`,
        user_id: user?.id,
        new_value_json: { technician_id: userId, technician_name: name } as any,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-technicians", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-technician-ids", orderId] });
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-logs", orderId] });
      toast.success("Główny technik zmieniony");
    },
    onError: (err: any) => toast.error(err?.message || "Błąd zmiany głównego technika"),
  });

  const sorted = [...assigned].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Przypisani technicy</label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <UserPlus className="h-3 w-3 mr-1" /> Przypisz
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-56" align="end">
            <Command>
              <CommandInput placeholder="Szukaj użytkownika..." />
              <CommandList>
                <CommandEmpty>Nie znaleziono</CommandEmpty>
                <CommandGroup>
                  {allUsers.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={u.name}
                      onSelect={() => {
                        if (assignedIds.has(u.id)) {
                          toast.error("Technik jest już przypisany do tego zlecenia");
                          setOpen(false);
                          return;
                        }
                        assignTech.mutate(u.id);
                        setOpen(false);
                      }}
                      disabled={assignedIds.has(u.id)}
                    >
                      <Check className={cn("mr-2 h-4 w-4", assignedIds.has(u.id) ? "opacity-100" : "opacity-0")} />
                      {u.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">Brak przypisanych techników</p>
      ) : (
        <div className="space-y-1">
          {sorted.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-sm p-1.5 rounded-md border border-border bg-card">
              <TechnicianAvatar name={t.name} isPrimary={t.isPrimary} />
              <span className="flex-1 truncate text-xs">{t.name}</span>
              {!t.isPrimary && (
                <Button
                  variant="ghost" size="icon" className="h-5 w-5"
                  title="Ustaw jako głównego"
                  onClick={() => setPrimary.mutate({ rowId: t.id, userId: t.userId, name: t.name })}
                >
                  <Star className="h-3 w-3" />
                </Button>
              )}
              {t.isPrimary && <Star className="h-3 w-3 text-primary fill-primary" />}
              <Button
                variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"
                onClick={() => removeTech.mutate({ rowId: t.id, userId: t.userId, name: t.name })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline quick-assign button for lists/kanban — with remove support
export function QuickAssignButton({ orderId, orderNumber }: { orderId: string; orderNumber?: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: allUsers = [] } = useQuery({
    queryKey: ["assignable-staff-users"],
    queryFn: async () => {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["ADMIN", "KIEROWNIK", "SERWISANT"]);
      
      const assignableIds = (roleData ?? []).map((r: any) => r.user_id);
      if (!assignableIds.length) return [];

      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .eq("is_active", true)
        .in("user_id", assignableIds);
      
      return (data ?? []).map((p: any) => ({
        id: p.user_id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Użytkownik",
      }));
    },
  });

  const { data: assigned = [] } = useQuery({
    queryKey: ["order-technicians", orderId],
    queryFn: () => fetchOrderTechnicians(orderId),
  });

  const assignedIds = new Set(assigned.map((a) => a.userId));

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["order-technicians", orderId] });
    queryClient.invalidateQueries({ queryKey: ["order-technician-ids", orderId] });
    queryClient.invalidateQueries({ queryKey: ["service-orders"] });
    queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
  };

  const assignTech = useMutation({
    mutationFn: async (userId: string) => {
      if (assignedIds.has(userId)) {
        throw new Error("Technik jest już przypisany do tego zlecenia");
      }
      const isPrimary = assigned.length === 0;
      const { error } = await supabase.from("order_technicians").upsert({
        order_id: orderId,
        user_id: userId,
        is_primary: isPrimary,
        assigned_by: user?.id,
      } as any, { onConflict: "order_id,user_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Technik przypisany"); setOpen(false); },
    onError: (err: any) => toast.error(err?.message || "Błąd przypisywania technika"),
  });

  const removeTech = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("order_technicians").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Technik usunięty"); },
    onError: (err: any) => toast.error(err?.message || "Błąd usuwania technika"),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6" title="Zarządzaj technikami" onClick={(e) => e.stopPropagation()}>
          <UserPlus className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="end" onClick={(e) => e.stopPropagation()}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Szukaj..." />
          <CommandList>
            {assigned.length > 0 && (
              <CommandGroup heading="Przypisani — kliknij aby usunąć">
                {assigned.map((t) => (
                  <CommandItem
                    key={`rm-${t.id}`}
                    value={`remove-${t.name}`}
                    onSelect={() => removeTech.mutate(t.id)}
                  >
                    <X className="mr-2 h-3 w-3 text-destructive" />
                    <span className="text-xs flex-1">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground">Usuń</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Przypisz">
              {allUsers.filter((u) => !assignedIds.has(u.id)).length === 0 && (
                <CommandItem disabled>Wszyscy przypisani</CommandItem>
              )}
              {allUsers.filter((u) => !assignedIds.has(u.id)).map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.name}
                  onSelect={() => assignTech.mutate(u.id)}
                >
                  <Plus className="mr-2 h-3 w-3" />
                  <span className="text-xs">{u.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
