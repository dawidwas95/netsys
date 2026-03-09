import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TABLES = [
  "clients", "client_contacts", "service_orders", "service_order_items",
  "service_order_comments", "order_technicians", "documents", "document_items",
  "document_attachments", "inventory_items", "inventory_movements",
  "inventory_reservations", "inventory_categories", "cash_transactions",
  "it_work_entries", "it_work_comments", "devices", "offers", "offer_items",
  "purchase_requests", "purchase_categories", "customer_messages",
  "notification_templates", "notification_log", "notifications",
  "company_settings", "pdf_templates", "profiles", "user_roles",
  "activity_logs", "billing_batches", "billing_batch_items",
  "client_it_documents", "network_devices", "service_categories",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is ADMIN
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "ADMIN").maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedTables = body.tables as string[] | undefined;
    const tablesToExport = requestedTables?.length
      ? requestedTables.filter((t) => ALLOWED_TABLES.includes(t))
      : ALLOWED_TABLES;

    let sql = `-- =============================================\n`;
    sql += `-- Full SQL Dump\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += `-- Tables: ${tablesToExport.length}\n`;
    sql += `-- =============================================\n\n`;
    sql += `SET statement_timeout = 0;\nSET lock_timeout = 0;\nSET client_encoding = 'UTF8';\n\n`;

    for (const tableName of tablesToExport) {
      // Get column definitions using the DB function
      const { data: columns, error: colErr } = await adminClient
        .rpc("get_table_columns", { p_table: tableName });

      if (colErr || !columns?.length) {
        sql += `-- Table: ${tableName} (schema not found, skipping)\n\n`;
        continue;
      }

      sql += `-- ============================================\n`;
      sql += `-- Table: public.${tableName}\n`;
      sql += `-- ============================================\n`;
      sql += `DROP TABLE IF EXISTS public.${tableName} CASCADE;\n`;
      sql += `CREATE TABLE public.${tableName} (\n`;

      const colLines = (columns as any[]).map((col) => {
        // Map data type
        let dtype = col.data_type;
        if (dtype === "USER-DEFINED") dtype = col.udt_name;
        else if (dtype === "ARRAY") dtype = col.udt_name;
        else if (dtype === "character varying") dtype = "varchar";
        else if (dtype === "timestamp with time zone") dtype = "timestamptz";
        else if (dtype === "timestamp without time zone") dtype = "timestamp";

        let line = `  "${col.column_name}" ${dtype}`;
        if (col.is_nullable === "NO") line += " NOT NULL";
        if (col.column_default) line += ` DEFAULT ${col.column_default}`;
        return line;
      });

      sql += colLines.join(",\n");
      sql += `\n);\n\n`;

      // Get all data (paginated to handle >1000 rows)
      let allRows: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data: rows } = await adminClient
          .from(tableName as any).select("*")
          .range(offset, offset + pageSize - 1);
        if (!rows?.length) break;
        allRows = allRows.concat(rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
      }

      if (allRows.length) {
        sql += `-- Data: ${allRows.length} rows\n`;
        const cols = Object.keys(allRows[0]);
        for (const row of allRows) {
          const values = cols.map((c) => escapeSQL(row[c])).join(", ");
          sql += `INSERT INTO public.${tableName} (${cols.map(c => `"${c}"`).join(", ")}) VALUES (${values});\n`;
        }
      } else {
        sql += `-- (empty table)\n`;
      }
      sql += `\n`;
    }

    return new Response(sql, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/sql; charset=utf-8",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
