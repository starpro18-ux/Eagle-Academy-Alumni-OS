import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const config = globalThis.EAGLE_SUPABASE_CONFIG ?? {};
const views = {
  setup: document.querySelector("#setup-view"),
  signIn: document.querySelector("#sign-in-view"),
  app: document.querySelector("#app-view"),
};
const status = document.querySelector("#status");
const form = document.querySelector("#sign-in-form");
const sourceList = document.querySelector("#source-list");
const commitmentList = document.querySelector("#commitment-list");
const pulseAttention = document.querySelector("#pulse-attention .pulse-card-value");
const pulseDecisions = document.querySelector("#pulse-decisions .pulse-card-value");
const pulseImpact = document.querySelector("#pulse-impact .pulse-card-value");
const pulseEvidence = document.querySelector("#pulse-evidence .pulse-card-value");
const pulseNextTitle = document.querySelector("#pulse-next-title");
const pulseNextCopy = document.querySelector("#pulse-next-copy");
const pulseNextLink = document.querySelector("#pulse-next-link");

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function show(view) {
  Object.values(views).forEach((candidate) => candidate.classList.toggle("hidden", candidate !== view));
}

function date(value) {
  return value ? new Date(value).toLocaleDateString() : "Date not recorded";
}

function empty(message) {
  const item = document.createElement("li");
  item.className = "empty";
  item.textContent = message;
  return item;
}

async function workspace(supabase, userId) {
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

async function count(supabase, table, organizationId, column, value) {
  let query = supabase.from(table).select("*", { count: "exact", head: true }).eq("organization_id", organizationId);
  if (column) query = query.eq(column, value);
  const { count: total, error } = await query;
  if (error) throw error;
  return total ?? 0;
}

async function activity(supabase, organizationId) {
  const [sources, commitments] = await Promise.all([
    supabase.from("source_documents").select("title, extraction_status, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(5),
    supabase.from("commitments").select("title, status, due_date, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(5),
  ]);
  if (sources.error) throw sources.error;
  if (commitments.error) throw commitments.error;
  return { sources: sources.data ?? [], commitments: commitments.data ?? [] };
}

function renderList(element, items, emptyMessage, getTitle, getMeta) {
  element.replaceChildren();
  if (!items.length) {
    element.append(empty(emptyMessage));
    return;
  }
  for (const item of items) {
    const row = document.createElement("li");
    row.className = "activity-item";
    const title = document.createElement("div");
    title.className = "activity-title";
    title.textContent = getTitle(item);
    const meta = document.createElement("div");
    meta.className = "activity-meta";
    meta.textContent = getMeta(item);
    row.append(title, meta);
    element.append(row);
  }
}

async function leadershipPulse(supabase, organizationId) {
  const [commitments, recommendations, objectives, outcomes, sources] = await Promise.all([
    supabase.from("commitments").select("status, due_date, owner_id").eq("organization_id", organizationId).limit(200),
    supabase.from("recommendations").select("status").eq("organization_id", organizationId).limit(200),
    supabase.from("event_objectives").select("id").eq("organization_id", organizationId).limit(200),
    supabase.from("event_outcomes").select("objective_id").eq("organization_id", organizationId).limit(500),
    supabase.from("source_documents").select("extraction_status").eq("organization_id", organizationId).limit(200),
  ]);
  for (const result of [commitments, recommendations, objectives, outcomes, sources]) {
    if (result.error) throw result.error;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const openCommitments = commitments.data ?? [];
  const attention = openCommitments.filter((item) => {
    if (["completed", "cancelled"].includes(item.status)) return false;
    if (item.status === "blocked" || !item.owner_id || !item.due_date) return true;
    return new Date(`${item.due_date}T00:00:00`) < today;
  }).length;
  const decisionQueue = (recommendations.data ?? []).filter((item) => ["draft", "proposed"].includes(item.status)).length;
  const outcomeIds = new Set((outcomes.data ?? []).map((item) => item.objective_id));
  const impactGaps = (objectives.data ?? []).filter((item) => !outcomeIds.has(item.id)).length;
  const evidenceGaps = (sources.data ?? []).filter((item) => ["pending", "failed"].includes(item.extraction_status)).length;
  return { attention, decisionQueue, impactGaps, evidenceGaps };
}

function renderLeadershipPulse(pulse) {
  pulseAttention.textContent = pulse.attention;
  pulseDecisions.textContent = pulse.decisionQueue;
  pulseImpact.textContent = pulse.impactGaps;
  pulseEvidence.textContent = pulse.evidenceGaps;

  if (pulse.evidenceGaps) {
    pulseNextTitle.textContent = "Move the evidence pipeline";
    pulseNextCopy.textContent = `${pulse.evidenceGaps} source${pulse.evidenceGaps === 1 ? "" : "s"} need extraction or recovery before decisions can be trusted.`;
    pulseNextLink.href = "./ingest.html";
    pulseNextLink.textContent = "Open sources →";
  } else if (pulse.attention) {
    pulseNextTitle.textContent = "Restore follow-through";
    pulseNextCopy.textContent = `${pulse.attention} open commitment${pulse.attention === 1 ? "" : "s"} need ownership, timing, or intervention.`;
    pulseNextLink.href = "./operations.html";
    pulseNextLink.textContent = "Open commitments →";
  } else if (pulse.decisionQueue) {
    pulseNextTitle.textContent = "Review the decision queue";
    pulseNextCopy.textContent = `${pulse.decisionQueue} recommendation${pulse.decisionQueue === 1 ? "" : "s"} are waiting for human judgment.`;
    pulseNextLink.href = "./review.html";
    pulseNextLink.textContent = "Open review →";
  } else if (pulse.impactGaps) {
    pulseNextTitle.textContent = "Close the impact loop";
    pulseNextCopy.textContent = `${pulse.impactGaps} objective${pulse.impactGaps === 1 ? "" : "s"} still need an observed outcome.`;
    pulseNextLink.href = "./events.html";
    pulseNextLink.textContent = "Record outcomes →";
  } else {
    pulseNextTitle.textContent = "The operating loop is clear";
    pulseNextCopy.textContent = "Evidence, decisions, follow-through, and impact are all accounted for.";
    pulseNextLink.href = "./workspace.html";
    pulseNextLink.textContent = "Open workspace →";
  }
}

function renderGuidance(stats) {
  const action = document.querySelector("#next-action");
  const title = document.querySelector("#next-action-title");
  const copy = document.querySelector("#next-action-copy");
  const link = document.querySelector("#next-action-link");
  const hero = document.querySelector("#hero-copy");
  const choices = stats.sources === 0
    ? ["Add your first source", "Upload a meeting note, plan, or transcript.", "./ingest.html", "Start with the material your team already trusts."]
    : stats.pending > 0
      ? ["Move sources forward", `${stats.pending} source${stats.pending === 1 ? "" : "s"} awaiting extraction.`, "./workspace.html", "Your source library is growing. Keep the evidence pipeline moving."]
      : stats.commitments === 0
        ? ["Capture follow-through", "Turn the next agreed action into a visible commitment.", "./operations.html", "The best operating rhythm is visible, owned, and easy to revisit."]
        : stats.events === 0
          ? ["Plan your next event", "Connect an event to objectives and measurable outcomes.", "./events.html", "Move from notes to a plan your team can act on."]
          : ["Open the review queue", "Review decisions and recommendations in one place.", "./review.html", "Human review is where evidence becomes responsible action."];
  title.textContent = choices[0];
  copy.textContent = choices[1];
  link.href = choices[2];
  hero.textContent = choices[3];
  action.classList.remove("hidden");

  const active = [stats.sources, stats.evidence, stats.commitments, stats.events, stats.recommendations].filter(Boolean).length;
  const score = active * 20;
  document.querySelector("#momentum-score").textContent = score;
  document.querySelector("#momentum-bar").style.width = `${score}%`;
  document.querySelector("#momentum-copy").textContent = score ? `${active} of 5 operating signals are active in this workspace.` : "A few useful records will make this view come alive.";
}

async function render(supabase, session) {
  if (!session?.user) {
    show(views.signIn);
    setStatus("Sign in to access your command center.");
    return;
  }

  try {
    setStatus("Loading your command center…");
    const current = await workspace(supabase, session.user.id);
    const id = current.organization.id;
    const [sources, pending, evidence, commitments, events, recommendations, recent] = await Promise.all([
      count(supabase, "source_documents", id),
      count(supabase, "source_documents", id, "extraction_status", "pending"),
      count(supabase, "evidence", id),
      count(supabase, "commitments", id),
      count(supabase, "events", id),
      count(supabase, "recommendations", id),
      activity(supabase, id),
      leadershipPulse(supabase, id),
    ]);
    const stats = { sources, pending, evidence, commitments, events, recommendations };
    document.querySelector("#signed-in-email").textContent = session.user.email || "authenticated user";
    document.querySelector("#organization-name").textContent = `${current.organization.name} · ${current.membership.role}`;
    document.querySelector("#hero-title").textContent = `Your command center for ${current.organization.name}`;
    [["source-count", sources], ["evidence-count", evidence], ["commitment-count", commitments], ["event-count", events], ["recommendation-count", recommendations]].forEach(([id, value]) => { document.querySelector(`#${id}`).textContent = value; });
    renderGuidance(stats);
    renderLeadershipPulse(pulse);
    renderList(sourceList, recent.sources, "No sources yet. Add the first piece of trusted material.", (item) => item.title, (item) => `${item.extraction_status} · ${date(item.created_at)}`);
    renderList(commitmentList, recent.commitments, "No commitments yet. Capture what someone agreed to do.", (item) => item.title, (item) => `${item.status} · due ${date(item.due_date)}`);
    show(views.app);
    setStatus("");
  } catch (error) {
    show(views.signIn);
    setStatus(error.message || "Unable to load your organization.", "error");
  }
}

async function start() {
  if (!config.url || !config.publishableKey || config.url.includes("YOUR_PROJECT_REF") || config.publishableKey.includes("YOUR_KEY")) {
    show(views.setup);
    setStatus("Copy config.example.js to config.js and add the Supabase URL plus publishable key.");
    return;
  }
  const supabase = createClient(config.url, config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = new FormData(form).get("email");
    setStatus("Sending magic link…");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    setStatus(error ? error.message : "Magic link sent. Check your inbox.", error ? "error" : "success");
  });
  document.querySelector("#sign-out").addEventListener("click", async () => {
    await supabase.auth.signOut();
    show(views.signIn);
    setStatus("Signed out.");
  });
  supabase.auth.onAuthStateChange((_event, session) => void render(supabase, session));
  const { data: { session } } = await supabase.auth.getSession();
  await render(supabase, session);
}

void start();
