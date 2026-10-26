# Lovable build brief

This document is the handoff for rebuilding the current Eagle Academy Alumni OS product surface in Lovable. It is grounded in the live GitHub repository and live Supabase project as of 2026-10-25.

## Source of truth

- GitHub repository: https://github.com/starpro18-ux/Eagle-Academy-Alumni-OS
- Main commit: https://github.com/starpro18-ux/Eagle-Academy-Alumni-OS/commit/370b8f5aa01c60c20a4fb469960af656ab052b26
- Supabase project URL: https://dcdbsfugesmpweeqospi.supabase.co
- Supabase project ref: `dcdbsfugesmpweeqospi`

Use the existing Supabase project and schema. Do not create a replacement database or bypass the existing RLS model.

## Product already built

The repository currently contains:

- `web/onboarding.html` + `web/onboarding.js`
  - browser-safe publishable-key configuration;
  - magic-link authentication;
  - one-time `bootstrap_organization(org_name, org_slug)` RPC;
  - existing-membership detection;
  - handoff to the protected workspace.
- `web/workspace.html` + `web/workspace.js`
  - authenticated organization membership check;
  - organization-scoped counts for sources, pending extraction, evidence, commitments, and recommendations;
  - eight most recent source documents;
  - links to source ingestion and the prototype dashboard.
- `web/ingest.html` + `web/ingest.js`
  - authenticated organization membership check;
  - contributor-role check for the upload UX;
  - PDF, DOCX, XLSX, XLS, CSV, and plain-text uploads;
  - 50 MB client-side limit;
  - SHA-256 content hash;
  - metadata row in `source_documents`;
  - private Storage upload to:
    `{organization_id}/{source_document_id}/{safe_filename}`;
  - extraction remains explicitly `pending`.
- `web/index.html`
  - existing demo-backed command-center prototype. Keep it available as a prototype/reference route; do not pretend its in-memory data is production data.
- `web/config.example.js`
  - example runtime config only. Never commit `web/config.js` or any secret.

## Live Supabase state

The live database has 19 public tables, all with RLS enabled. The applied migration sequence is:

1. `initial_eagle_os`
2. `harden_evidence_citations`
3. `lock_down_rpc_function_privileges`
4. `move_security_helpers_private`
5. `index_foreign_keys`
6. `protect_source_document_storage`
7. `tighten_eagle_rls_and_privileges`
8. `bootstrap_authenticated_organization`
9. `harden_bootstrap_organization`
10. `secure_member_administration`

Current production data is intentionally empty:

- authenticated users: 0
- organizations: 0
- organization memberships: 0
- source documents: 0
- source fragments: 0
- evidence: 0
- meetings: 0
- commitments: 0
- events: 0
- recommendations: 0
- audit events: 0

Security status:

- Supabase security advisor: zero findings.
- Anonymous table grants: zero.
- Authenticated table grants exist only for the RLS-protected application surface.
- The `eagle-source-documents` bucket is private.
- Storage limit: 50 MB.
- Allowed MIME types: PDF, DOCX, XLSX, XLS, plain text, and CSV.
- Storage policies are authenticated-only: members can read; contributors can upload/update; leaders can delete.
- Never use a service-role or secret key in Lovable client code.

The performance advisor currently reports unused indexes because the database has no traffic yet, plus overlapping read/manage policies. Do not remove the indexes or weaken RLS as part of the Lovable build.

## Lovable implementation request

Build a polished, production-oriented Eagle Academy Alumni OS frontend using React, TypeScript, Tailwind, and shadcn/ui. Connect it to the existing Supabase project above.

Create these routes:

- `/onboarding`
- `/workspace`
- `/ingest`
- `/prototype` for the existing demo/reference experience

Use a calm institutional visual system: warm ivory background, deep ink text, muted green for safe/approved states, gold for review states, and restrained red for errors. The interface should feel like a trustworthy operations room, not a generic SaaS admin template.

### Required behavior

1. Auth
   - Use Supabase magic-link authentication.
   - Persist the session and support sign-out.
   - Never trust client role labels as authorization; database RLS is authoritative.
   - If the user is authenticated but has no membership, show a clear onboarding state.

2. Onboarding
   - Let a signed-in user create exactly one organization through the existing `bootstrap_organization` RPC.
   - Detect an existing membership and send the user to `/workspace`.
   - Do not add direct client-side writes to organization memberships.

3. Workspace
   - Load the first organization membership for the authenticated user.
   - Show the organization name and role.
   - Query organization-scoped counts from:
     `source_documents`, `evidence`, `commitments`, and `recommendations`.
   - Show pending extraction separately.
   - Show recent source documents with extraction status.
   - Keep empty states intentional and helpful.

4. Source ingestion
   - Accept only the MIME types already allowed by the private bucket.
   - Enforce the 50 MB limit in the UI, while relying on Storage and RLS for actual enforcement.
   - Generate a UUID document id and SHA-256 hash in the browser.
   - Insert `source_documents` with provider `upload`, then upload to `eagle-source-documents`.
   - Use the organization-scoped path contract exactly.
   - On upload failure, remove the metadata row if possible.
   - Label new documents `pending`; do not invent extraction results.

5. Safety and evidence
   - Keep the product human-controlled.
   - Recommendations are proposed outputs and require review.
   - Preserve evidence labels: `verified`, `claimed`, `inferred`, `missing`.
   - Preserve recommendation review states and auditability.
   - Do not add autonomous actions, messaging, budget approvals, or member-status changes.

### Data model to use

The central flow is:

```
source document
  -> source fragment
  -> evidence
  -> meeting / event / commitment
  -> recommendation
  -> human review
  -> measured outcome
```

The most important organization-scoped tables are:

- `organizations`
- `organization_memberships`
- `source_documents`
- `source_fragments`
- `evidence`
- `meetings`
- `people`
- `commitments`
- `events`
- `event_objectives`
- `event_outcomes`
- `recommendations`
- `recommendation_reviews`
- `recommendation_citations`
- `audit_events`

Use the existing RPCs for privileged workflows:

- `bootstrap_organization`
- `add_organization_member`
- `remove_organization_member`

Do not grant direct browser access to privileged membership administration.

## Configuration and acceptance criteria

Create environment/runtime configuration in Lovable, not in Git:

- Supabase URL: `https://dcdbsfugesmpweeqospi.supabase.co`
- Supabase publishable key: provide through Lovable's safe environment configuration.
- Never request or store a service-role key in the frontend.

The build is accepted when:

- unauthenticated users cannot see organization data;
- users without membership cannot see workspace data;
- all reads are organization-scoped and work with existing RLS;
- source uploads use the private bucket and exact path contract;
- the app works with an empty database;
- no secrets are committed;
- the current prototype remains reachable as a clearly labeled reference route;
- the UI communicates that extraction is pending until a worker is connected.


## Institutional design modernization

The static `web/` surface remains the production UI and is being modernized in place. The shared design system uses the existing Eagle seal as the brand anchor with deep ink, warm ivory, muted gold, and restrained sage status colors. It avoids decorative gradients, preserves the current routes and Supabase behavior, adds visible keyboard focus and reduced-motion handling, and keeps the navigation task-oriented.

The demo-backed `web/index.html` route is labeled **Prototype** so it cannot be mistaken for production data. Production source copy now reflects that supported files can be extracted into reviewable evidence. Completed source records expose evidence previews, and recommendation review exposes cited claims before governance decisions.
