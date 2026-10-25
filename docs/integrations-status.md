# Protected integrations status

The authenticated integrations page is available at `web/integrations.html`.

It reads organization-scoped `connector_accounts` and `sync_runs` rows through the existing Supabase client and RLS policies. It reports connector provider/status, update time, recent sync state, and item counts.

This slice is intentionally read-only. OAuth connection management, sync execution, retries, and connector secrets are not exposed in browser code. Those capabilities should be added through explicit server-side or Edge Function workflows with least-privilege secrets and auditable sync runs.
