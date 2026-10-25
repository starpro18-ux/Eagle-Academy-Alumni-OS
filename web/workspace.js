import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const config = globalThis.EAGLE_SUPABASE_CONFIG ?? {};
const setupView = document.querySelector("#setup-view");
const signInView = document.querySelector("#sign-in-view");
const appView = document.querySelector("#app-view");
const status = document.querySelector("#status");
const signInForm = document.querySelector("#sign-in-form");
const sourceList = document.querySelector("#source-list");
const signedInEmail = document.querySelector("#signed-in-email");
const organizationName = document.querySelector("#organization-name");
const sourceCount = document.querySelector("#source-count");
const pendingCount = document.querySelector("#pending-count");
const evidenceCount = document.querySelector("#evidence-count");
const commitmentCount = document.querySelector("#commitment-count");
const recommendationCount = document.querySelector("#recommendation-count");

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function show(view) {
  for (const candidate of [setupView, signInView, appView]) {
    candidate.classList.toggle("hidden", candidate !== view);
  }
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

async function count(supabase, table, organizationId, extraColumn, extraValue) {
  let query = supabase.from(table).select("*", { count: "exact", head: true }).eq("organization_id", organizationId);
  if (extraColumn) query = query.eq(extraColumn, extraValue);
  const { count: total, error } = await query;
  if (error) throw error;
  return total ?? 0;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Unknown date";
}

async function loadSources(supabase, organizationId) {
  const { data, error } = await supabase
    .from("source_documents")
    .select("id, title, mime_type, extraction_status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;

  sourceList.replaceChildren();
  if (!data?.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No sources yet. Add the first source document to begin the evidence pipeline.";
    sourceList.append(empty);
    return;
  }

  for (const source of data) {
    const item = document.createElement("li");
    item.className = "source-item";
    const title = document.createElement("div");
    title.className = "source-title";
    title.textContent = source.title;
    const meta = document.createElement("div");
    meta.className = "source-meta";
    meta.textContent = `${source.extraction_status} · ${source.mime_type || "unknown"} · ${formatDate(source.created_at)}`;
    item.append(title, meta);
    sourceList.append(item);
  }
}

async function renderSession(supabase, session) {
  if (!session?.user) {
    show(signInView);
    setStatus("Sign in to access the protected workspace.");
    return;
  }

  try {
    setStatus("Loading organization workspace…");
    const workspace = await loadWorkspace(supabase, session.user.id);
    signedInEmail.textContent = session.user.email || "authenticated user";
    organizationName.textContent = `${workspace.organization.name} · ${workspace.membership.role}`;
    const [sources, pending, evidence, commitments, recommendations] = await Promise.all([
      count(supabase, "source_documents", workspace.organization.id),
      count(supabase, "source_documents", workspace.organization.id, "extraction_status", "pending"),
      count(supabase, "evidence", workspace.organization.id),
      count(supabase, "commitments", workspace.organization.id),
      count(supabase, "recommendations", workspace.organization.id),
    ]);
    sourceCount.textContent = sources;
    pendingCount.textContent = pending;
    evidenceCount.textContent = evidence;
    commitmentCount.textContent = commitments;
    recommendationCount.textContent = recommendations;
    await loadSources(supabase, workspace.organization.id);
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
