# Protected people and commitments

The authenticated operations page is available at `web/operations.html`.

It reads organization-scoped `people` and `commitments` rows through the existing Supabase browser client and RLS policies. It shows active people, recorded email values, commitment owners, due dates, statuses, and explainable accountability health.

Contributors can create people and commitments, change commitment status, and edit a commitment’s title, owner, due date, or status. Commitment updates go through the JWT-protected `update-commitment` Edge Function, which validates organization membership, active owner scope, field formats, and records an audit event with the previous and next values.

The browser never uses a service-role credential or bypasses RLS. Viewer accounts remain read-only, and the worker does not execute external actions or change membership.
