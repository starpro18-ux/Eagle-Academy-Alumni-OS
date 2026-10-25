import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const config = globalThis.EAGLE_SUPABASE_CONFIG || {};
const setupView = document.querySelector("#setup-view");
const signInView = document.querySelector("#sign-in-view");
const bootstrapView = document.querySelector("#bootstrap-view");
const status = document.querySelector("#status");
const signInForm = document.querySelector("#sign-in-form");
const bootstrapForm = document.querySelector("#bootstrap-form");
const signedInEmail = document.querySelector("#signed-in-email");
const signOutButton = document.querySelector("#sign-out");

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

async function boot() {
  if (!config.url || !config.publishableKey || config.url.includes("YOUR_PROJECT_REF")) {
    show(setupView);
    return;
  }

  supabase = createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  supabase.auth.onAuthStateChange((_event, session) => renderSession(session));
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setStatus(error.message, "error");
    show(signInView);
    return;
  }
  renderSession(data.session);
}

function renderSession(session) {
  if (!session) {
    show(signInView);
    return;
  }
  signedInEmail.textContent = session.user.email || "authenticated user";
  show(bootstrapView);
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
  setStatus(`Workspace “${data.name}” is ready. You are the owner.`, "success");
});

signOutButton.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  setStatus(error ? error.message : "Signed out.", error ? "error" : "success");
  if (!error) show(signInView);
});

boot();
