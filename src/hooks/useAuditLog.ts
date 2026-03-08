import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "PAYMENT"
  | "INVENTORY_IN"
  | "INVENTORY_OUT"
  | "COMMENT"
  | "ARCHIVE"
  | "CANCEL"
  | "CORRECTION";

export type AuditEntityType =
  | "service_order"
  | "document"
  | "document_item"
  | "inventory_item"
  | "inventory_movement"
  | "cash_transaction"
  | "it_work_entry"
  | "client"
  | "device"
  | "offer"
  | "comment";

interface AuditLogEntry {
  action_type: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export function useAuditLog() {
  const { user } = useAuth();

  const log = useCallback(
    async (entry: AuditLogEntry) => {
      try {
        // Fetch user profile name
        let userName = user?.email || "System";
        if (user?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, email")
            .eq("user_id", user.id)
            .single();
          if (profile) {
            userName =
              [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
              profile.email ||
              userName;
          }
        }

        await supabase.from("activity_logs").insert({
          user_id: user?.id || null,
          action_type: entry.action_type,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          // @ts-ignore - new columns added via migration
          user_name: userName,
          entity_name: entry.entity_name || null,
          description: entry.description || null,
          metadata: entry.metadata || null,
        });
      } catch (err) {
        console.error("Audit log error:", err);
      }
    },
    [user]
  );

  return { log };
}
