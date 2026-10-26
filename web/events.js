import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const config = globalThis.EAGLE_SUPABASE_CONFIG ?? {};
const setupView = document.querySelector("#setup-view");
const signInView = document.querySelector("#sign-in-view");
const appView = document.querySelector("#app-view");
const status = document.querySelector("#status");
const signInForm = document.querySelector("#sign-in-form");
const signedInEmail = document.querySelector("#signed-in-email");
const organizationName = document.querySelector("#organization-name");
const eventList = document.querySelector("#event-list");
const eventForm = document.querySelector("#event-form");
const writeSurface = document.querySelector("[data-write-surface]");
const viewerNote = document.querySelector("#viewer-note");
let organizationId = null;
let currentSession = null;
let writeEnabled = false;

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function show(view) {
  for (const candidate of [setupView, signInView, appView]) {
    candidate.classList.toggle("hidden", candidate !== view);
  }
}

function formatDate(value, fallback = "Date not recorded") {
  return value ? new Date(value).toLocaleString() : fallback;
}

function tag(text) {
  const element = document.createElement("span");
  element.className = `tag ${String(text || "").replace(/[^a-z0-9_-]/gi, "").toLowerCase()}`.trim();
  element.textContent = text || "unknown";
  return element;
}

function setWriteAccess(role) {
  writeEnabled = ["owner", "leader", "committee_lead", "contributor"].includes(role);
  writeSurface.classList.toggle("hidden", !writeEnabled);
  viewerNote.classList.toggle("hidden", writeEnabled);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function emptyItem(message) {
  const item = document.createElement("p");
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
  const [events, objectives, outcomes] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, description, starts_at, ends_at, status")
      .eq("organization_id", organizationId)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from("event_objectives")
      .select("id, event_id, name, target, unit, measurement_method")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("event_outcomes")
      .select("id, event_id, objective_id, actual, narrative, source_evidence_id, reviewed_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);
  if (events.error) throw events.error;
  if (objectives.error) throw objectives.error;
  if (outcomes.error) throw outcomes.error;
  return { events: events.data ?? [], objectives: objectives.data ?? [], outcomes: outcomes.data ?? [] };
}

function formatTarget(objective) {
  if (objective.target === null || objective.target === undefined) return "Target not set";
  return `Target: ${objective.target}${objective.unit ? ` ${objective.unit}` : ""}`;
}

function renderEvents(data) {
  eventList.replaceChildren();
  if (!data.events.length) {
    eventList.append(emptyItem("No events have been recorded yet."));
    return;
  }

  const objectivesByEvent = new Map();
  for (const objective of data.objectives) {
    const items = objectivesByEvent.get(objective.event_id) ?? [];
    items.push(objective);
    objectivesByEvent.set(objective.event_id, items);
  }
  const outcomesByObjective = new Map();
  for (const outcome of data.outcomes) {
    if (!outcomesByObjective.has(outcome.objective_id)) outcomesByObjective.set(outcome.objective_id, outcome);
  }

  for (const event of data.events) {
    const article = document.createElement("article");
    article.className = "event-item";
    const top = document.createElement("div");
    top.className = "event-top";
    const details = document.createElement("div");
    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = event.name;
    const meta = document.createElement("div");
    meta.className = "event-meta";
    meta.textContent = `${formatDate(event.starts_at)} · ${event.ends_at ? `ends ${formatDate(event.ends_at)}` : "end date not recorded"}`;
    details.append(title, meta);
    top.append(details, tag(event.status));
    article.append(top);
    if (event.description) {
      const description = document.createElement("p");
      description.className = "event-description";
      description.textContent = event.description;
      article.append(description);
    }

    const objectives = objectivesByEvent.get(event.id) ?? [];
    if (!objectives.length) {
      article.append(emptyItem("No objectives have been recorded for this event."));
    } else {
      const list = document.createElement("ul");
      list.className = "objective-list";
      for (const objective of objectives) {
        const item = document.createElement("li");
        item.className = "objective-item";
        const objectiveDetails = document.createElement("div");
        const name = document.createElement("div");
        name.className = "objective-name";
        name.textContent = objective.name;
        const target = document.createElement("div");
        target.className = "objective-meta";
        target.textContent = `${formatTarget(objective)}${objective.measurement_method ? ` · ${objective.measurement_method}` : ""}`;
        objectiveDetails.append(name, target);
        const outcome = document.createElement("div");
        outcome.className = "outcome";
        const recorded = outcomesByObjective.get(objective.id);
        if (recorded?.actual !== null && recorded?.actual !== undefined) {
          const actual = document.createElement("strong");
          actual.textContent = `${recorded.actual}${objective.unit ? ` ${objective.unit}` : ""}`;
          outcome.append(actual);
        }
        const label = document.createElement("span");
        label.textContent = recorded ? (recorded.reviewed_at ? "Reviewed outcome" : "Recorded outcome") : "No outcome yet";
        outcome.append(label);
        item.append(objectiveDetails, outcome);
        list.append(item);
      }
      article.append(list);
    }
    eventList.append(article);
  }
}

async function renderSession(supabase, session) {
  if (!session?.user) {
    show(signInView);
    setStatus("Sign in to access events and outcomes.");
    return;
  }

  try {
    setStatus("Loading organization impact…");
    currentSession = session;
    const workspace = await loadWorkspace(supabase, session.user.id);
    organizationId = workspace.organization.id;
    const data = await loadData(supabase, organizationId);
    signedInEmail.textContent = session.user.email || "authenticated user";
    organizationName.textContent = `${workspace.organization.name} · ${workspace.membership.role}`;
    setWriteAccess(workspace.membership.role);
    renderEvents(data);
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

  eventForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!writeEnabled) return setStatus("Viewer access cannot create events.", "error");
    const values = new FormData(eventForm);
    const name = String(values.get("name") || "").trim();
    const description = String(values.get("description") || "").trim() || null;
    const startsAt = toIso(String(values.get("starts_at") || ""));
    const endsAt = toIso(String(values.get("ends_at") || ""));
    const objectiveName = String(values.get("objective_name") || "").trim();
    const targetValue = String(values.get("target") || "").trim();
    const target = targetValue ? Number(targetValue) : null;
    const unit = String(values.get("unit") || "").trim() || null;
    const measurementMethod = String(values.get("measurement_method") || "").trim() || null;
    if (targetValue && !Number.isFinite(target)) return setStatus("Objective target must be a valid number.", "error");
    setStatus("Creating event plan…");
    const { data: createdEvent, error: eventError } = await supabase.from("events").insert({
      organization_id: organizationId,
      name,
      description,
      starts_at: startsAt,
      ends_at: endsAt,
      status: "idea",
    }).select("id").single();
    if (eventError) return setStatus(eventError.message, "error");
    if (objectiveName) {
      const { error: objectiveError } = await supabase.from("event_objectives").insert({
        organization_id: organizationId,
        event_id: createdEvent.id,
        name: objectiveName,
        target,
        unit,
        measurement_method: measurementMethod,
      });
      if (objectiveError) return setStatus(objectiveError.message, "error");
    }
    eventForm.reset();
    await renderSession(supabase, currentSession);
    setStatus("Event plan created.", "success");
  });

  document.querySelector("#sign-out").addEventListener("click", async () => {
    await supabase.auth.signOut();
    show(signInView);
    setStatus("Signed out.");
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    void renderSession(supabase, session);
  });
  const { data: { session } } = await supabase.auth.getSession();
  await renderSession(supabase, session);
}

void start();
