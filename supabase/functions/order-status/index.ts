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
    const { order_number, phone, token } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase
      .from("service_orders")
      .select(`
        order_number, status, received_at, problem_description, diagnosis,
        repair_description, total_gross, is_paid, estimated_completion_date,
        pickup_code, status_token,
        clients(display_name, phone),
        devices(manufacturer, model, device_category)
      `)
      .is("deleted_at", null);

    if (token) {
      // QR access - direct via token
      query = query.eq("status_token", token).limit(1).single();
    } else if (order_number && phone) {
      // Manual access - verify phone
      query = query.eq("order_number", order_number.trim().toUpperCase()).limit(1).single();
    } else {
      return new Response(
        JSON.stringify({ error: "Podaj numer zlecenia i numer telefonu" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await query;

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Nie znaleziono zlecenia" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Phone verification for manual access
    if (!token && phone) {
      const clientPhone = (data.clients as any)?.phone?.replace(/\s+/g, "") || "";
      const inputPhone = phone.replace(/\s+/g, "");
      if (!clientPhone || !clientPhone.includes(inputPhone.slice(-9))) {
        return new Response(
          JSON.stringify({ error: "Numer telefonu nie pasuje do zlecenia" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Return only safe public fields
    const result = {
      order_number: data.order_number,
      status: data.status,
      received_at: data.received_at,
      problem_description: data.problem_description,
      diagnosis: data.diagnosis,
      repair_description: data.repair_description,
      total_gross: data.total_gross,
      is_paid: data.is_paid,
      estimated_completion_date: data.estimated_completion_date,
      device: data.devices ? {
        manufacturer: (data.devices as any).manufacturer,
        model: (data.devices as any).model,
        category: (data.devices as any).device_category,
      } : null,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Błąd serwera" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
