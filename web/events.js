import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const config = globalThis.EAGLE_SUPABASE_CONFIG ?? {};
const EVENT_STATUSES = ["idea", "planning", "approved", "completed", "cancelled"];
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
const outcomePanel = document.querySelector("#outcome-panel");
const outcomeForm = document.querySelector("#outcome-form");
const outcomeEventSelect = document.querySelector("#outcome-event");
const outcomeObjectiveSelect = document.querySelector("#outcome-objective");
const outcomeEvidenceSelect = document.querySelector("#outcome-evidence");
let organizationId = null;
let currentSession = null;
let writeEnabled = false;
let currentImpactData = { events: [], objectives: [], outcomes: [], evidence: [] };

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
  outcomePanel.classList.toggle("hidden", !writeEnabled);
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
  const [events, objectives, outcomes, evidence] = await Promise.all([
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
    supabase
      .from("evidence")
      .select("id, claim, observed_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (events.error) throw events.error;
  if (objectives.error) throw objectives.error;
  if (outcomes.error) throw outcomes.error;
  if (evidence.error) throw evidence.error;
  return { events: events.data ?? [], objectives: objectives.data ?? [], outcomes: outcomes.data ?? [], evidence: evidence.data ?? [] };
}

function formatTarget(objective) {
  if (objective.target === null || objective.target === undefined) return "Target not set";
  return `Target: ${objective.target}${objective.unit ? ` ${objective.unit}` : ""}`;
}

function renderOutcomeObjectives(data) {
  const eventId = outcomeEventSelect.value;
  outcomeObjectiveSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = eventId ? "Choose an objective" : "Choose an event first";
  outcomeObjectiveSelect.append(placeholder);
  const objectives = data.objectives.filter((objective) => objective.event_id === eventId);
  for (const objective of objectives) {
    const option = document.createElement("option");
    option.value = objective.id;
    option.textContent = objective.name;
    outcomeObjectiveSelect.append(option);
  }
  outcomeObjectiveSelect.disabled = !eventId || !objectives.length;
}

function renderOutcomeForm(data) {
  currentImpactData = data;
  const previousEventId = outcomeEventSelect.value;
  outcomeEventSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = data.events.length ? "Choose an event" : "Create an event first";
  outcomeEventSelect.append(placeholder);
  for (const event of data.events) {
    const option = document.createElement("option");
    option.value = event.id;
    option.textContent = event.name;
    option.selected = event.id === previousEventId;
    outcomeEventSelect.append(option);
  }
  outcomeEventSelect.disabled = !data.events.length;
  outcomeEvidenceSelect.replaceChildren();
  const noEvidence = document.createElement("option");
  noEvidence.value = "";
  noEvidence.textContent = data.evidence.length ? "No evidence attached" : "No extracted evidence available";
  outcomeEvidenceSelect.append(noEvidence);
  for (const evidence of data.evidence) {
    const option = document.createElement("option");
    option.value = evidence.id;
    option.textContent = String(evidence.claim || "Evidence record").slice(0, 140);
    outcomeEvidenceSelect.append(option);
  }
  renderOutcomeObjectives(data);
}

function outcomeSignal(objective, outcome) {
  if (!outcome) return { label: "No outcome yet", className: "unreviewed" };
  if (outcome.actual === null || outcome.actual === undefined || objective.target === null || objective.target === undefined) {
    return { label: outcome.reviewed_at ? "Reviewed outcome" : "Unreviewed outcome", className: outcome.reviewed_at ? "on-track" : "unreviewed" };
  }
  return Number(outcome.actual) >= Number(objective.target)
    ? { label: "On track", className: "on-track" }
    : { label: "Below target", className: "below-target" };
}

function dateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderEventEditor(event, article, supabase) {
  const existing = article.querySelector(".event-edit-form");
  if (existing) {
    existing.remove();
    return;
  }

  const form = document.createElement("form");
  form.className = "event-edit-form";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Event name";
  const nameInput = document.createElement("input");
  nameInput.name = "name";
  nameInput.required = true;
  nameInput.maxLength = 180;
  nameInput.value = event.name;
  nameLabel.append(nameInput);
  const descriptionLabel = document.createElement("label");
  descriptionLabel.textContent = "Description";
  const descriptionInput = document.createElement("textarea");
  descriptionInput.name = "description";
  descriptionInput.maxLength = 2000;
  descriptionInput.placeholder = "What is this event meant to accomplish?";
  descriptionInput.value = event.description || "";
  descriptionLabel.append(descriptionInput);
  const schedule = document.createElement("div");
  schedule.className = "create-form";
  schedule.style.gridTemplateColumns = "1fr 1fr";
  schedule.style.marginTop = "0";
  const startLabel = document.createElement("label");
  startLabel.textContent = "Starts at";
  const startInput = document.createElement("input");
  startInput.type = "datetime-local";
  startInput.name = "starts_at";
  startInput.value = dateTimeLocal(event.starts_at);
  startLabel.append(startInput);
  const endLabel = document.createElement("label");
  endLabel.textContent = "Ends at";
  const endInput = document.createElement("input");
  endInput.type = "datetime-local";
  endInput.name = "ends_at";
  endInput.value = dateTimeLocal(event.ends_at);
  endLabel.append(endInput);
  schedule.append(startLabel, endLabel);
  const statusLabel = document.createElement("label");
  statusLabel.textContent = "Status";
  const statusSelect = document.createElement("select");
  statusSelect.name = "status";
  for (const status of EVENT_STATUSES) {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status.replace("_", " ");
    option.selected = status === event.status;
    statusSelect.append(option);
  }
  statusLabel.append(statusSelect);
  const actions = document.createElement("div");
  actions.className = "event-edit-actions";
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "primary";
  save.textContent = "Save changes →";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "text-button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => form.remove());
  actions.append(save, cancel);
  form.append(nameLabel, descriptionLabel, schedule, statusLabel, actions);
  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    save.disabled = true;
    setStatus("Saving event changes…");
    const payload = {
      event_id: event.id,
      name: nameInput.value.trim(),
      description: descriptionInput.value.trim() || null,
      starts_at: toIso(startInput.value),
      ends_at: toIso(endInput.value),
      status: statusSelect.value,
    };
    const { data, error } = await supabase.functions.invoke("update-event", { body: payload });
    if (error || data?.error) {
      setStatus(error?.message || data?.error || "Event update failed.", "error");
      save.disabled = false;
      return;
    }
    await renderSession(supabase, currentSession);
    setStatus("Event updated and logged.", "success");
  });
  article.append(form);
}

function renderEvents(data, supabase) {
  eventList.replaceChildren();
  renderOutcomeForm(data);
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
    const eventActions = document.createElement("div");
    eventActions.className = "event-actions";
    eventActions.append(tag(event.status));
    if (writeEnabled) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "secondary";
      editButton.textContent = "Edit event";
      editButton.addEventListener("click", () => renderEventEditor(event, article, supabase));
      eventActions.append(editButton);
    }
    top.append(details, eventActions);
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
        const signal = outcomeSignal(objective, recorded);
        const label = document.createElement("span");
        label.className = `outcome-status ${signal.className}`;
        label.textContent = signal.label;
        outcome.append(label);
        if (recorded?.source_evidence_id) {
          const evidence = data.evidence.find((item) => item.id === recorded.source_evidence_id);
          const evidenceLabel = document.createElement("span");
          evidenceLabel.className = "outcome-evidence";
          evidenceLabel.textContent = evidence ? `Evidence: ${String(evidence.claim || "").slice(0, 120)}` : "Evidence attached";
          outcome.append(evidenceLabel);
        }
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
    renderEvents(data, supabase);
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

  outcomeEventSelect.addEventListener("change", () => renderOutcomeObjectives(currentImpactData));

  outcomeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!writeEnabled) return setStatus("Viewer access cannot record outcomes.", "error");
    const values = new FormData(outcomeForm);
    const eventId = String(values.get("event_id") || "");
    const objectiveId = String(values.get("objective_id") || "");
    const actualValue = String(values.get("actual") || "").trim();
    const actual = actualValue ? Number(actualValue) : null;
    const narrative = String(values.get("narrative") || "").trim();
    const sourceEvidenceId = String(values.get("source_evidence_id") || "") || null;
    if (actualValue && !Number.isFinite(actual)) return setStatus("Actual result must be a valid number.", "error");
    setStatus("Recording outcome…");
    const { data, error } = await supabase.functions.invoke("record-event-outcome", {
      body: { event_id: eventId, objective_id: objectiveId, actual, narrative, source_evidence_id: sourceEvidenceId },
    });
    if (error || data?.error) return setStatus(error?.message || data?.error || "Outcome recording failed.", "error");
    outcomeForm.reset();
    await renderSession(supabase, currentSession);
    setStatus("Outcome recorded. It remains unreviewed until a leader validates it.", "success");
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
