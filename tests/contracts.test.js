import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSourceDocument, planSync } from "../src/connectors/contracts.js";

test("all connectors normalize to the same source-document contract", () => {
  const document = normalizeSourceDocument({
    organizationId: "org-1",
    provider: "google_drive",
    providerDocumentId: "drive-1",
    title: "General Meeting",
    contentHash: "hash-1",
  });

  assert.equal(document.provider, "google_drive");
  assert.equal(document.title, "General Meeting");
  assert.equal(document.providerDocumentId, "drive-1");
});

test("sync planning is review-only and score-neutral", () => {
  const plan = planSync({ provider: "zoom", organizationId: "org-1" });

  assert.equal(plan.writesScores, false);
  assert.equal(plan.requiresReview, true);
  assert.deepEqual(plan.dedupeBy, ["providerDocumentId", "contentHash"]);
});
