import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const CONTRIBUTOR_ROLES = new Set(["owner", "leader", "committee_lead", "contributor"]);
const COMMITMENT_STATUSES = new Set(["proposed", "accepted", "in_progress", "completed", "blocked", "cancelled"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Only POST is supported." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: "Function configuration or authorization is missing." }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "You must be signed in to update a commitment." }, 401);

  let commitmentId = "";
  let nextStatus = "";
  try {
    const body = await request.json();
    commitmentId = typeof body?.commitment_id === "string" ? body.commitment_id : "";
    nextStatus = typeof body?.status === "string" ? body.status : "";
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  if (!/^[0-9a-f-]{36}$/i.test(commitmentId)) {
    return json({ error: "A valid commitment_id is required." }, 400);
  }
  if (!COMMITMENT_STATUSES.has(nextStatus)) {
    return json({ error: "That commitment status is not supported." }, 400);
  }

  const { data: commitment, error: commitmentError } = await adminClient
    .from("commitments")
    .select("id, organization_id, title, status")
    .eq("id", commitmentId)
    .single();
  if (commitmentError || !commitment) return json({ error: "Commitment not found." }, 404);

  const { data: membership, error: membershipError } = await adminClient
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", commitment.organization_id)
    .eq("user_id", user.id)
    .single();
  if (membershipError || !membership || !CONTRIBUTOR_ROLES.has(membership.role)) {
    return json({ error: "Only organization contributors can update commitment status." }, 403);
  }

  const completedAt = nextStatus === "completed" ? new Date().toISOString() : null;
  const { data: updated, error: updateError } = await adminClient
    .from("commitments")
    .update({ status: nextStatus, completed_at: completedAt })
    .eq("id", commitment.id)
    .select("id, title, status, due_date, owner_id, completed_at")
    .single();
  if (updateError || !updated) return json({ error: updateError?.message || "Commitment status could not be updated." }, 500);

  const { error: auditError } = await adminClient.from("audit_events").insert({
    organization_id: commitment.organization_id,
    actor_user_id: user.id,
    action: "commitment.status_changed",
    entity_type: "commitment",
    entity_id: commitment.id,
    metadata: {
      previous_status: commitment.status,
      next_status: nextStatus,
      completed_at: completedAt,
    },
  });
  if (auditError) console.error("audit_event_write_failed", auditError.message);

  return json({ commitment: updated });
});
