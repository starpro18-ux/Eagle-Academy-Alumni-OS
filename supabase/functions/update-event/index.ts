import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const CONTRIBUTOR_ROLES = new Set(["owner", "leader", "committee_lead", "contributor"]);
const EVENT_STATUSES = new Set(["idea", "planning", "approved", "completed", "cancelled"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function validDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
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
  if (userError || !user) return json({ error: "You must be signed in to edit an event." }, 401);

  let eventId = "";
  let name = "";
  let description = null;
  let startsAt = null;
  let endsAt = null;
  let status = "";
  try {
    const body = await request.json();
    eventId = typeof body?.event_id === "string" ? body.event_id : "";
    name = typeof body?.name === "string" ? body.name.trim().slice(0, 180) : "";
    description = typeof body?.description === "string" ? body.description.trim().slice(0, 2000) || null : null;
    startsAt = validDate(body?.starts_at);
    endsAt = validDate(body?.ends_at);
    status = typeof body?.status === "string" ? body.status : "";
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return json({ error: "A valid event_id is required." }, 400);
  if (!name) return json({ error: "Event name is required." }, 400);
  if (startsAt === undefined || endsAt === undefined) return json({ error: "Event dates must be valid." }, 400);
  if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
    return json({ error: "The event end cannot be before its start." }, 400);
  }
  if (!EVENT_STATUSES.has(status)) return json({ error: "That event status is not supported." }, 400);

  const { data: event, error: eventError } = await adminClient
    .from("events")
    .select("id, organization_id, name, description, starts_at, ends_at, status")
    .eq("id", eventId)
    .single();
  if (eventError || !event) return json({ error: "Event not found." }, 404);

  const { data: membership, error: membershipError } = await adminClient
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", event.organization_id)
    .eq("user_id", user.id)
    .single();
  if (membershipError || !membership || !CONTRIBUTOR_ROLES.has(membership.role)) {
    return json({ error: "Only organization contributors can edit events." }, 403);
  }

  const { data: updated, error: updateError } = await adminClient
    .from("events")
    .update({ name, description, starts_at: startsAt, ends_at: endsAt, status })
    .eq("id", event.id)
    .select("id, name, description, starts_at, ends_at, status")
    .single();
  if (updateError || !updated) return json({ error: updateError?.message || "Event could not be updated." }, 500);

  const { error: auditError } = await adminClient.from("audit_events").insert({
    organization_id: event.organization_id,
    actor_user_id: user.id,
    action: "event.updated",
    entity_type: "event",
    entity_id: event.id,
    metadata: {
      changed_fields: ["name", "description", "starts_at", "ends_at", "status"],
      previous_status: event.status,
      next_status: status,
    },
  });
  if (auditError) console.error("audit_event_write_failed", auditError.message);

  return json({ event: updated });
});
