import { supabase } from "@/integrations/supabase/client";

interface NotifyParams {
  orderId: string;
  orderNumber: string;
  clientId: string;
  clientEmail?: string | null;
  clientName?: string | null;
  deviceName?: string;
  eventType: "READY_FOR_RETURN";
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function sendOrderNotification(params: NotifyParams) {
  const { orderId, orderNumber, clientId, clientEmail, clientName, deviceName, eventType } = params;

  // Fetch active email template
  const { data: templates } = await supabase
    .from("notification_templates")
    .select("*")
    .eq("event_type", eventType)
    .eq("channel", "EMAIL")
    .eq("is_active", true)
    .limit(1);

  const template = templates?.[0];
  if (!template || !clientEmail) {
    // No active template or no email — log as skipped
    if (clientEmail && !template) {
      console.warn(`No active template for ${eventType}`);
    }
    return;
  }

  const vars: Record<string, string> = {
    order_number: orderNumber,
    device_name: deviceName ?? "—",
    client_name: clientName ?? "Klient",
  };

  const subject = interpolate(template.subject, vars);
  const body = interpolate(template.body_template, vars);

  // Log the notification first
  const { data: logEntry } = await supabase
    .from("notification_log")
    .insert({
      order_id: orderId,
      client_id: clientId,
      channel: "EMAIL",
      recipient: clientEmail,
      subject,
      body,
      status: "PENDING",
    })
    .select("id")
    .single();

  try {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: { to: clientEmail, subject, body, orderId, clientId },
    });

    if (error) throw error;

    if (data?.success) {
      if (logEntry?.id) {
        await supabase
          .from("notification_log")
          .update({ status: "SENT", sent_at: new Date().toISOString() })
          .eq("id", logEntry.id);
      }
      return { success: true };
    } else {
      throw new Error(data?.error || "Unknown error");
    }
  } catch (err: any) {
    if (logEntry?.id) {
      await supabase
        .from("notification_log")
        .update({ status: "FAILED", error_message: err.message })
        .eq("id", logEntry.id);
    }
    console.error("Notification send error:", err);
    return { success: false, error: err.message };
  }
}
