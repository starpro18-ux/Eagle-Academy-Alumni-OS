import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const CONTRIBUTOR_ROLES = new Set(["owner", "leader", "committee_lead", "contributor"]);
const MAX_EVIDENCE = 80;
const MAX_CLAIM_CHARS = 1200;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function errorMessage(error) {
  return error instanceof Error ? error.message : "Recommendation generation failed.";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Only POST is supported." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: "Function configuration or authorization is missing." }, 500);
  }
  if (!openAiKey) {
    return json({ error: "Recommendation generation is not configured yet. Add OPENAI_API_KEY to Supabase Edge Function secrets." }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "You must be signed in to generate a recommendation." }, 401);

  let sourceDocumentId = "";
  try {
    const body = await request.json();
    sourceDocumentId = typeof body?.source_document_id === "string" ? body.source_document_id : "";
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  if (!/^[0-9a-f-]{36}$/i.test(sourceDocumentId)) {
    return json({ error: "A valid source_document_id is required." }, 400);
  }

  const { data: source, error: sourceError } = await adminClient
    .from("source_documents")
    .select("id, organization_id, title, source_url, mime_type, extraction_status, source_modified_at")
    .eq("id", sourceDocumentId)
    .single();
  if (sourceError || !source) return json({ error: "Source document not found." }, 404);
  if (source.extraction_status !== "complete") {
    return json({ error: "Extract this source before generating a recommendation." }, 409);
  }

  const { data: membership, error: membershipError } = await adminClient
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", source.organization_id)
    .eq("user_id", user.id)
    .single();
  if (membershipError || !membership || !CONTRIBUTOR_ROLES.has(membership.role)) {
    return json({ error: "You do not have permission to generate recommendations for this organization." }, 403);
  }

  try {
    const { data: fragments, error: fragmentError } = await adminClient
      .from("source_fragments")
      .select("id, locator, content")
      .eq("organization_id", source.organization_id)
      .eq("source_document_id", source.id)
      .order("created_at", { ascending: true })
      .limit(MAX_EVIDENCE);
    if (fragmentError) throw fragmentError;
    if (!fragments?.length) return json({ error: "This source has no extracted evidence yet." }, 422);

    const evidence = fragments.map((fragment, index) => ({
      index,
      evidence_id: fragment.id,
      locator: fragment.locator,
      claim: String(fragment.content ?? "").slice(0, MAX_CLAIM_CHARS),
    }));

    const prompt = [
      "You are the EAAA operating recommendation agent.",
      "EAAA strengthens the connection between Eagle Academy for Young Men alumni and the Eagle Academy Foundation.",
      "Its three mission pillars are Brotherhood, Service, and Access to Opportunities.",
      "Recommendations must support connection, accountability, community impact, leadership development, and economic mobility for young Black and Brown men.",
      "Review the source evidence below and propose one practical, human-reviewable recommendation.",
      "Do not invent facts. Use only the evidence provided. Keep the body concise and operational.",
      "The recommendation is only proposed; it must not claim that an action was approved or executed.",
      "Return evidence_indexes for every claim that materially supports the recommendation.",
      "",
      "Source title: " + source.title,
      "Source type: " + source.mime_type,
      "Evidence:",
      JSON.stringify(evidence),
    ].join("\n");

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + openAiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: "Produce a single evidence-grounded recommendation for an alumni association. Follow the requested JSON schema exactly.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "eaaa_recommendation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: { type: "string" },
                title: { type: "string" },
                body: { type: "string" },
                risk_class: { type: "string", enum: ["low", "medium", "high"] },
                uncertainty: { type: "string" },
                evidence_indexes: { type: "array", items: { type: "integer" } },
              },
              required: ["kind", "title", "body", "risk_class", "uncertainty", "evidence_indexes"],
            },
          },
        },
      }),
    });

    if (!openAiResponse.ok) {
      const detail = await openAiResponse.text();
      throw new Error("The recommendation model returned " + openAiResponse.status + ": " + detail.slice(0, 300));
    }

    const modelPayload = await openAiResponse.json();
    const content = modelPayload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("The recommendation model returned no structured content.");

    const recommendation = JSON.parse(content);
    const validIndexes = [...new Set((Array.isArray(recommendation.evidence_indexes) ? recommendation.evidence_indexes : [])
      .filter((index) => Number.isInteger(index) && index >= 0 && index < evidence.length))];
    if (!validIndexes.length) throw new Error("The recommendation did not cite source evidence.");

    const { data: created, error: recommendationError } = await adminClient
      .from("recommendations")
      .insert({
        organization_id: source.organization_id,
        kind: String(recommendation.kind).slice(0, 120),
        title: String(recommendation.title).slice(0, 240),
        body: String(recommendation.body).slice(0, 4000),
        status: "proposed",
        risk_class: recommendation.risk_class,
        agent_name: "eaaa-recommendation-agent",
        agent_version: "recommend-v1",
        policy_version: "eaaa-mission-v1",
        uncertainty: String(recommendation.uncertainty).slice(0, 1200),
      })
      .select("id, kind, title, body, status, risk_class, uncertainty, created_at")
      .single();
    if (recommendationError || !created) throw recommendationError ?? new Error("Recommendation could not be saved.");

    const citations = validIndexes.map((index) => ({
      recommendation_id: created.id,
      evidence_id: evidence[index].evidence_id,
    }));
    const { error: citationError } = await adminClient.from("recommendation_citations").insert(citations);
    if (citationError) throw citationError;

    return json({ recommendation: created, citations_created: citations.length });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
});
