import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { email, role, workspace_id } = await req.json();
    if (!email || !workspace_id) {
      return new Response(JSON.stringify({ error: "email y workspace_id requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: mem, error: memErr } = await admin
      .from("crm_inmobiliario_workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr) throw memErr;
    if (!mem || mem.role !== "admin") {
      return new Response(JSON.stringify({ error: "Solo administradores pueden invitar" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = role === "admin" ? "admin" : "member";
    const emailNorm = String(email).trim().toLowerCase();

    const { data: existingProfile } = await admin
      .from("crm_inmobiliario_profiles")
      .select("id")
      .eq("email", emailNorm)
      .maybeSingle();

    if (existingProfile?.id) {
      const { error: insErr } = await admin.from("crm_inmobiliario_workspace_members").upsert(
        {
          workspace_id,
          user_id: existingProfile.id,
          role: r,
        },
        { onConflict: "workspace_id,user_id" },
      );
      if (insErr) throw insErr;
      return new Response(JSON.stringify({ ok: true, status: "member_added" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("crm_inmobiliario_workspace_pending_invites")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("email", emailNorm);
    const { error: pendErr } = await admin
      .from("crm_inmobiliario_workspace_pending_invites")
      .insert({ workspace_id, email: emailNorm, role: r });
    if (pendErr) throw pendErr;

    const origin = req.headers.get("origin") || "";
    const redirectTo = origin ? `${origin}/Login` : undefined;

    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(emailNorm, {
      redirectTo,
    });
    if (invErr) console.warn("inviteUserByEmail:", invErr);

    return new Response(JSON.stringify({ ok: true, status: "invited_pending" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
