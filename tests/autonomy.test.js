import test from "node:test";
import assert from "node:assert/strict";
import { assessPromotion, canExecute } from "../src/domain/autonomy.js";
import { requireEvidence } from "../src/domain/contracts.js";

test("promotion stays blocked until the evidence threshold is met", () => {
  const result = assessPromotion({
    reviewed: 29,
    acceptanceRate: 1,
    correctionRate: 0,
    reversalRate: 0,
    criticalErrors: 0,
    positiveOutcomes: 10,
  });

  assert.equal(result.eligible, false);
  assert.match(result.reasons[0], /not enough/);
});

test("promotion requires clean, measurable performance", () => {
  const result = assessPromotion({
    reviewed: 40,
    acceptanceRate: 0.95,
    correctionRate: 0.02,
    reversalRate: 0.01,
    criticalErrors: 0,
    positiveOutcomes: 12,
  });

  assert.equal(result.eligible, true);
});

test("execution requires approval, a trusted actor, and a low-risk policy", () => {
  assert.equal(canExecute({
    recommendation: { status: "approved", riskClass: "low" },
    actor: { canApprove: true },
    policy: { enabled: true },
  }), true);

  assert.equal(canExecute({
    recommendation: { status: "proposed", riskClass: "low" },
    actor: { canApprove: true },
    policy: { enabled: true },
  }), false);
});

test("uncited recommendations cannot enter the approval flow", () => {
  assert.throws(() => requireEvidence({ citations: [] }), /source citation/);
});
