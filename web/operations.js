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

function renderCommitments(items, people) {
  const names = new Map(people.map((person) => [person.id, person.display_name]));
  commitmentList.replaceChildren();
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
    top.append(title, tag(commitment.status));
    const meta = document.createElement("div");
    meta.className = "commitment-meta";
    const owner = names.get(commitment.owner_id) || (commitment.owner_id ? "Owner not in active roster" : "Unassigned");
    meta.textContent = `${owner} · due ${formatDate(commitment.due_date)}`;
    item.append(top, meta);
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
    renderCommitments(data.commitments, data.people);
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
