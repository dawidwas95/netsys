import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---- GET MESSAGES ----
    if (action === "get_messages") {
      const { token, order_number, phone } = body;
      const orderId = await resolveOrderId(supabase, { token, order_number, phone });
      if (!orderId) {
        return jsonResponse({ error: "Nie znaleziono zlecenia" }, 404);
      }

      const { data: messages } = await supabase
        .from("customer_messages")
        .select("id, sender_type, sender_name, message, created_at, is_read_by_client")
        .eq("service_order_id", orderId)
        .order("created_at", { ascending: true });

      // Mark staff messages as read by client
      await supabase
        .from("customer_messages")
        .update({ is_read_by_client: true })
        .eq("service_order_id", orderId)
        .eq("sender_type", "STAFF")
        .eq("is_read_by_client", false);

      return jsonResponse({ messages: messages ?? [] });
    }

    // ---- SEND MESSAGE (from customer) ----
    if (action === "send_message") {
      const { token, order_number, phone, message, sender_name } = body;
      if (!message?.trim()) {
        return jsonResponse({ error: "Wiadomość nie może być pusta" }, 400);
      }
      if (message.trim().length > 2000) {
        return jsonResponse({ error: "Wiadomość zbyt długa (max 2000 znaków)" }, 400);
      }

      const orderId = await resolveOrderId(supabase, { token, order_number, phone });
      if (!orderId) {
        return jsonResponse({ error: "Nie znaleziono zlecenia" }, 404);
      }

      const { error } = await supabase.from("customer_messages").insert({
        service_order_id: orderId,
        sender_type: "CLIENT",
        sender_name: (sender_name?.trim() || "Klient").substring(0, 100),
        message: message.trim(),
        is_read_by_staff: false,
        is_read_by_client: true,
      });

      if (error) {
        return jsonResponse({ error: "Błąd zapisu wiadomości" }, 500);
      }

      return jsonResponse({ success: true });
    }

    // ---- DEFAULT: GET ORDER STATUS ----
    const { order_number, phone, token } = body;

    let query = supabase
      .from("service_orders")
      .select(`
        id, order_number, status, received_at, problem_description, diagnosis,
        repair_description, total_gross, is_paid, estimated_completion_date,
        pickup_code, status_token,
        clients(display_name, phone),
        devices(manufacturer, model, device_category)
      `)
      .is("deleted_at", null);

    if (token) {
      query = query.eq("status_token", token).limit(1).single();
    } else if (order_number && phone) {
      query = query.eq("order_number", order_number.trim().toUpperCase()).limit(1).single();
    } else {
      return jsonResponse({ error: "Podaj numer zlecenia i numer telefonu" }, 400);
    }

    const { data, error } = await query;

    if (error || !data) {
      return jsonResponse({ error: "Nie znaleziono zlecenia" }, 404);
    }

    // Phone verification for manual access
    if (!token && phone) {
      const clientPhone = (data.clients as any)?.phone?.replace(/\s+/g, "") || "";
      const inputPhone = phone.replace(/\s+/g, "");
      if (!clientPhone || !clientPhone.includes(inputPhone.slice(-9))) {
        return jsonResponse({ error: "Numer telefonu nie pasuje do zlecenia" }, 403);
      }
    }

    // Count unread messages from staff for customer badge
    const { count: unreadCount } = await supabase
      .from("customer_messages")
      .select("id", { count: "exact", head: true })
      .eq("service_order_id", data.id)
      .eq("sender_type", "STAFF")
      .eq("is_read_by_client", false);

    const result = {
      order_id: data.id,
      order_number: data.order_number,
      status: data.status,
      received_at: data.received_at,
      problem_description: data.problem_description,
      diagnosis: data.diagnosis,
      repair_description: data.repair_description,
      total_gross: data.total_gross,
      is_paid: data.is_paid,
      estimated_completion_date: data.estimated_completion_date,
      unread_messages: unreadCount ?? 0,
      device: data.devices ? {
        manufacturer: (data.devices as any).manufacturer,
        model: (data.devices as any).model,
        category: (data.devices as any).device_category,
      } : null,
    };

    return jsonResponse(result);
  } catch (e) {
    return jsonResponse({ error: "Błąd serwera" }, 500);
  }
});

async function resolveOrderId(
  supabase: any,
  { token, order_number, phone }: { token?: string; order_number?: string; phone?: string }
): Promise<string | null> {
  let query = supabase
    .from("service_orders")
    .select("id, clients(phone)")
    .is("deleted_at", null);

  if (token) {
    query = query.eq("status_token", token).limit(1).single();
  } else if (order_number && phone) {
    query = query.eq("order_number", order_number.trim().toUpperCase()).limit(1).single();
  } else {
    return null;
  }

  const { data, error } = await query;
  if (error || !data) return null;

  // Phone verification for manual access
  if (!token && phone) {
    const clientPhone = (data.clients as any)?.phone?.replace(/\s+/g, "") || "";
    const inputPhone = phone.replace(/\s+/g, "");
    if (!clientPhone || !clientPhone.includes(inputPhone.slice(-9))) {
      return null;
    }
  }

  return data.id;
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
