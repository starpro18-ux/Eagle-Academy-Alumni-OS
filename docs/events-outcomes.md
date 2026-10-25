# Protected events and outcomes

The authenticated events page is available at `web/events.html`.

It reads organization-scoped `events`, `event_objectives`, and `event_outcomes` rows through the existing Supabase browser client and RLS policies. It shows event status and dates, objective targets, and whether an outcome has been recorded or reviewed.

This slice is intentionally read-only. Event planning, objective editing, outcome entry, and evidence review should be added through explicit role-aware workflows with audit events and server-side validation. The browser does not use service-role credentials or bypass RLS.
