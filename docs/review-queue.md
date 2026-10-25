# Protected review queue

The authenticated review queue is available at `web/review.html`.

It is intentionally read-only for this slice. It loads organization-scoped recommendations, commitments, events, and source-document extraction status through the existing Supabase client and RLS policies.

Recommendations are displayed as proposals with their status, risk class, agent, and uncertainty. Commitments and events provide accountability context. Source rows show whether extraction is still pending.

No approval, execution, messaging, budget, or membership action is performed from this page. Those mutations should be added only through explicit human-review workflows backed by the existing recommendation review and audit tables.
