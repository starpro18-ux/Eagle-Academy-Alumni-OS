export const SOURCE_PROVIDERS = Object.freeze(["upload", "google_drive", "zoom"]);

export function normalizeSourceDocument(input) {
  if (!input?.organizationId) throw new Error("organizationId is required");
  if (!SOURCE_PROVIDERS.includes(input.provider)) throw new Error("unsupported source provider");
  if (!input.title?.trim()) throw new Error("title is required");
  if (!input.contentHash?.trim()) throw new Error("contentHash is required");

  return {
    organizationId: input.organizationId,
    provider: input.provider,
    providerDocumentId: input.providerDocumentId ?? null,
    sourceUrl: input.sourceUrl ?? null,
    title: input.title.trim(),
    mimeType: input.mimeType ?? null,
    contentHash: input.contentHash,
    versionLabel: input.versionLabel ?? null,
    sourceCreatedAt: input.sourceCreatedAt ?? null,
    sourceModifiedAt: input.sourceModifiedAt ?? null,
  };
}

export function planSync({ provider, organizationId, cursor = null }) {
  if (!SOURCE_PROVIDERS.includes(provider)) throw new Error("unsupported source provider");
  if (!organizationId) throw new Error("organizationId is required");

  return {
    provider,
    organizationId,
    cursor,
    dedupeBy: ["providerDocumentId", "contentHash"],
    writesScores: false,
    requiresReview: true,
  };
}
