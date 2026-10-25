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
  const webSources = ["web/onboarding.js", "web/ingest.js", "web/workspace.js", "web/review.js"]
    .map(read)
    .join("\n");

  assert.match(config, /publishableKey/);
  assert.doesNotMatch(configWithoutComments, /service[_-]?role|secret|sb_secret/i);
  assert.doesNotMatch(webSources, /service[_-]?role|sb_secret|sk_live|sk_test/i);
});

test("protected pages load runtime config before their modules", () => {
  for (const page of ["web/onboarding.html", "web/ingest.html", "web/workspace.html", "web/review.html"]) {
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
});

test("all authenticated browser modules use the pinned Supabase client", () => {
  for (const source of ["web/onboarding.js", "web/ingest.js", "web/workspace.js", "web/review.js"].map(read)) {
    assert.match(source, /@supabase\/supabase-js@2\.57\.0/);
  }
});


test("review queue is read-only and organization-scoped", () => {
  const source = read("web/review.js");

  assert.match(source, /eq\("organization_id", organizationId\)/);
  assert.match(source, /from\("recommendations"\)/);
  assert.match(source, /from\("commitments"\)/);
  assert.match(source, /from\("events"\)/);
  assert.match(source, /from\("source_documents"\)/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
});
