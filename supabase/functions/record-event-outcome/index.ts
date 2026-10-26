import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const CONTRIBUTOR_ROLES = new Set(["owner", "leader", "committee_lead", "contributor"]);

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
  if (userError || !user) return json({ error: "You must be signed in to record an outcome." }, 401);

  let eventId = "";
  let objectiveId = "";
  let actual = null;
  let narrative = "";
  let sourceEvidenceId = null;
  try {
    const body = await request.json();
    eventId = typeof body?.event_id === "string" ? body.event_id : "";
    objectiveId = typeof body?.objective_id === "string" ? body.objective_id : "";
    actual = body?.actual === null || body?.actual === undefined ? null : Number(body.actual);
    narrative = typeof body?.narrative === "string" ? body.narrative.trim().slice(0, 3000) : "";
    sourceEvidenceId = typeof body?.source_evidence_id === "string" && body.source_evidence_id ? body.source_evidence_id : null;
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  if (!/^[0-9a-f-]{36}$/i.test(eventId) || !/^[0-9a-f-]{36}$/i.test(objectiveId)) {
    return json({ error: "Valid event_id and objective_id are required." }, 400);
  }
  if (actual !== null && !Number.isFinite(actual)) return json({ error: "Actual result must be a valid number." }, 400);
  if (!narrative) return json({ error: "A narrative is required to explain the outcome." }, 400);
  if (sourceEvidenceId && !/^[0-9a-f-]{36}$/i.test(sourceEvidenceId)) {
    return json({ error: "source_evidence_id must be a valid evidence id." }, 400);
  }

  const { data: event, error: eventError } = await adminClient
    .from("events")
    .select("id, organization_id, name")
    .eq("id", eventId)
    .single();
  if (eventError || !event) return json({ error: "Event not found." }, 404);

  const { data: objective, error: objectiveError } = await adminClient
    .from("event_objectives")
    .select("id, event_id, organization_id, name, target, unit")
    .eq("id", objectiveId)
    .eq("event_id", event.id)
    .eq("organization_id", event.organization_id)
    .single();
  if (objectiveError || !objective) return json({ error: "Objective not found for this event." }, 404);

  if (sourceEvidenceId) {
    const { data: evidence, error: evidenceError } = await adminClient
      .from("evidence")
      .select("id, organization_id")
      .eq("id", sourceEvidenceId)
      .eq("organization_id", event.organization_id)
      .single();
    if (evidenceError || !evidence) return json({ error: "Supporting evidence was not found in this organization." }, 404);
  }

  const { data: membership, error: membershipError } = await adminClient
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", event.organization_id)
    .eq("user_id", user.id)
    .single();
  if (membershipError || !membership || !CONTRIBUTOR_ROLES.has(membership.role)) {
    return json({ error: "Only organization contributors can record outcomes." }, 403);
  }

  const { data: outcome, error: outcomeError } = await adminClient
    .from("event_outcomes")
    .insert({
      organization_id: event.organization_id,
      event_id: event.id,
      objective_id: objective.id,
      actual,
      narrative,
      source_evidence_id: sourceEvidenceId,
    })
    .select("id, event_id, objective_id, actual, narrative, source_evidence_id, reviewed_by, reviewed_at, created_at")
    .single();
  if (outcomeError || !outcome) return json({ error: outcomeError?.message || "Outcome could not be recorded." }, 500);

  const { error: auditError } = await adminClient.from("audit_events").insert({
    organization_id: event.organization_id,
    actor_user_id: user.id,
    action: "event.outcome_recorded",
    entity_type: "event_outcome",
    entity_id: outcome.id,
    metadata: {
      event_id: event.id,
      objective_id: objective.id,
      source_evidence_id: sourceEvidenceId,
      reviewed: false,
    },
  });
  if (auditError) console.error("audit_event_write_failed", auditError.message);

  return json({ outcome });
});
