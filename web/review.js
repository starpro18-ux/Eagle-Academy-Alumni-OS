import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const config = globalThis.EAGLE_SUPABASE_CONFIG ?? {};
const CONTRIBUTOR_ROLES = new Set(["owner", "leader", "committee_lead", "contributor"]);
const REVIEWER_ROLES = new Set(["owner", "leader", "committee_lead"]);
const setupView = document.querySelector("#setup-view");
const signInView = document.querySelector("#sign-in-view");
const appView = document.querySelector("#app-view");
const status = document.querySelector("#status");
const signInForm = document.querySelector("#sign-in-form");
const signedInEmail = document.querySelector("#signed-in-email");
const organizationName = document.querySelector("#organization-name");
const recommendationList = document.querySelector("#recommendation-list");
const commitmentList = document.querySelector("#commitment-list");
const eventList = document.querySelector("#event-list");
const sourceList = document.querySelector("#source-list");
const recommendationSourceSelect = document.querySelector("#recommend-source-select");
const generateRecommendationButton = document.querySelector("#generate-recommendation");
const recommendationHint = document.querySelector("#recommendation-hint");
let canRecommend = false;
let canReview = false;
let activeOrganizationId = null;
let activeSupabase = null;

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function show(view) {
  for (const candidate of [setupView, signInView, appView]) {
    candidate.classList.toggle("hidden", candidate !== view);
  }
}

function formatDate(value, includeTime = true) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString(undefined, includeTime ? undefined : { dateStyle: "medium" });
}

function tag(text, kind = "") {
  const element = document.createElement("span");
  element.className = `tag ${kind}`.trim();
  element.textContent = text;
  return element;
}

function emptyItem(message) {
  const item = document.createElement("li");
  item.className = "empty";
  item.textContent = message;
  return item;
}

async function loadWorkspace(supabase, userId) {
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (membershipError) throw membershipError;
  const membership = memberships?.[0];
  if (!membership) throw new Error("Your account is authenticated but has no organization membership yet.");

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", membership.organization_id)
    .single();
  if (organizationError) throw organizationError;
  return { membership, organization };
}

async function loadData(supabase, organizationId) {
  const [recommendations, commitments, events, sources] = await Promise.all([
    supabase
      .from("recommendations")
      .select("id, title, body, status, risk_class, agent_name, created_at, uncertainty, recommendation_citations(evidence_id)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("commitments")
      .select("id, title, status, due_date, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("events")
      .select("id, name, description, status, starts_at, ends_at")
      .eq("organization_id", organizationId)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("source_documents")
      .select("id, title, mime_type, extraction_status, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  for (const result of [recommendations, commitments, events, sources]) {
    if (result.error) throw result.error;
  }
  const recommendationRows = recommendations.data ?? [];
  const evidenceIds = [...new Set(recommendationRows.flatMap((item) => (item.recommendation_citations ?? []).map((citation) => citation.evidence_id)))];
  let evidenceRows = [];
  if (evidenceIds.length) {
    const evidenceResult = await supabase
      .from("evidence")
      .select("id, claim, source_fragment_id")
      .eq("organization_id", organizationId)
      .in("id", evidenceIds);
    if (evidenceResult.error) throw evidenceResult.error;
    evidenceRows = evidenceResult.data ?? [];
  }
  const evidenceById = new Map(evidenceRows.map((evidence) => [evidence.id, evidence]));
  const citedRecommendations = recommendationRows.map((item) => ({
    ...item,
    citedEvidence: (item.recommendation_citations ?? [])
      .map((citation) => evidenceById.get(citation.evidence_id))
      .filter(Boolean),
  }));

  return {
    recommendations: citedRecommendations,
    commitments: commitments.data ?? [],
    events: events.data ?? [],
    sources: sources.data ?? [],
  };
}

function renderRecommendations(items) {
  recommendationList.replaceChildren();
  if (!items.length) {
    recommendationList.append(emptyItem("No recommendations are waiting for review."));
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "review-item";
    const header = document.createElement("div");
    header.className = "review-item-header";
    const title = document.createElement("div");
    title.className = "review-title";
    title.textContent = item.title;
    const status = tag(item.status, item.status === "proposed" ? "review" : "");
    const risk = tag("risk: " + item.risk_class, item.risk_class === "high" ? "risk" : "");
    header.append(title, status, risk);
    const body = document.createElement("p");
    body.className = "review-body";
    body.textContent = item.body;
    const meta = document.createElement("div");
    meta.className = "review-meta";
    const citationCount = item.recommendation_citations?.length ?? 0;
    meta.textContent = "Agent: " + item.agent_name + " · " + formatDate(item.created_at) + " · Evidence: " + citationCount + (item.uncertainty ? " · Uncertainty: " + item.uncertainty : "");
    li.append(header, body, meta);

    if (item.citedEvidence?.length) {
      const citations = document.createElement("details");
      citations.className = "evidence-citations";
      const citationSummary = document.createElement("summary");
      citationSummary.textContent = "Why this is proposed · " + item.citedEvidence.length + " cited claim" + (item.citedEvidence.length === 1 ? "" : "s");
      const citationList = document.createElement("div");
      citationList.className = "citation-list";
      for (const [index, evidence] of item.citedEvidence.entries()) {
        const citation = document.createElement("article");
        citation.className = "citation-item";
        const label = document.createElement("span");
        label.className = "citation-label";
        label.textContent = "Evidence " + (index + 1);
        const claim = document.createElement("p");
        claim.textContent = evidence.claim;
        citation.append(label, claim);
        citationList.append(citation);
      }
      citations.append(citationSummary, citationList);
      li.append(citations);
    }

    if (canReview && ["draft", "proposed"].includes(item.status)) {
      const actions = document.createElement("div");
      actions.className = "decision-actions";
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "approve";
      approve.textContent = "Approve";
      approve.addEventListener("click", () => void submitReview(item.id, "approved"));
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "reject";
      reject.textContent = "Reject";
      reject.addEventListener("click", () => void submitReview(item.id, "rejected"));
      const correct = document.createElement("button");
      correct.type = "button";
      correct.className = "secondary";
      correct.textContent = "Record correction";
      correct.addEventListener("click", () => void submitReview(item.id, "corrected"));
      actions.append(approve, reject, correct);
      li.append(actions);
    }

    recommendationList.append(li);
  }
}

async function submitReview(recommendationId, decision) {
  let correction = "";
  if (decision === "corrected") {
    correction = window.prompt("What should be corrected before this proposal is reconsidered?")?.trim() ?? "";
    if (!correction) return;
  }

  setStatus(decision === "approved" ? "Recording approval…" : decision === "rejected" ? "Recording rejection…" : "Recording correction…");
  const { data, error } = await activeSupabase.functions.invoke("review-recommendation", {
    body: { recommendation_id: recommendationId, decision, correction },
  });
  if (error || data?.error) {
    setStatus(error?.message || data?.error || "Recommendation review failed.", "error");
    return;
  }

  const refreshed = await loadData(activeSupabase, activeOrganizationId);
  renderRecommendations(refreshed.recommendations);
  setStatus(decision === "approved" ? "Recommendation approved. No operational action was executed." : decision === "rejected" ? "Recommendation rejected and recorded." : "Correction recorded; the proposal is back in draft.", "success");
}

function renderCommitments(items) {
  commitmentList.replaceChildren();
  if (!items.length) {
    commitmentList.append(emptyItem("No commitments recorded."));
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "review-item";
    const title = document.createElement("div");
    title.className = "review-title";
    title.textContent = item.title;
    const meta = document.createElement("div");
    meta.className = "review-meta";
    meta.append(tag(item.status), tag(item.due_date ? `Due ${formatDate(item.due_date, false)}` : "No due date"));
    li.append(title, meta);
    commitmentList.append(li);
  }
}

function renderEvents(items) {
  eventList.replaceChildren();
  const upcoming = items.filter((item) => !item.starts_at || new Date(item.starts_at) >= new Date());
  if (!upcoming.length) {
    eventList.append(emptyItem("No upcoming events recorded."));
    return;
  }

  for (const item of upcoming) {
    const li = document.createElement("li");
    li.className = "review-item";
    const title = document.createElement("div");
    title.className = "review-title";
    title.textContent = item.name;
    const meta = document.createElement("div");
    meta.className = "review-meta";
    meta.append(tag(item.status), tag(formatDate(item.starts_at)));
    li.append(title);
    if (item.description) {
      const description = document.createElement("p");
      description.className = "review-body";
      description.textContent = item.description;
      li.append(description);
    }
    li.append(meta);
    eventList.append(li);
  }
}

function renderRecommendationSources(items) {
  const completed = items.filter((item) => item.extraction_status === "complete");
  recommendationSourceSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = completed.length ? "Choose a completed source" : "Extract a source first";
  recommendationSourceSelect.append(placeholder);
  for (const item of completed) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.title;
    recommendationSourceSelect.append(option);
  }
  recommendationSourceSelect.disabled = !canRecommend || !completed.length;
  generateRecommendationButton.disabled = !canRecommend || !completed.length || !recommendationSourceSelect.value;
  recommendationHint.textContent = canRecommend
    ? (completed.length ? "Choose an extracted source. Every proposal stays marked proposed and carries source citations for human review." : "Extract a PDF, Word, Excel, CSV, or text source first.")
    : "Your current role is read-only. Ask an owner, leader, committee lead, or contributor to generate a proposal.";
}

function renderSources(items) {
  sourceList.replaceChildren();
  if (!items.length) {
    sourceList.append(emptyItem("No source documents yet. Upload the first source to begin extraction."));
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "review-item";
    const title = document.createElement("div");
    title.className = "review-title";
    title.textContent = item.title;
    const meta = document.createElement("div");
    meta.className = "review-meta";
    meta.append(tag(item.extraction_status, item.extraction_status === "pending" ? "review" : ""), tag(item.mime_type || "unknown"), tag(formatDate(item.created_at)));
    li.append(title, meta);
    sourceList.append(li);
  }
}

async function renderSession(supabase, session) {
  if (!session?.user) {
    show(signInView);
    setStatus("Sign in to access the review queue.");
    return;
  }

  try {
    setStatus("Loading review queue…");
    const workspace = await loadWorkspace(supabase, session.user.id);
    canRecommend = CONTRIBUTOR_ROLES.has(workspace.membership.role);
    canReview = REVIEWER_ROLES.has(workspace.membership.role);
    activeOrganizationId = workspace.organization.id;
    activeSupabase = supabase;
    const data = await loadData(supabase, workspace.organization.id);
    signedInEmail.textContent = session.user.email || "authenticated user";
    organizationName.textContent = `${workspace.organization.name} · ${workspace.membership.role}`;
    renderRecommendations(data.recommendations);
    renderRecommendationSources(data.sources);
    renderCommitments(data.commitments);
    renderEvents(data.events);
    renderSources(data.sources);
    show(appView);
    setStatus("");
  } catch (error) {
    show(signInView);
    setStatus(error.message || "Unable to load your organization.", "error");
  }
}

async function start() {
  if (!config.url || !config.publishableKey || config.url.includes("YOUR_PROJECT_REF") || config.publishableKey.includes("YOUR_KEY")) {
    show(setupView);
    setStatus("Copy config.example.js to config.js and add the Supabase URL plus publishable key.");
    return;
  }

  const supabase = createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = new FormData(signInForm).get("email");
    setStatus("Sending magic link…");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    setStatus(error ? error.message : "Magic link sent. Check your inbox.", error ? "error" : "success");
  });

  document.querySelector("#sign-out").addEventListener("click", async () => {
    await supabase.auth.signOut();
    canRecommend = false;
    canReview = false;
    activeOrganizationId = null;
    activeSupabase = null;
    show(signInView);
    setStatus("Signed out.");
  });

  recommendationSourceSelect.addEventListener("change", () => {
    generateRecommendationButton.disabled = !canRecommend || !recommendationSourceSelect.value;
  });

  generateRecommendationButton.addEventListener("click", async () => {
    const sourceDocumentId = recommendationSourceSelect.value;
    if (!sourceDocumentId) return;
    generateRecommendationButton.disabled = true;
    setStatus("Generating a cited recommendation…");
    const { data, error } = await supabase.functions.invoke("recommend-source", {
      body: { source_document_id: sourceDocumentId },
    });
    if (error || data?.error) {
      setStatus(error?.message || data?.error || "Recommendation generation failed.", "error");
      generateRecommendationButton.disabled = false;
      return;
    }
    const refreshed = await loadData(supabase, (await loadWorkspace(supabase, (await supabase.auth.getUser()).data.user.id)).organization.id);
    renderRecommendations(refreshed.recommendations);
    renderRecommendationSources(refreshed.sources);
    setStatus("Recommendation created as proposed and added to the human review queue.", "success");
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    void renderSession(supabase, session);
  });
  const { data: { session } } = await supabase.auth.getSession();
  await renderSession(supabase, session);
}

void start();
