export const AUTONOMY_LEVELS = Object.freeze({
  DRAFT: 0,
  RECOMMEND: 1,
  PREPARE: 2,
  EXECUTE_LOW_RISK: 3,
  BOUNDED: 4,
});

export function assessPromotion(metrics, policy = {}) {
  const required = {
    minReviewed: policy.minReviewed ?? 30,
    minAcceptanceRate: policy.minAcceptanceRate ?? 0.9,
    maxCorrectionRate: policy.maxCorrectionRate ?? 0.05,
    maxReversalRate: policy.maxReversalRate ?? 0.05,
    maxCriticalErrors: policy.maxCriticalErrors ?? 0,
    minPositiveOutcomes: policy.minPositiveOutcomes ?? 10,
  };

  const reasons = [];
  if ((metrics.reviewed ?? 0) < required.minReviewed) reasons.push("not enough reviewed recommendations");
  if ((metrics.acceptanceRate ?? 0) < required.minAcceptanceRate) reasons.push("acceptance rate below threshold");
  if ((metrics.correctionRate ?? 1) > required.maxCorrectionRate) reasons.push("correction rate above threshold");
  if ((metrics.reversalRate ?? 1) > required.maxReversalRate) reasons.push("reversal rate above threshold");
  if ((metrics.criticalErrors ?? 0) > required.maxCriticalErrors) reasons.push("critical error recorded");
  if ((metrics.positiveOutcomes ?? 0) < required.minPositiveOutcomes) reasons.push("outcome improvement not demonstrated");

  return {
    eligible: reasons.length === 0,
    reasons,
    required,
  };
}

export function canExecute({ recommendation, actor, policy }) {
  if (!recommendation || recommendation.status !== "approved") return false;
  if (!actor || !actor.canApprove) return false;
  if (!policy || policy.enabled !== true) return false;
  if (recommendation.riskClass !== "low") return false;
  return true;
}
