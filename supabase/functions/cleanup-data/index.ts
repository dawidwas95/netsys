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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user is admin
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const userId = claimsData.claims.sub;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!roles?.some((r: any) => r.role === "ADMIN")) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const KEEP = 10;
    const progress: string[] = [];

    // Helper: batch delete using service role (bypasses RLS)
    async function batchDelete(table: string, condition: string, batchSize = 1000) {
      let total = 0;
      while (true) {
        const { data } = await supabase.rpc("get_table_columns", { p_table: "profiles" });
        // Use raw SQL via rest - actually we need to use postgrest
        // Let's use a different approach: delete via supabase client with filters
        break;
      }
      return total;
    }

    // 1. Documents: keep 10 newest
    progress.push("Czyszczenie dokumentów...");

    // Get IDs to keep
    const { data: docsToKeep } = await supabase
      .from("documents")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(KEEP);
    const keepDocIds = (docsToKeep ?? []).map((d: any) => d.id);

    if (keepDocIds.length > 0) {
      // Delete document_items for docs not kept
      // We need to get all doc IDs NOT in keepDocIds and delete their items
      // Since we can't do NOT IN easily, let's get all doc IDs first
      let offset = 0;
      const allDocIds: string[] = [];
      while (true) {
        const { data: batch } = await supabase
          .from("documents")
          .select("id")
          .range(offset, offset + 999);
        if (!batch?.length) break;
        allDocIds.push(...batch.map((d: any) => d.id));
        offset += 1000;
      }
      const deleteDocIds = allDocIds.filter((id) => !keepDocIds.includes(id));

      // Delete in chunks of 200
      for (let i = 0; i < deleteDocIds.length; i += 200) {
        const chunk = deleteDocIds.slice(i, i + 200);
        await supabase.from("document_items").delete().in("document_id", chunk);
        await supabase.from("document_attachments").delete().in("document_id", chunk);
      }
      // Now delete documents themselves
      for (let i = 0; i < deleteDocIds.length; i += 200) {
        const chunk = deleteDocIds.slice(i, i + 200);
        // Clear self-references first
        await supabase.from("documents").update({ related_document_id: null } as any).in("id", chunk);
        await supabase.from("documents").delete().in("id", chunk);
      }
      progress.push(`Dokumenty: usunięto ${deleteDocIds.length}, zostało ${keepDocIds.length}`);
    }

    // 2. Devices: keep 10 newest (clear FK refs first)
    const { data: devicesToKeep } = await supabase
      .from("devices")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(KEEP);
    const keepDeviceIds = (devicesToKeep ?? []).map((d: any) => d.id);

    let devOffset = 0;
    const allDeviceIds: string[] = [];
    while (true) {
      const { data: batch } = await supabase
        .from("devices")
        .select("id")
        .range(devOffset, devOffset + 999);
      if (!batch?.length) break;
      allDeviceIds.push(...batch.map((d: any) => d.id));
      devOffset += 1000;
    }
    const deleteDeviceIds = allDeviceIds.filter((id) => !keepDeviceIds.includes(id));

    // Clear device references from orders and it_work_entries
    for (let i = 0; i < deleteDeviceIds.length; i += 200) {
      const chunk = deleteDeviceIds.slice(i, i + 200);
      await supabase.from("service_orders").update({ device_id: null } as any).in("device_id", chunk);
      await supabase.from("it_work_entries").update({ device_id: null } as any).in("device_id", chunk);
      await supabase.from("devices").delete().in("id", chunk);
    }
    progress.push(`Urządzenia: usunięto ${deleteDeviceIds.length}, zostało ${keepDeviceIds.length}`);

    // 3. Clients: keep 10 newest that are referenced by kept orders + a few extras
    // First get client IDs used by remaining orders
    const { data: orderClients } = await supabase
      .from("service_orders")
      .select("client_id")
      .not("client_id", "is", null);
    const usedClientIds = new Set((orderClients ?? []).map((o: any) => o.client_id));

    // Also keep 10 newest regardless
    const { data: clientsToKeep } = await supabase
      .from("clients")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(KEEP);
    const keepClientIds = new Set([
      ...(clientsToKeep ?? []).map((c: any) => c.id),
      ...usedClientIds,
    ]);

    let cliOffset = 0;
    const allClientIds: string[] = [];
    while (true) {
      const { data: batch } = await supabase
        .from("clients")
        .select("id")
        .range(cliOffset, cliOffset + 999);
      if (!batch?.length) break;
      allClientIds.push(...batch.map((c: any) => c.id));
      cliOffset += 1000;
    }
    const deleteClientIds = allClientIds.filter((id) => !keepClientIds.has(id));

    // Clear client references
    for (let i = 0; i < deleteClientIds.length; i += 200) {
      const chunk = deleteClientIds.slice(i, i + 200);
      await supabase.from("client_contacts").delete().in("client_id", chunk);
      await supabase.from("client_it_documents").delete().in("client_id", chunk);
      await supabase.from("offers").update({ deleted_at: new Date().toISOString() } as any).in("client_id", chunk);
      await supabase.from("it_work_entries").update({ client_id: null } as any).in("client_id", chunk);
      await supabase.from("billing_batches").delete().in("client_id", chunk);
      await supabase.from("notification_log").update({ client_id: null } as any).in("client_id", chunk);
      await supabase.from("clients").delete().in("id", chunk);
    }
    progress.push(`Klienci: usunięto ${deleteClientIds.length}, zostało ${keepClientIds.size}`);

    // 4. Cash transactions: keep 10 newest
    const { data: cashToKeep } = await supabase
      .from("cash_transactions")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(KEEP);
    const keepCashIds = (cashToKeep ?? []).map((c: any) => c.id);

    let cashOffset = 0;
    const allCashIds: string[] = [];
    while (true) {
      const { data: batch } = await supabase
        .from("cash_transactions")
        .select("id")
        .range(cashOffset, cashOffset + 999);
      if (!batch?.length) break;
      allCashIds.push(...batch.map((c: any) => c.id));
      cashOffset += 1000;
    }
    const deleteCashIds = allCashIds.filter((id) => !keepCashIds.includes(id));
    for (let i = 0; i < deleteCashIds.length; i += 200) {
      const chunk = deleteCashIds.slice(i, i + 200);
      await supabase.from("cash_transactions").delete().in("id", chunk);
    }
    progress.push(`Kasa: usunięto ${deleteCashIds.length}, zostało ${keepCashIds.length}`);

    // 5. Inventory: keep 10 newest
    const { data: invToKeep } = await supabase
      .from("inventory_items")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(KEEP);
    const keepInvIds = (invToKeep ?? []).map((i: any) => i.id);

    let invOffset = 0;
    const allInvIds: string[] = [];
    while (true) {
      const { data: batch } = await supabase
        .from("inventory_items")
        .select("id")
        .range(invOffset, invOffset + 999);
      if (!batch?.length) break;
      allInvIds.push(...batch.map((i: any) => i.id));
      invOffset += 1000;
    }
    const deleteInvIds = allInvIds.filter((id) => !keepInvIds.includes(id));
    for (let i = 0; i < deleteInvIds.length; i += 200) {
      const chunk = deleteInvIds.slice(i, i + 200);
      await supabase.from("inventory_movements").delete().in("item_id", chunk);
      await supabase.from("inventory_reservations").delete().in("inventory_item_id", chunk);
      await supabase.from("document_items").update({ inventory_item_id: null } as any).in("inventory_item_id", chunk);
      await supabase.from("inventory_items").delete().in("id", chunk);
    }
    progress.push(`Magazyn: usunięto ${deleteInvIds.length}, zostało ${keepInvIds.length}`);

    // 6. Warehouse documents: keep 10
    const { data: whToKeep } = await supabase
      .from("warehouse_documents")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(KEEP);
    const keepWhIds = (whToKeep ?? []).map((w: any) => w.id);

    let whOffset = 0;
    const allWhIds: string[] = [];
    while (true) {
      const { data: batch } = await supabase
        .from("warehouse_documents")
        .select("id")
        .range(whOffset, whOffset + 999);
      if (!batch?.length) break;
      allWhIds.push(...batch.map((w: any) => w.id));
      whOffset += 1000;
    }
    const deleteWhIds = allWhIds.filter((id) => !keepWhIds.includes(id));
    for (let i = 0; i < deleteWhIds.length; i += 200) {
      const chunk = deleteWhIds.slice(i, i + 200);
      await supabase.from("warehouse_document_items").delete().in("document_id", chunk);
      await supabase.from("warehouse_documents").delete().in("id", chunk);
    }
    progress.push(`Dok. magazynowe: usunięto ${deleteWhIds.length}, zostało ${keepWhIds.length}`);

    // 7. Offers: keep 10
    const { data: offToKeep } = await supabase
      .from("offers")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(KEEP);
    const keepOffIds = (offToKeep ?? []).map((o: any) => o.id);

    let offOffset = 0;
    const allOffIds: string[] = [];
    while (true) {
      const { data: batch } = await supabase
        .from("offers")
        .select("id")
        .range(offOffset, offOffset + 999);
      if (!batch?.length) break;
      allOffIds.push(...batch.map((o: any) => o.id));
      offOffset += 1000;
    }
    const deleteOffIds = allOffIds.filter((id) => !keepOffIds.includes(id));
    for (let i = 0; i < deleteOffIds.length; i += 200) {
      const chunk = deleteOffIds.slice(i, i + 200);
      await supabase.from("offer_items").delete().in("offer_id", chunk);
      await supabase.from("documents").update({ related_offer_id: null } as any).in("related_offer_id", chunk);
      await supabase.from("offers").delete().in("id", chunk);
    }
    progress.push(`Oferty: usunięto ${deleteOffIds.length}, zostało ${keepOffIds.length}`);

    // 8. Activity logs: keep 50 newest
    const { data: logsToKeep } = await supabase
      .from("activity_logs")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(50);
    const keepLogIds = (logsToKeep ?? []).map((l: any) => l.id);

    let logOffset = 0;
    const allLogIds: string[] = [];
    while (true) {
      const { data: batch } = await supabase
        .from("activity_logs")
        .select("id")
        .range(logOffset, logOffset + 999);
      if (!batch?.length) break;
      allLogIds.push(...batch.map((l: any) => l.id));
      logOffset += 1000;
    }
    const deleteLogIds = allLogIds.filter((id) => !keepLogIds.includes(id));
    for (let i = 0; i < deleteLogIds.length; i += 500) {
      const chunk = deleteLogIds.slice(i, i + 500);
      await supabase.from("activity_logs").delete().in("id", chunk);
    }
    progress.push(`Logi: usunięto ${deleteLogIds.length}, zostało ${keepLogIds.length}`);

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
