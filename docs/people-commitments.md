# Protected people and commitments

The authenticated operations page is available at `web/operations.html`.

It reads organization-scoped `people` and `commitments` rows through the existing Supabase browser client and RLS policies. It shows active people, recorded email values, commitment owners, due dates, and statuses.

This slice is intentionally read-only. People and commitment creation or editing should be added only through explicit role-aware workflows with audit events and server-side validation. The browser does not use service-role credentials or bypass RLS.
