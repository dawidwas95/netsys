import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "ADMIN" | "MANAGER" | "TECHNICIAN" | "OFFICE" | "EMPLOYEE";

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
      return (data?.role as AppRole) ?? "EMPLOYEE";
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";
  const isTechnician = role === "TECHNICIAN";
  const isOffice = role === "OFFICE";

  // Permission helpers
  const canManageUsers = isAdmin;
  const canAccessSettings = isAdmin;
  const canAccessFinance = isAdmin || isManager || isOffice;
  const canAccessSystemLogs = isAdmin;
  const canAccessDataManagement = isAdmin;

  return {
    role,
    isLoading,
    isAdmin,
    isManager,
    isTechnician,
    isOffice,
    canManageUsers,
    canAccessSettings,
    canAccessFinance,
    canAccessSystemLogs,
    canAccessDataManagement,
  };
}
