import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const config = globalThis.EAGLE_SUPABASE_CONFIG || {};
const setupView = document.querySelector("#setup-view");
const signInView = document.querySelector("#sign-in-view");
const bootstrapView = document.querySelector("#bootstrap-view");
const status = document.querySelector("#status");
const signInForm = document.querySelector("#sign-in-form");
const passwordForm = document.querySelector("#password-form");
const bootstrapForm = document.querySelector("#bootstrap-form");
const signedInEmail = document.querySelector("#signed-in-email");
const signOutButton = document.querySelector("#sign-out");
const nextActions = document.querySelector("#next-actions");

let supabase;

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function show(view) {
  [setupView, signInView, bootstrapView].forEach((element) => {
    element.classList.toggle("hidden", element !== view);
  });
}

async function renderSession(session) {
  if (!session) {
    show(signInView);
    nextActions.classList.add("hidden");
    return;
  }

  signedInEmail.textContent = session.user.email || "authenticated user";
  show(bootstrapView);

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", session.user.id)
    .limit(1);

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  if (memberships?.length) {
    nextActions.classList.remove("hidden");
    setStatus("Your workspace already exists. Continue to the protected workspace.", "success");
  } else {
    nextActions.classList.add("hidden");
  }
}

async function boot() {
  if (!config.url || !config.publishableKey || config.url.includes("YOUR_PROJECT_REF")) {
    show(setupView);
    return;
  }

  supabase = createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    void renderSession(session);
  });
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setStatus(error.message, "error");
    show(signInView);
    return;
  }
  await renderSession(data.session);
}

signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = new FormData(signInForm).get("email");
  setStatus("Sending your magic link…");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });
  if (error) {
    setStatus(error.message, "error");
    return;
  }
  setStatus("Check your inbox for the sign-in link.", "success");
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(passwordForm);
  setStatus("Signing in with your confirmed pilot account…");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (error) {
    setStatus(error.message, "error");
    return;
  }
  await renderSession(data.session);
});

bootstrapForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(bootstrapForm);
  setStatus("Creating your owner workspace…");
  const { data, error } = await supabase.rpc("bootstrap_organization", {
    org_name: form.get("org_name"),
    org_slug: form.get("org_slug"),
  });
  if (error) {
    setStatus(error.message, "error");
    return;
  }
  nextActions.classList.remove("hidden");
  setStatus(`Workspace “${data.name}” is ready. Continue to the protected workspace.`, "success");
});

signOutButton.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  setStatus(error ? error.message : "Signed out.", error ? "error" : "success");
  nextActions.classList.add("hidden");
  if (!error) show(signInView);
});

void boot();
