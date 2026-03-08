import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "ADMIN")
      .maybeSingle();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, target_user_id, updates } = await req.json();

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (action === "delete" && target_user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      // Get profile info before deletion for audit
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", target_user_id)
        .maybeSingle();

      // Delete from user_roles
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", target_user_id);

      // Delete from order_technicians
      await supabaseAdmin
        .from("order_technicians")
        .delete()
        .eq("user_id", target_user_id);

      // Archive profile (mark inactive) rather than delete to preserve references
      await supabaseAdmin
        .from("profiles")
        .update({ is_active: false })
        .eq("user_id", target_user_id);

      // Delete from auth
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log the action
      await supabaseAdmin.from("activity_logs").insert({
        entity_id: target_user_id,
        entity_type: "USER",
        action_type: "DELETE",
        entity_name: profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : target_user_id,
        user_id: caller.id,
        description: `Usunięto użytkownika: ${profile?.email ?? target_user_id}`,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle_active") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("is_active, first_name, last_name")
        .eq("user_id", target_user_id)
        .maybeSingle();

      const newActive = !profile?.is_active;
      await supabaseAdmin
        .from("profiles")
        .update({ is_active: newActive })
        .eq("user_id", target_user_id);

      await supabaseAdmin.from("activity_logs").insert({
        entity_id: target_user_id,
        entity_type: "USER",
        action_type: newActive ? "ACTIVATE" : "DEACTIVATE",
        entity_name: profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : target_user_id,
        user_id: caller.id,
        description: newActive ? "Aktywowano użytkownika" : "Dezaktywowano użytkownika",
      });

      return new Response(JSON.stringify({ success: true, is_active: newActive }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_profile") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("user_id", target_user_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const { role } = updates;
      // Remove existing roles and set new one
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", target_user_id);

      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: target_user_id, role });

      await supabaseAdmin.from("activity_logs").insert({
        entity_id: target_user_id,
        entity_type: "USER",
        action_type: "ROLE_CHANGE",
        user_id: caller.id,
        description: `Zmieniono rolę na: ${role}`,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
