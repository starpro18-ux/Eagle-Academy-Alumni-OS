import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const config = globalThis.EAGLE_SUPABASE_CONFIG ?? {};
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/csv",
]);
const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  txt: "text/plain",
  csv: "text/csv",
};
const CONTRIBUTOR_ROLES = new Set(["owner", "leader", "committee_lead", "contributor"]);

const setupView = document.querySelector("#setup-view");
const signInView = document.querySelector("#sign-in-view");
const appView = document.querySelector("#app-view");
const status = document.querySelector("#status");
const signInForm = document.querySelector("#sign-in-form");
const uploadForm = document.querySelector("#upload-form");
const sourceFile = document.querySelector("#source-file");
const sourceList = document.querySelector("#source-list");
const signedInEmail = document.querySelector("#signed-in-email");
const organizationName = document.querySelector("#organization-name");
let canExtract = false;
let organizationId = null;

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function show(view) {
  for (const candidate of [setupView, signInView, appView]) {
    candidate.classList.toggle("hidden", candidate !== view);
  }
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeFilename(name) {
  const normalized = name.normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "");
  const cleaned = normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 180) || "source";
}

function fileMime(file) {
  if (ALLOWED_MIME_TYPES.has(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? "";
}

async function sha256(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Unknown date";
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

async function loadEvidencePreview(supabase, source, target) {
  target.textContent = "Loading extracted evidence…";
  const { data, error } = await supabase
    .from("source_fragments")
    .select("id, locator, content")
    .eq("organization_id", organizationId)
    .eq("source_document_id", source.id)
    .order("locator", { ascending: true });

  if (error) throw error;
  target.replaceChildren();

  if (!data?.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No evidence fragments were created for this source.";
    target.append(empty);
    return;
  }

  for (const fragment of data) {
    const article = document.createElement("article");
    article.className = "evidence-fragment";
    const locator = document.createElement("span");
    locator.className = "evidence-locator";
    locator.textContent = fragment.locator || "Evidence";
    const content = document.createElement("p");
    content.textContent = fragment.content;
    article.append(locator, content);
    target.append(article);
  }
}

async function loadSources(supabase, organizationId) {
  const { data, error } = await supabase
    .from("source_documents")
    .select("id, title, mime_type, content_hash, extraction_status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  sourceList.replaceChildren();

  if (!data?.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No source documents yet.";
    sourceList.append(empty);
    return;
  }

  for (const source of data) {
    const item = document.createElement("li");
    item.className = "source-item";
    const title = document.createElement("div");
    title.className = "source-title";
    title.textContent = source.title;
    const controls = document.createElement("div");
    controls.className = "source-controls";
    const meta = document.createElement("div");
    meta.className = "source-meta";
    meta.textContent = `${source.extraction_status} · ${source.mime_type || "unknown"} · ${formatDate(source.created_at)}`;
    controls.append(meta);
    if (["pending", "failed"].includes(source.extraction_status) && canExtract) {
      const extractButton = document.createElement("button");
      extractButton.type = "button";
      extractButton.className = "secondary extract-button";
      extractButton.textContent = source.extraction_status === "failed" ? "Retry extraction" : "Extract evidence";
      extractButton.addEventListener("click", async () => {
        extractButton.disabled = true;
        setStatus("Extracting evidence from source…");
        const { data, error } = await supabase.functions.invoke("extract-source", {
          body: { source_document_id: source.id },
        });
        if (error || data?.error) {
          setStatus(data?.error || error?.message || "Source extraction failed.", "error");
          extractButton.disabled = false;
          await loadSources(supabase, organizationId);
          return;
        }
        setStatus(`${data.fragments_created} source fragment${data.fragments_created === 1 ? "" : "s"} and ${data.evidence_created} evidence record${data.evidence_created === 1 ? "" : "s"} created.`, "success");
        await loadSources(supabase, organizationId);
      });
      controls.append(extractButton);
    }
    if (source.extraction_status === "complete") {
      const details = document.createElement("details");
      details.className = "source-evidence";
      const summary = document.createElement("summary");
      summary.textContent = "View extracted evidence";
      const preview = document.createElement("div");
      preview.className = "evidence-preview";
      details.append(summary, preview);
      details.addEventListener("toggle", async () => {
        if (!details.open || details.dataset.loaded === "true") return;
        details.dataset.loaded = "true";
        try {
          await loadEvidencePreview(supabase, source, preview);
        } catch (error) {
          details.dataset.loaded = "";
          preview.textContent = error.message || "Evidence could not be loaded.";
        }
      });
      item.append(title, controls, details);
    }
  }
    sourceList.append(item);
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

  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = sourceFile.files?.[0];
    if (!file) return;
    const mimeType = fileMime(file);
    if (file.size > MAX_FILE_BYTES) {
      setStatus("That file is larger than the 50 MB storage limit.", "error");
      return;
    }
    if (!mimeType) {
      setStatus("That file type is not allowed. Use PDF, Word, Excel, CSV, or plain text.", "error");
      return;
    }

    try {
      uploadForm.querySelector("button").disabled = true;
      setStatus("Preparing secure source record…");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Sign in again.");
      const workspace = await loadWorkspace(supabase, user.id);
      organizationId = workspace.organization.id;
      canExtract = CONTRIBUTOR_ROLES.has(workspace.membership.role);
      if (!CONTRIBUTOR_ROLES.has(workspace.membership.role)) {
        throw new Error("Your organization role is read-only. Ask an owner or leader for contributor access.");
      }

      const documentId = crypto.randomUUID();
      const storagePath = `${workspace.organization.id}/${documentId}/${safeFilename(file.name)}`;
      const contentHash = await sha256(file);
      const { error: documentError } = await supabase.from("source_documents").insert({
        id: documentId,
        organization_id: workspace.organization.id,
        provider: "upload",
        storage_path: storagePath,
        title: file.name,
        mime_type: mimeType,
        content_hash: contentHash,
        source_created_at: new Date(file.lastModified).toISOString(),
      });
      if (documentError) throw documentError;

      setStatus("Uploading to the private source vault…");
      const { error: uploadError } = await supabase.storage
        .from("eagle-source-documents")
        .upload(storagePath, file, { contentType: mimeType, upsert: false });
      if (uploadError) {
        await supabase.from("source_documents").delete().eq("id", documentId);
        throw uploadError;
      }

      sourceFile.value = "";
      setStatus("Source uploaded. Extraction is pending.", "success");
      await loadSources(supabase, workspace.organization.id);
    } catch (error) {
      setStatus(error.message || "Source upload failed.", "error");
    } finally {
      uploadForm.querySelector("button").disabled = false;
    }
  });

  const renderSession = async (session) => {
    if (!session?.user) {
      show(signInView);
      setStatus("Sign in to access the private source vault.");
      return;
    }

    try {
      setStatus("Checking organization membership…");
      const workspace = await loadWorkspace(supabase, session.user.id);
      organizationId = workspace.organization.id;
      canExtract = CONTRIBUTOR_ROLES.has(workspace.membership.role);
      signedInEmail.textContent = session.user.email || "authenticated user";
      organizationName.textContent = `${workspace.organization.name} · ${workspace.membership.role}`;
      show(appView);
      await loadSources(supabase, workspace.organization.id);
      setStatus("");
    } catch (error) {
      show(signInView);
      setStatus(error.message || "Unable to load your organization.", "error");
    }
  };

  supabase.auth.onAuthStateChange((_event, session) => {
    void renderSession(session);
  });
  const { data: { session } } = await supabase.auth.getSession();
  await renderSession(session);
}

void start();
