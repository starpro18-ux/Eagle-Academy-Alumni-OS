import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const config = globalThis.EAGLE_SUPABASE_CONFIG ?? {};
const setupView = document.querySelector("#setup-view");
const signInView = document.querySelector("#sign-in-view");
const appView = document.querySelector("#app-view");
const status = document.querySelector("#status");
const signInForm = document.querySelector("#sign-in-form");
const signedInEmail = document.querySelector("#signed-in-email");
const organizationName = document.querySelector("#organization-name");
const peopleList = document.querySelector("#people-list");
const commitmentList = document.querySelector("#commitment-list");
const personForm = document.querySelector("#person-form");
const commitmentForm = document.querySelector("#commitment-form");
const ownerSelect = document.querySelector("#commitment-owner");
const writeSurface = document.querySelector("[data-write-surface]");
const viewerNote = document.querySelector("#viewer-note");
const attentionCount = document.querySelector("#attention-count");
const overdueCount = document.querySelector("#overdue-count");
const blockedCount = document.querySelector("#blocked-count");
const unassignedCount = document.querySelector("#unassigned-count");
const dueSoonCount = document.querySelector("#due-soon-count");
const accountabilityCopy = document.querySelector("#accountability-copy");
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

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "No due date";
}

function tag(text) {
  const element = document.createElement("span");
  element.className = `tag ${String(text || "").replace(/[^a-z0-9_-]/gi, "").toLowerCase()}`.trim();
  element.textContent = text || "unknown";
  return element;
}

function renderOwnerOptions(people) {
  ownerSelect.replaceChildren();
  const unassigned = document.createElement("option");
  unassigned.value = "";
  unassigned.textContent = "Unassigned";
  ownerSelect.append(unassigned);
  for (const person of people) {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.display_name;
    ownerSelect.append(option);
  }
}

function setWriteAccess(role) {
  writeEnabled = ["owner", "leader", "committee_lead", "contributor"].includes(role);
  writeSurface.classList.toggle("hidden", !writeEnabled);
  viewerNote.classList.toggle("hidden", writeEnabled);
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
  const [people, commitments] = await Promise.all([
    supabase
      .from("people")
      .select("id, display_name, email, active")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("display_name", { ascending: true }),
    supabase
      .from("commitments")
      .select("id, title, due_date, status, owner_id, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (people.error) throw people.error;
  if (commitments.error) throw commitments.error;
  return { people: people.data ?? [], commitments: commitments.data ?? [] };
}

function renderPeople(items) {
  peopleList.replaceChildren();
  if (!items.length) {
    peopleList.append(emptyItem("No active people have been added yet."));
    return;
  }

  for (const person of items) {
    const item = document.createElement("li");
    item.className = "person-item";
    const details = document.createElement("div");
    const name = document.createElement("div");
    name.className = "person-name";
    name.textContent = person.display_name;
    const email = document.createElement("div");
    email.className = "person-email";
    email.textContent = person.email || "No email recorded";
    details.append(name, email);
    item.append(details, tag("active"));
    peopleList.append(item);
  }
}

const COMMITMENT_STATUSES = ["proposed", "accepted", "in_progress", "completed", "blocked", "cancelled"];

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function commitmentHealth(commitment) {
  if (["completed", "cancelled"].includes(commitment.status)) return { label: "Closed", className: "completed", attention: false };
  if (commitment.status === "blocked") return { label: "Blocked", className: "blocked", attention: true };
  if (!commitment.owner_id) return { label: "Unassigned", className: "unassigned", attention: true };
  if (!commitment.due_date) return { label: "No due date", className: "no-due-date", attention: true };
  const due = new Date(`${commitment.due_date}T00:00:00`);
  const daysUntilDue = Math.ceil((due.getTime() - startOfToday().getTime()) / 86400000);
  if (daysUntilDue < 0) return { label: "Overdue", className: "overdue", attention: true };
  if (daysUntilDue <= 7) return { label: "Due soon", className: "due-soon", attention: true };
  return { label: "On track", className: "on-track", attention: false };
}

function renderAccountabilityPulse(items) {
  const open = items.filter((item) => !["completed", "cancelled"].includes(item.status));
  const health = open.map(commitmentHealth);
  const overdue = health.filter((item) => item.className === "overdue").length;
  const blocked = health.filter((item) => item.className === "blocked").length;
  const unassigned = health.filter((item) => item.className === "unassigned").length;
  const dueSoon = health.filter((item) => item.className === "due-soon").length;
  const attention = health.filter((item) => item.attention).length;
  attentionCount.textContent = attention;
  overdueCount.textContent = overdue;
  blockedCount.textContent = blocked;
  unassignedCount.textContent = unassigned;
  dueSoonCount.textContent = dueSoon;
  accountabilityCopy.textContent = attention
    ? `${attention} open commitment${attention === 1 ? "" : "s"} need clearer ownership, timing, or intervention.`
    : open.length
      ? "Open commitments have an owner, a date, and no current blockers."
      : "Add a commitment to see the organization’s follow-through health.";
}

function renderCommitmentEditor(commitment, item, people, supabase) {
  const currentEditor = item.querySelector(".commitment-edit-form");
  if (currentEditor) {
    currentEditor.remove();
    return;
  }

  const form = document.createElement("form");
  form.className = "commitment-edit-form";
  form.setAttribute("aria-label", `Edit commitment: ${commitment.title}`);

  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Commitment";
  const titleInput = document.createElement("input");
  titleInput.name = "title";
  titleInput.required = true;
  titleInput.maxLength = 240;
  titleInput.value = commitment.title;
  titleLabel.append(titleInput);

  const ownerLabel = document.createElement("label");
  ownerLabel.textContent = "Owner";
  const ownerInput = document.createElement("select");
  ownerInput.name = "owner_id";
  const unassigned = document.createElement("option");
  unassigned.value = "";
  unassigned.textContent = "Unassigned";
  ownerInput.append(unassigned);
  for (const person of people) {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.display_name;
    option.selected = person.id === commitment.owner_id;
    ownerInput.append(option);
  }
  ownerLabel.append(ownerInput);

  const dueLabel = document.createElement("label");
  dueLabel.textContent = "Due date";
  const dueInput = document.createElement("input");
  dueInput.type = "date";
  dueInput.name = "due_date";
  dueInput.value = commitment.due_date || "";
  dueLabel.append(dueInput);

  const statusLabel = document.createElement("label");
  statusLabel.textContent = "Status";
  const statusInput = document.createElement("select");
  statusInput.name = "status";
  for (const status of COMMITMENT_STATUSES) {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status.replace("_", " ");
    option.selected = status === commitment.status;
    statusInput.append(option);
  }
  statusLabel.append(statusInput);

  const actions = document.createElement("div");
  actions.className = "commitment-edit-actions";
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "primary";
  saveButton.textContent = "Save commitment";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "secondary";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => form.remove());
  actions.append(saveButton, cancelButton);

  form.append(titleLabel, ownerLabel, dueLabel, statusLabel, actions);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      setStatus("A commitment title is required.", "error");
      titleInput.focus();
      return;
    }

    saveButton.disabled = true;
    setStatus("Saving commitment…");
    const { data, error } = await supabase.functions.invoke("update-commitment", {
      body: {
        commitment_id: commitment.id,
        title,
        owner_id: ownerInput.value || null,
        due_date: dueInput.value || null,
        status: statusInput.value,
      },
    });
    if (error || data?.error) {
      saveButton.disabled = false;
      setStatus(error?.message || data?.error || "Commitment update failed.", "error");
      return;
    }

    await renderSession(supabase, currentSession);
    setStatus("Commitment details updated and logged.", "success");
  });
  item.append(form);
  titleInput.focus();
}

function renderCommitments(items, people, supabase) {
  const names = new Map(people.map((person) => [person.id, person.display_name]));
  commitmentList.replaceChildren();
  renderAccountabilityPulse(items);
  if (!items.length) {
    commitmentList.append(emptyItem("No commitments have been recorded yet."));
    return;
  }

  for (const commitment of items) {
    const item = document.createElement("li");
    item.className = "commitment-item";
    const top = document.createElement("div");
    top.className = "commitment-top";
    const title = document.createElement("div");
    title.className = "commitment-title";
    title.textContent = commitment.title;
    const topActions = document.createElement("div");
    topActions.className = "commitment-actions";
    const health = commitmentHealth(commitment);
    topActions.append(tag(commitment.status));
    if (writeEnabled) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "secondary commitment-edit-button";
      editButton.textContent = "Edit";
      editButton.setAttribute("aria-label", `Edit commitment: ${commitment.title}`);
      editButton.addEventListener("click", () => renderCommitmentEditor(commitment, item, people, supabase));
      topActions.append(editButton);
    }
    top.append(title, topActions);
    const meta = document.createElement("div");
    meta.className = "commitment-meta";
    const owner = names.get(commitment.owner_id) || (commitment.owner_id ? "Owner not in active roster" : "Unassigned");
    meta.textContent = `${owner} · due ${formatDate(commitment.due_date)}`;

    const healthRow = document.createElement("div");
    healthRow.className = "commitment-health";
    healthRow.append(tag(health.label));
    const statusSelect = document.createElement("select");
    statusSelect.className = "status-control";
    statusSelect.setAttribute("aria-label", `Update status for ${commitment.title}`);
    for (const status of COMMITMENT_STATUSES) {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status.replace("_", " ");
      option.selected = status === commitment.status;
      statusSelect.append(option);
    }
    statusSelect.disabled = !writeEnabled;
    statusSelect.addEventListener("change", async () => {
      const nextStatus = statusSelect.value;
      statusSelect.disabled = true;
      setStatus("Updating commitment status…");
      const { data, error } = await supabase.functions.invoke("update-commitment", {
        body: { commitment_id: commitment.id, status: nextStatus },
      });
      if (error || data?.error) {
        statusSelect.value = commitment.status;
        statusSelect.disabled = !writeEnabled;
        setStatus(error?.message || data?.error || "Commitment update failed.", "error");
        return;
      }
      await renderSession(supabase, currentSession);
      setStatus("Commitment status updated and logged.", "success");
    });
    healthRow.append(statusSelect);
    item.append(top, meta, healthRow);
    commitmentList.append(item);
  }
}

async function renderSession(supabase, session) {
  if (!session?.user) {
    show(signInView);
    setStatus("Sign in to access people and commitments.");
    return;
  }

  try {
    setStatus("Loading organization operations…");
    currentSession = session;
    const workspace = await loadWorkspace(supabase, session.user.id);
    organizationId = workspace.organization.id;
    const data = await loadData(supabase, organizationId);
    signedInEmail.textContent = session.user.email || "authenticated user";
    organizationName.textContent = `${workspace.organization.name} · ${workspace.membership.role}`;
    renderOwnerOptions(data.people);
    setWriteAccess(workspace.membership.role);
    renderPeople(data.people);
    renderCommitments(data.commitments, data.people, supabase);
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

  personForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!writeEnabled) return setStatus("Viewer access cannot create people.", "error");
    const values = new FormData(personForm);
    const displayName = String(values.get("display_name") || "").trim();
    const email = String(values.get("email") || "").trim() || null;
    setStatus("Adding person…");
    const { error } = await supabase.from("people").insert({
      organization_id: organizationId,
      display_name: displayName,
      email,
    });
    if (error) return setStatus(error.message, "error");
    personForm.reset();
    await renderSession(supabase, currentSession);
    setStatus("Person added.", "success");
  });

  commitmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!writeEnabled) return setStatus("Viewer access cannot create commitments.", "error");
    const values = new FormData(commitmentForm);
    const title = String(values.get("title") || "").trim();
    const ownerId = String(values.get("owner_id") || "") || null;
    const dueDate = String(values.get("due_date") || "") || null;
    setStatus("Adding commitment…");
    const { error } = await supabase.from("commitments").insert({
      organization_id: organizationId,
      title,
      owner_id: ownerId,
      due_date: dueDate,
      status: "proposed",
    });
    if (error) return setStatus(error.message, "error");
    commitmentForm.reset();
    await renderSession(supabase, currentSession);
    setStatus("Commitment added.", "success");
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
