import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TABLES = [
  "clients",
  "client_contacts",
  "service_orders",
  "service_order_items",
  "service_order_comments",
  "order_technicians",
  "documents",
  "document_items",
  "document_attachments",
  "inventory_items",
  "inventory_movements",
  "inventory_reservations",
  "inventory_categories",
  "cash_transactions",
  "it_work_entries",
  "it_work_comments",
  "devices",
  "offers",
  "offer_items",
  "purchase_requests",
  "purchase_categories",
  "customer_messages",
  "notification_templates",
  "notification_log",
  "notifications",
  "company_settings",
  "pdf_templates",
  "profiles",
  "user_roles",
  "activity_logs",
  "billing_batches",
  "billing_batch_items",
  "client_it_documents",
  "network_devices",
  "warehouse_documents",
  "service_categories",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user is authenticated and is ADMIN
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "ADMIN")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: ADMIN role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tables: requestedTables } = await req.json().catch(() => ({ tables: null }));
    const tablesToExport = requestedTables?.length
      ? (requestedTables as string[]).filter((t: string) => ALLOWED_TABLES.includes(t))
      : ALLOWED_TABLES;

    let sql = `-- Full SQL Dump\n-- Generated: ${new Date().toISOString()}\n-- Tables: ${tablesToExport.length}\n\n`;

    for (const tableName of tablesToExport) {
      // Get column info from information_schema
      const { data: columns, error: colErr } = await adminClient.rpc("", {}).maybeSingle();
      // Use raw SQL via admin client
      const { data: colData } = await adminClient
        .from("information_schema.columns" as any)
        .select("*")
        .eq("table_schema", "public")
        .eq("table_name", tableName);

      // Fallback: query columns via pg catalog
      let columnDefs: { column_name: string; data_type: string; is_nullable: string; column_default: string | null }[] = [];

      // Use direct SQL query
      const { data: schemaRows } = await adminClient.rpc("get_table_schema" as any, { p_table: tableName }).catch(() => ({ data: null }));

      if (!schemaRows) {
        // Fallback: just get data and infer
        const { data: rows } = await adminClient.from(tableName as any).select("*");
        if (rows?.length) {
          sql += `-- Table: ${tableName} (schema unavailable, data-only export)\n`;
          sql += generateInserts(tableName, rows);
        } else {
          sql += `-- Table: ${tableName} (empty)\n`;
        }
        sql += "\n";
        continue;
      }

      // Generate CREATE TABLE
      sql += `-- ============================================\n`;
      sql += `-- Table: ${tableName}\n`;
      sql += `-- ============================================\n`;
      sql += `DROP TABLE IF EXISTS public.${tableName} CASCADE;\n`;
      sql += `CREATE TABLE public.${tableName} (\n`;
      const colLines = schemaRows.map((col: any) => {
        let line = `  ${col.column_name} ${col.data_type}`;
        if (col.is_nullable === "NO") line += " NOT NULL";
        if (col.column_default) line += ` DEFAULT ${col.column_default}`;
        return line;
      });
      sql += colLines.join(",\n");
      sql += "\n);\n\n";

      // Get data
      const { data: rows } = await adminClient.from(tableName as any).select("*");
      if (rows?.length) {
        sql += generateInserts(tableName, rows);
      }
      sql += "\n";
    }

    return new Response(sql, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="dump_${new Date().toISOString().slice(0, 10)}.sql"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeSQL(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (Array.isArray(val))
    return `'{${val.map((v: any) => `"${String(v).replace(/"/g, '\\"')}"`).join(",")}}'`;
  if (typeof val === "object")
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateInserts(tableName: string, rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  let out = "";
  for (const row of rows) {
    const values = cols.map((c) => escapeSQL(row[c])).join(", ");
    out += `INSERT INTO public.${tableName} (${cols.join(", ")}) VALUES (${values});\n`;
  }
  return out;
}
