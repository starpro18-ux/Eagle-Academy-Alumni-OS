import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("browser configuration contains no server secret", () => {
  const config = read("web/config.example.js");
  const configWithoutComments = config.replace(/^\s*\/\/.*$/gm, "");
  const webSources = ["web/onboarding.js", "web/ingest.js", "web/workspace.js", "web/review.js", "web/integrations.js", "web/operations.js", "web/events.js", "web/command-center.js"]
    .map(read)
    .join("\n");

  assert.match(config, /publishableKey/);
  assert.doesNotMatch(configWithoutComments, /service[_-]?role|secret|sb_secret/i);
  assert.doesNotMatch(webSources, /service[_-]?role|sb_secret|sk_live|sk_test/i);
});

test("protected pages load runtime config before their modules", () => {
  for (const page of ["web/onboarding.html", "web/ingest.html", "web/workspace.html", "web/review.html", "web/integrations.html", "web/operations.html", "web/events.html", "web/app.html"]) {
    const html = read(page);
    const configIndex = html.indexOf('src="./config.js"');
    const moduleIndex = html.indexOf('type="module"');
    assert.ok(configIndex >= 0, `${page} must load config.js`);
    assert.ok(moduleIndex > configIndex, `${page} must load config.js before its module`);
  }
});

test("source ingestion preserves the private organization-scoped upload contract", () => {
  const source = read("web/ingest.js");

  assert.match(source, /from\("organization_memberships"\)/);
  assert.match(source, /eq\("user_id", userId\)/);
  assert.match(source, /organization_id: workspace\.organization\.id/);
  assert.match(source, /provider: "upload"/);
  assert.match(source, /eagle-source-documents/);
  assert.match(source, /storagePath = `\$\{workspace\.organization\.id\}\/\$\{documentId\}/);
  assert.match(source, /extraction_status/);
  assert.match(source, /MAX_FILE_BYTES = 50 \* 1024 \* 1024/);
  assert.match(source, /loadEvidencePreview/);
  assert.match(source, /from\("source_fragments"\)/);
  assert.match(source, /eq\("organization_id", organizationId\)/);
  assert.match(source, /eq\("source_document_id", source\.id\)/);
  assert.match(source, /View extracted evidence/);
});

test("all authenticated browser modules use the pinned Supabase client", () => {
  for (const source of ["web/onboarding.js", "web/ingest.js", "web/workspace.js", "web/review.js", "web/integrations.js", "web/operations.js", "web/events.js", "web/command-center.js"].map(read)) {
    assert.match(source, /@supabase\/supabase-js@2\.57\.0/);
  }
});


test("review queue is read-only and organization-scoped", () => {
  const source = read("web/review.js");

  assert.match(source, /eq\("organization_id", organizationId\)/);
  assert.match(source, /from\("recommendations"\)/);
  assert.match(source, /from\("evidence"\)/);
  assert.match(source, /citedEvidence/);
  assert.match(source, /evidence\.claim/);
  assert.match(source, /from\("commitments"\)/);
  assert.match(source, /from\("events"\)/);
  assert.match(source, /from\("source_documents"\)/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
});


test("integrations status is read-only and organization-scoped", () => {
  const source = read("web/integrations.js");

  assert.match(source, /eq\("organization_id", organizationId\)/);
  assert.match(source, /from\("connector_accounts"\)/);
  assert.match(source, /from\("sync_runs"\)/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
});


test("people and commitments are organization-scoped writes", () => {
  const source = read("web/operations.js");

  assert.match(source, /eq\("organization_id", organizationId\)/);
  assert.match(source, /from\("people"\)/);
  assert.match(source, /from\("commitments"\)/);
  assert.match(source, /organization_id: organizationId/);
  assert.match(source, /\.insert\(/);
  assert.doesNotMatch(source, /\.update\(|\.delete\(/);
});


test("events and outcomes are organization-scoped writes", () => {
  const source = read("web/events.js");

  assert.match(source, /eq\("organization_id", organizationId\)/);
  assert.match(source, /from\("events"\)/);
  assert.match(source, /from\("event_objectives"\)/);
  assert.match(source, /from\("event_outcomes"\)/);
  assert.match(source, /organization_id: organizationId/);
  assert.match(source, /\.insert\(/);
  assert.doesNotMatch(source, /\.update\(|\.delete\(/);
});


test("command center is organization-scoped and browser-write free", () => {
  const source = read("web/command-center.js");

  assert.match(source, /eq\("organization_id", organizationId\)/);
  assert.match(source, /from\("source_documents"\)/);
  assert.match(source, /from\("commitments"\)/);
  assert.match(source, /count\(supabase, "events"/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
});


test("EAAA mission language is present across platform surfaces", () => {
  for (const page of ["web/onboarding.html", "web/ingest.html", "web/workspace.html", "web/review.html", "web/operations.html", "web/events.html", "web/integrations.html", "web/index.html", "web/app.html"]) {
    const html = read(page);
    assert.match(html, /Brotherhood\. Service\. Access to Opportunity\./);
    assert.match(html, /mission-bar/);
  }
});

test("review queue invokes only the protected recommendation worker", () => {
  const source = read("web/review.js");
  assert.match(source, /functions\.invoke\("recommend-source"/);
  assert.doesNotMatch(source, /OPENAI_API_KEY|api\.openai\.com|sk-[A-Za-z0-9]/);
});

test("source extraction supports PDF, Word, and both Excel formats", () => {
  const source = read("supabase/functions/extract-source/index.ts");
  assert.match(source, /application\/pdf/);
  assert.match(source, /wordprocessingml\.document/);
  assert.match(source, /application\/vnd\.ms-excel/);
  assert.match(source, /unpdf@1\.0\.6/);
  assert.match(source, /getDocumentProxy/);
  assert.match(source, /extractPdfText/);
  assert.match(source, /XLSX/);
  assert.match(source, /MAX_EXTRACTABLE_BYTES = 25 \* 1024 \* 1024/);
});

test("recommendation worker minimizes prompt data and limits usage", () => {
  const source = read("supabase/functions/recommend-source/index.ts");
  assert.match(source, /redactSensitiveData/);
  assert.match(source, /redacted email/);
  assert.match(source, /MAX_RUNS_PER_ORG_PER_WINDOW/);
  assert.match(source, /RATE_WINDOW_MINUTES/);
  assert.match(source, /429/);
});

test("recommendation worker is authenticated, cited, and proposed-only", () => {
  const source = read("supabase/functions/recommend-source/index.ts");
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /from\("organization_memberships"\)/);
  assert.match(source, /OPENAI_API_KEY/);
  assert.match(source, /from\("recommendations"\)/);
  assert.match(source, /status: "proposed"/);
  assert.match(source, /from\("recommendation_citations"\)/);
});

test("recommendation review is leader-gated and audited", () => {
  const source = read("supabase/functions/review-recommendation/index.ts");
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /REVIEWER_ROLES/);
  assert.match(source, /from\("organization_memberships"\)/);
  assert.match(source, /from\("recommendation_reviews"\)/);
  assert.match(source, /from\("recommendations"\)/);
  assert.match(source, /recommendation\.reviewed/);
  assert.match(source, /audit_events/);
});

test("recommendation generation records agent runs and audit events", () => {
  const source = read("supabase/functions/recommend-source/index.ts");
  assert.match(source, /from\("agent_runs"\)/);
  assert.match(source, /status: "running"/);
  assert.match(source, /finishAgentRun\("completed"/);
  assert.match(source, /finishAgentRun\("failed"/);
  assert.match(source, /from\("audit_events"\)/);
  assert.match(source, /recommendation\.generated/);
});

test("review UI exposes governed decisions without direct database writes", () => {
  const source = read("web/review.js");
  assert.match(source, /functions\.invoke\("review-recommendation"/);
  assert.match(source, /approved/);
  assert.match(source, /rejected/);
  assert.match(source, /corrected/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
});

test("source extraction stays authenticated and organization-scoped", () => {
  const source = read("supabase/functions/extract-source/index.ts");

  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /from\("organization_memberships"\)/);
  assert.match(source, /eq\("organization_id", source\.organization_id\)/);
  assert.match(source, /from\("source_fragments"\)/);
  assert.match(source, /from\("evidence"\)/);
  assert.match(source, /eagle-source-documents/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /extraction_status: "complete"/);
  assert.match(source, /\["pending", "failed"\]/);
  assert.match(source, /Previous extraction data could not be cleared/);
});


test("accountability intelligence is explainable and status changes are governed", () => {
  const ui = read("web/operations.js");
  const worker = read("supabase/functions/update-commitment/index.ts");
  assert.match(ui, /commitmentHealth/);
  assert.match(ui, /renderAccountabilityPulse/);
  assert.match(ui, /functions\.invoke\("update-commitment"/);
  assert.match(worker, /auth\.getUser\(\)/);
  assert.match(worker, /CONTRIBUTOR_ROLES/);
  assert.match(worker, /commitment\.status_changed/);
  assert.match(worker, /completed_at/);
});


test("service outcome intelligence is evidence-aware and contributor-gated", () => {
  const ui = read("web/events.js");
  const worker = read("supabase/functions/record-event-outcome/index.ts");
  assert.match(ui, /renderOutcomeForm/);
  assert.match(ui, /outcomeSignal/);
  assert.match(ui, /functions\.invoke\("record-event-outcome"/);
  assert.match(ui, /from\("evidence"\)/);
  assert.match(worker, /auth\.getUser\(\)/);
  assert.match(worker, /CONTRIBUTOR_ROLES/);
  assert.match(worker, /source_evidence_id/);
  assert.match(worker, /event\.outcome_recorded/);
});


test("command center exposes explainable leadership intelligence", () => {
  const source = read("web/command-center.js");
  assert.match(source, /leadershipPulse/);
  assert.match(source, /renderLeadershipPulse/);
  assert.match(source, /from\("commitments"\)/);
  assert.match(source, /from\("recommendations"\)/);
  assert.match(source, /from\("event_objectives"\)/);
  assert.match(source, /from\("event_outcomes"\)/);
  assert.match(source, /from\("source_documents"\)/);
  assert.doesNotMatch(source, /.insert\(|.update\(|.delete\(/);
});


test("event editing is contributor-gated and audited", () => {
  const ui = read("web/events.js");
  const worker = read("supabase/functions/update-event/index.ts");
  assert.match(ui, /Edit event/);
  assert.match(ui, /renderEventEditor/);
  assert.match(ui, /functions\.invoke\("update-event"/);
  assert.match(worker, /auth\.getUser\(\)/);
  assert.match(worker, /CONTRIBUTOR_ROLES/);
  assert.match(worker, /event\.updated/);
  assert.match(worker, /description/);
});
