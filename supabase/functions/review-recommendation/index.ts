import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const REVIEWER_ROLES = new Set(["owner", "leader", "committee_lead"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function message(error) {
  return error instanceof Error ? error.message : "Recommendation review failed.";
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
  if (userError || !user) return json({ error: "You must be signed in to review a recommendation." }, 401);

  let recommendationId = "";
  let decision = "";
  let correction = "";
  try {
    const body = await request.json();
    recommendationId = typeof body?.recommendation_id === "string" ? body.recommendation_id : "";
    decision = typeof body?.decision === "string" ? body.decision : "";
    correction = typeof body?.correction === "string" ? body.correction.trim().slice(0, 4000) : "";
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  if (!/^[0-9a-f-]{36}$/i.test(recommendationId)) {
    return json({ error: "A valid recommendation_id is required." }, 400);
  }
  if (!["approved", "rejected", "corrected"].includes(decision)) {
    return json({ error: "Decision must be approved, rejected, or corrected." }, 400);
  }
  if (decision === "corrected" && !correction) {
    return json({ error: "A correction is required when marking a recommendation corrected." }, 400);
  }

  const { data: recommendation, error: recommendationError } = await adminClient
    .from("recommendations")
    .select("id, organization_id, status")
    .eq("id", recommendationId)
    .single();
  if (recommendationError || !recommendation) return json({ error: "Recommendation not found." }, 404);
  if (!["draft", "proposed"].includes(recommendation.status)) {
    return json({ error: "This recommendation has already been resolved." }, 409);
  }

  const { data: membership, error: membershipError } = await adminClient
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", recommendation.organization_id)
    .eq("user_id", user.id)
    .single();
  if (membershipError || !membership || !REVIEWER_ROLES.has(membership.role)) {
    return json({ error: "Only an organization owner, leader, or committee lead can review recommendations." }, 403);
  }

  try {
    const { data: review, error: reviewError } = await adminClient
      .from("recommendation_reviews")
      .insert({
        organization_id: recommendation.organization_id,
        recommendation_id: recommendation.id,
        reviewer_id: user.id,
        decision,
        correction: correction || null,
      })
      .select("id, recommendation_id, decision, correction, created_at")
      .single();
    if (reviewError || !review) throw reviewError ?? new Error("The review could not be saved.");

    const nextStatus = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "draft";
    const { data: updated, error: updateError } = await adminClient
      .from("recommendations")
      .update({ status: nextStatus })
      .eq("id", recommendation.id)
      .select("id, title, status, risk_class, uncertainty")
      .single();
    if (updateError || !updated) throw updateError ?? new Error("The recommendation status could not be updated.");

    const { error: auditError } = await adminClient.from("audit_events").insert({
      organization_id: recommendation.organization_id,
      actor_user_id: user.id,
      action: "recommendation.reviewed",
      entity_type: "recommendation",
      entity_id: recommendation.id,
      metadata: {
        review_id: review.id,
        decision,
        next_status: nextStatus,
        correction_recorded: Boolean(correction),
      },
    });
    if (auditError) console.error("audit_event_write_failed", auditError.message);

    return json({ review, recommendation: updated });
  } catch (error) {
    return json({ error: message(error) }, 500);
  }
});
