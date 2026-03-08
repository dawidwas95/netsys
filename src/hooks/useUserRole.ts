import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "ADMIN" | "KIEROWNIK" | "SERWISANT";

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrator",
  KIEROWNIK: "Kierownik",
  SERWISANT: "Serwisant",
};

export function useUserRole() {
  const { user } = useAuth();

  const { data: role, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data?.role as AppRole) ?? "SERWISANT";
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = role === "ADMIN";
  const isKierownik = role === "KIEROWNIK";
  const isSerwisant = role === "SERWISANT";

  // Legacy aliases for backward compat in components
  const isManager = isKierownik;
  const isTechnician = isSerwisant;

  // Permission helpers
  const canManageUsers = isAdmin;
  const canAccessSettings = isAdmin;
  const canAccessFinance = isAdmin || isKierownik;
  const canAccessSystemLogs = isAdmin;
  const canAccessDataManagement = isAdmin;
  const canAccessDocuments = isAdmin || isKierownik;
  const canAccessOffers = isAdmin || isKierownik;
  const canAccessITWork = isAdmin || isKierownik;
  const canAccessITDocs = isAdmin || isKierownik || isSerwisant;

  return {
    role,
    isLoading,
    isAdmin,
    isKierownik,
    isSerwisant,
    // Legacy aliases
    isManager,
    isTechnician,
    // Permissions
    canManageUsers,
    canAccessSettings,
    canAccessFinance,
    canAccessSystemLogs,
    canAccessDataManagement,
    canAccessDocuments,
    canAccessOffers,
    canAccessITWork,
    canAccessITDocs,
  };
}
