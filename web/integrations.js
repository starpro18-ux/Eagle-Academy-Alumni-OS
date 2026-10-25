import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const config = globalThis.EAGLE_SUPABASE_CONFIG ?? {};
const setupView = document.querySelector("#setup-view");
const signInView = document.querySelector("#sign-in-view");
const appView = document.querySelector("#app-view");
const status = document.querySelector("#status");
const signInForm = document.querySelector("#sign-in-form");
const signedInEmail = document.querySelector("#signed-in-email");
const organizationName = document.querySelector("#organization-name");
const connectorList = document.querySelector("#connector-list");
const syncList = document.querySelector("#sync-list");

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
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function tag(text) {
  const element = document.createElement("span");
  element.className = `tag ${String(text || "").replace(/[^a-z0-9_-]/gi, "").toLowerCase()}`.trim();
  element.textContent = text || "unknown";
  return element;
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
  const [connectors, runs] = await Promise.all([
    supabase
      .from("connector_accounts")
      .select("id, provider, display_name, status, scopes, updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("sync_runs")
      .select("id, provider, status, started_at, finished_at, items_seen, items_imported, items_failed, error_summary")
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .limit(12),
  ]);
  if (connectors.error) throw connectors.error;
  if (runs.error) throw runs.error;
  return { connectors: connectors.data ?? [], runs: runs.data ?? [] };
}

function renderConnectors(items) {
  connectorList.replaceChildren();
  if (!items.length) {
    connectorList.append(emptyItem("No connector accounts yet. Manual uploads are available from the workspace."));
    return;
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "integration-item";
    const name = document.createElement("div");
    name.className = "integration-name";
    name.textContent = item.display_name || item.provider;
    const meta = document.createElement("div");
    meta.className = "integration-meta";
    meta.append(tag(item.provider), tag(item.status));
    if (item.updated_at) meta.append(tag(`Updated ${formatDate(item.updated_at)}`));
    card.append(name, meta);
    connectorList.append(card);
  }
}

function renderRuns(items) {
  syncList.replaceChildren();
  if (!items.length) {
    syncList.append(emptyItem("No sync runs yet."));
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "sync-item";
    const main = document.createElement("div");
    main.className = "sync-main";
    main.textContent = item.provider;
    const meta = document.createElement("div");
    meta.className = "sync-meta";
    meta.textContent = `${item.status} · ${item.items_imported}/${item.items_seen} imported · ${formatDate(item.started_at)}${item.error_summary ? ` · ${item.error_summary}` : ""}`;
    li.append(main, meta);
    syncList.append(li);
  }
}

async function renderSession(supabase, session) {
  if (!session?.user) {
    show(signInView);
    setStatus("Sign in to access integrations.");
    return;
  }

  try {
    setStatus("Loading integration status…");
    const workspace = await loadWorkspace(supabase, session.user.id);
    const data = await loadData(supabase, workspace.organization.id);
    signedInEmail.textContent = session.user.email || "authenticated user";
    organizationName.textContent = `${workspace.organization.name} · ${workspace.membership.role}`;
    renderConnectors(data.connectors);
    renderRuns(data.runs);
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
