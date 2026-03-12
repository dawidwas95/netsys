import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const progress: string[] = [];

    // Helper: delete all rows from a table in batches
    async function deleteAll(table: string) {
      let total = 0;
      while (true) {
        const { data } = await supabase
          .from(table)
          .select("id")
          .limit(1000);
        if (!data?.length) break;
        const ids = data.map((r: any) => r.id);
        await supabase.from(table).delete().in("id", ids);
        total += ids.length;
      }
      return total;
    }

    // Helper: nullify FK column then delete
    async function nullifyFK(table: string, column: string) {
      while (true) {
        const { data } = await supabase
          .from(table)
          .select("id")
          .not(column, "is", null)
          .limit(500);
        if (!data?.length) break;
        const ids = data.map((r: any) => r.id);
        await supabase.from(table).update({ [column]: null } as any).in("id", ids);
      }
    }

    // 1. Child/junction tables first (no FK deps)
    const childTables = [
      "comment_reads",
      "billing_batch_items",
      "it_work_comments",
      "network_devices",
      "offer_items",
      "document_items",
      "document_attachments",
      "warehouse_document_items",
      "service_order_photos",
      "service_order_items",
      "service_order_comments",
      "order_technicians",
      "customer_messages",
      "inventory_movements",
      "inventory_reservations",
      "purchase_requests",
      "notification_log",
      "notifications",
      "cash_transactions",
    ];

    for (const t of childTables) {
      const n = await deleteAll(t);
      if (n > 0) progress.push(`${t}: usunięto ${n}`);
    }

    // 2. Nullify self-references and cross-references
    await nullifyFK("documents", "related_document_id");
    await nullifyFK("documents", "related_offer_id");
    await nullifyFK("documents", "related_order_id");
    await nullifyFK("documents", "client_id");
    await nullifyFK("it_work_entries", "device_id");
    await nullifyFK("it_work_entries", "billing_batch_id");
    await nullifyFK("service_orders", "device_id");
    await nullifyFK("service_orders", "client_id");

    // 3. Mid-level tables
    const midTables = [
      "billing_batches",
      "warehouse_documents",
      "offers",
      "documents",
      "it_work_entries",
      "service_orders",
      "inventory_items",
      "devices",
      "client_contacts",
      "client_it_documents",
      "clients",
      "activity_logs",
    ];

    for (const t of midTables) {
      const n = await deleteAll(t);
      if (n > 0) progress.push(`${t}: usunięto ${n}`);
    }

    if (progress.length === 0) {
      progress.push("Baza już jest pusta!");
    }

    return new Response(JSON.stringify({ success: true, progress }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
