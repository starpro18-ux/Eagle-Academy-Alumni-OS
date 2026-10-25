# Protected workspace

The authenticated workspace is available at `web/workspace.html`.

It uses the browser-safe Supabase publishable key and requires an active session plus organization membership. The page reads organization-scoped counts for sources, pending extraction, evidence, commitments, and recommendations, then lists the eight most recent source documents visible to the member.

The workspace intentionally has no broad client-side admin privileges. Organization membership and row-level security remain the source of truth. Source uploads continue through `web/ingest.html`, which applies the contributor-role and private Storage contract documented in [web-ingestion.md](./web-ingestion.md).

Configure the Auth redirect URL for the exact `workspace.html` and `ingest.html` locations used by your local or hosted deployment.
