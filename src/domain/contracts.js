export const recommendationStatuses = Object.freeze([
  "draft",
  "proposed",
  "approved",
  "rejected",
  "executed",
  "reversed",
]);

export const evidenceLabels = Object.freeze([
  "verified",
  "claimed",
  "inferred",
  "missing",
]);

export function requireEvidence(recommendation) {
  const citations = recommendation?.citations ?? [];
  if (citations.length === 0) {
    throw new Error("Recommendations require at least one source citation");
  }
  return recommendation;
}

export function normalizeCommitment(input) {
  return {
    title: String(input.title ?? "").trim(),
    ownerId: input.ownerId ?? null,
    dueDate: input.dueDate ?? null,
    status: input.status ?? "proposed",
    sourceFragmentIds: [...new Set(input.sourceFragmentIds ?? [])],
  };
}
