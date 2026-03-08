import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!caller) return json({ error: "Unauthorized" }, 401);

    // Check caller is admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "ADMIN")
      .maybeSingle();

    if (!callerRole) return json({ error: "Forbidden: admin only" }, 403);

    const { action, target_user_id, updates, new_user } = await req.json();

    // ── CREATE USER ──
    if (action === "create_user") {
      if (!new_user?.email || !new_user?.password) {
        return json({ error: "email and password required" }, 400);
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: new_user.email,
        password: new_user.password,
        email_confirm: true,
        user_metadata: {
          first_name: new_user.first_name ?? "",
          last_name: new_user.last_name ?? "",
        },
      });

      if (authError) return json({ error: authError.message }, 400);

      const newUserId = authData.user.id;

      // The handle_new_user trigger should create profile & default role,
      // but let's ensure correct role is set
      if (new_user.role && new_user.role !== "EMPLOYEE") {
        await supabaseAdmin
          .from("user_roles")
          .update({ role: new_user.role })
          .eq("user_id", newUserId);
      }

      // Update profile with is_active if specified
      if (new_user.is_active === false) {
        await supabaseAdmin
          .from("profiles")
          .update({ is_active: false })
          .eq("user_id", newUserId);
      }

      await supabaseAdmin.from("activity_logs").insert({
        entity_id: newUserId,
        entity_type: "USER",
        action_type: "CREATE",
        entity_name: `${new_user.first_name ?? ""} ${new_user.last_name ?? ""}`.trim(),
        user_id: caller.id,
        description: `Utworzono użytkownika: ${new_user.email}`,
      });

      return json({ success: true, user_id: newUserId });
    }

    // All other actions require target_user_id
    if (!target_user_id) return json({ error: "target_user_id required" }, 400);

    // Prevent self-deletion
    if (action === "delete" && target_user_id === caller.id) {
      return json({ error: "Cannot delete yourself" }, 400);
    }

    // ── DELETE USER ──
    if (action === "delete") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", target_user_id)
        .maybeSingle();

      await supabaseAdmin.from("user_roles").delete().eq("user_id", target_user_id);
      await supabaseAdmin.from("order_technicians").delete().eq("user_id", target_user_id);
      await supabaseAdmin.from("profiles").update({ is_active: false }).eq("user_id", target_user_id);

      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
      if (authError) return json({ error: authError.message }, 500);

      await supabaseAdmin.from("activity_logs").insert({
        entity_id: target_user_id,
        entity_type: "USER",
        action_type: "DELETE",
        entity_name: profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : target_user_id,
        user_id: caller.id,
        description: `Usunięto użytkownika: ${profile?.email ?? target_user_id}`,
      });

      return json({ success: true });
    }

    // ── TOGGLE ACTIVE ──
    if (action === "toggle_active") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("is_active, first_name, last_name")
        .eq("user_id", target_user_id)
        .maybeSingle();

      const newActive = !profile?.is_active;
      await supabaseAdmin.from("profiles").update({ is_active: newActive }).eq("user_id", target_user_id);

      await supabaseAdmin.from("activity_logs").insert({
        entity_id: target_user_id,
        entity_type: "USER",
        action_type: newActive ? "ACTIVATE" : "DEACTIVATE",
        entity_name: profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : target_user_id,
        user_id: caller.id,
        description: newActive ? "Aktywowano użytkownika" : "Dezaktywowano użytkownika",
      });

      return json({ success: true, is_active: newActive });
    }

    // ── UPDATE PROFILE ──
    if (action === "update_profile") {
      const profileUpdates: Record<string, any> = {};
      if (updates.first_name !== undefined) profileUpdates.first_name = updates.first_name;
      if (updates.last_name !== undefined) profileUpdates.last_name = updates.last_name;
      if (updates.phone !== undefined) profileUpdates.phone = updates.phone;
      if (updates.is_active !== undefined) profileUpdates.is_active = updates.is_active;

      // Update email in auth + profile
      if (updates.email) {
        // Check for duplicate email
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const duplicate = existingUsers?.users?.find(
          (u) => u.email?.toLowerCase() === updates.email.toLowerCase() && u.id !== target_user_id
        );
        if (duplicate) return json({ error: "Ten adres e-mail jest już zajęty" }, 400);

        const { error: authEmailErr } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
          email: updates.email,
          email_confirm: true,
        });
        if (authEmailErr) return json({ error: authEmailErr.message }, 400);
        profileUpdates.email = updates.email;
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await supabaseAdmin.from("profiles").update(profileUpdates).eq("user_id", target_user_id);
        if (error) return json({ error: error.message }, 500);
      }

      // Update role if provided
      if (updates.role) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", target_user_id);
        await supabaseAdmin.from("user_roles").insert({ user_id: target_user_id, role: updates.role });
      }

      return json({ success: true });
    }

    // ── RESET PASSWORD ──
    if (action === "reset_password") {
      const { password } = updates ?? {};
      if (!password || password.length < 6) return json({ error: "Hasło musi mieć minimum 6 znaków" }, 400);
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, { password });
      if (pwErr) return json({ error: pwErr.message }, 500);

      await supabaseAdmin.from("activity_logs").insert({
        entity_id: target_user_id,
        entity_type: "USER",
        action_type: "PASSWORD_RESET",
        user_id: caller.id,
        description: "Zresetowano hasło użytkownika",
      });

      return json({ success: true });
    }

    // ── UPDATE ROLE ──
    if (action === "update_role") {
      const { role } = updates;
      await supabaseAdmin.from("user_roles").delete().eq("user_id", target_user_id);
      await supabaseAdmin.from("user_roles").insert({ user_id: target_user_id, role });

      await supabaseAdmin.from("activity_logs").insert({
        entity_id: target_user_id,
        entity_type: "USER",
        action_type: "ROLE_CHANGE",
        user_id: caller.id,
        description: `Zmieniono rolę na: ${role}`,
      });

      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
