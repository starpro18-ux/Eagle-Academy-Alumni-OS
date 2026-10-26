import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const CONTRIBUTOR_ROLES = new Set(["owner", "leader", "committee_lead", "contributor"]);
const COMMITMENT_STATUSES = new Set(["proposed", "accepted", "in_progress", "completed", "blocked", "cancelled"]);
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const commitmentId = typeof body?.commitment_id === "string" ? body.commitment_id : "";
  const nextStatus = typeof body?.status === "string" ? body.status : "";
  const nextTitle = body?.title === undefined ? undefined : typeof body.title === "string" ? body.title.trim() : "";
  const nextOwnerId = body?.owner_id === undefined ? undefined : body.owner_id === null || body.owner_id === "" ? null : body.owner_id;
  const nextDueDate = body?.due_date === undefined ? undefined : body.due_date === null || body.due_date === "" ? null : body.due_date;

  if (!UUID_PATTERN.test(commitmentId)) return json({ error: "A valid commitment_id is required." }, 400);
  if (body?.status !== undefined && !COMMITMENT_STATUSES.has(nextStatus)) {
    return json({ error: "That commitment status is not supported." }, 400);
  }
  if (body?.title !== undefined && (!nextTitle || nextTitle.length > 240)) {
    return json({ error: "Commitment titles must be between 1 and 240 characters." }, 400);
  }
  if (nextOwnerId !== undefined && (typeof nextOwnerId !== "string" || !UUID_PATTERN.test(nextOwnerId))) {
    return json({ error: "owner_id must be a valid active person or null." }, 400);
  }
  if (nextDueDate !== undefined && (typeof nextDueDate !== "string" || !DATE_PATTERN.test(nextDueDate))) {
    return json({ error: "due_date must use YYYY-MM-DD format or null." }, 400);
  }
  if (body?.status === undefined && body?.title === undefined && body?.owner_id === undefined && body?.due_date === undefined) {
    return json({ error: "At least one commitment field is required." }, 400);
  }

  const { data: commitment, error: commitmentError } = await adminClient
    .from("commitments")
    .select("id, organization_id, title, status, owner_id, due_date, completed_at")
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
    return json({ error: "Only organization contributors can update commitments." }, 403);
  }

  if (nextOwnerId) {
    const { data: owner, error: ownerError } = await adminClient
      .from("people")
      .select("id")
      .eq("id", nextOwnerId)
      .eq("organization_id", commitment.organization_id)
      .eq("active", true)
      .maybeSingle();
    if (ownerError || !owner) return json({ error: "The selected owner is not an active person in this organization." }, 400);
  }

  const statusChanged = body?.status !== undefined && nextStatus !== commitment.status;
  const updatedFields = {};
  if (nextTitle !== undefined) updatedFields.title = nextTitle;
  if (nextOwnerId !== undefined) updatedFields.owner_id = nextOwnerId;
  if (nextDueDate !== undefined) updatedFields.due_date = nextDueDate;
  if (body?.status !== undefined) {
    updatedFields.status = nextStatus;
    updatedFields.completed_at = nextStatus === "completed"
      ? commitment.completed_at || new Date().toISOString()
      : null;
  }

  const { data: updated, error: updateError } = await adminClient
    .from("commitments")
    .update(updatedFields)
    .eq("id", commitment.id)
    .select("id, title, status, due_date, owner_id, completed_at")
    .single();
  if (updateError || !updated) return json({ error: updateError?.message || "Commitment could not be updated." }, 500);

  const auditMetadata = {
    changed_fields: Object.keys(updatedFields),
    previous: {
      title: commitment.title,
      owner_id: commitment.owner_id,
      due_date: commitment.due_date,
      status: commitment.status,
      completed_at: commitment.completed_at,
    },
    next: {
      title: updated.title,
      owner_id: updated.owner_id,
      due_date: updated.due_date,
      status: updated.status,
      completed_at: updated.completed_at,
    },
  };
  const { error: auditError } = await adminClient.from("audit_events").insert({
    organization_id: commitment.organization_id,
    actor_user_id: user.id,
    action: statusChanged ? "commitment.updated_and_status_changed" : "commitment.updated",
    entity_type: "commitment",
    entity_id: commitment.id,
    metadata: auditMetadata,
  });
  if (auditError) console.error("audit_event_write_failed", auditError.message);

  return json({ commitment: updated });
});
