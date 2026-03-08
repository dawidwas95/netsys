import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";

export type SystemEventType =
  | "SERVICE_ORDER_CREATED"
  | "SERVICE_ORDER_UPDATED"
  | "SERVICE_ORDER_COMPLETED"
  | "SERVICE_ORDER_CANCELLED"
  | "SERVICE_ORDER_DELETED"
  | "CASH_INCOME"
  | "CASH_EXPENSE"
  | "CASH_CORRECTION"
  | "INVENTORY_IN"
  | "INVENTORY_OUT"
  | "DOCUMENT_CREATED"
  | "DOCUMENT_UPDATED"
  | "DOCUMENT_DELETED"
  | "CLIENT_CREATED"
  | "CLIENT_DELETED"
  | "COMMENT_ADDED";

interface EventPayload {
  event_type: SystemEventType;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  payload?: Record<string, any>;
}

export function useSystemEvent() {
  const { user } = useAuth();

  const emit = useCallback(
    async (event: EventPayload) => {
      try {
        await supabase.from("system_events" as any).insert({
          event_type: event.event_type,
          entity_type: event.entity_type,
          entity_id: event.entity_id,
          entity_name: event.entity_name || null,
          payload: event.payload || null,
          user_id: user?.id || null,
          processed: false,
        });
      } catch (err) {
        console.error("System event error:", err);
      }
    },
    [user]
  );

  return { emit };
}
