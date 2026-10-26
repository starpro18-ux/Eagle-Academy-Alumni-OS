# EAAA OS foundation review

## CTO/product decision

EAAA OS should be an evidence-backed operating system for a volunteer-led alumni organization. Its job is to preserve institutional memory, turn information into reviewable decisions, coordinate accountable work, and measure whether Brotherhood, Service, and Access to Opportunity are producing real outcomes.

The product is not an autonomous executive. Intelligence must increase organizational capacity while keeping authority, context, and accountability with EAAA leaders.

## Current foundation

### Strong foundations already in place

- Multi-tenant organization model with membership roles.
- Database-enforced RLS across public application tables.
- Private source storage and organization-scoped source metadata.
- Source fragments, evidence labels, hashes, and recommendation citations.
- Human-reviewable recommendation status model.
- Agent run, audit event, and autonomy policy tables.
- Connector and sync-run contracts for future Google Drive and Zoom ingestion.
- Static Lovable-compatible UI with a consistent EAAA mission layer.
- Browser code limited to the Supabase publishable key.

### Foundation gaps now closed

- Recommendation generation now records a running/completed/failed agent_runs record.
- Recommendation generation now records an audit_events entry with source, agent run, policy version, and citation count.
- Leaders can approve, reject, or record corrections through a protected review worker.
- Review decisions are stored in recommendation_reviews; approval does not execute an operational action.
- Review UI displays evidence counts and exposes only the actions allowed by the current role.

## Governed intelligence skills

These are the capabilities the platform should grow into. Each skill has a clear input, output, owner, and safety boundary.

| Skill | Product job | Current state |
|---|---|---|
| Evidence intake | Capture trusted source material and preserve provenance. | Implemented |
| Evidence extraction | Convert PDF, Word, Excel, CSV, and text into fragments. | Implemented |
| Decision intelligence | Propose mission-aligned recommendations with citations and uncertainty. | Implemented |
| Governance review | Let leaders approve, reject, or correct proposals without executing them. | Implemented |
| Accountability intelligence | Detect overdue commitments, unclear owners, and blocked work. | Next |
| Brotherhood intelligence | Maintain alumni relationships, class-leader activity, mentorship, and engagement signals. | Planned |
| Opportunity intelligence | Organize jobs, internships, scholarships, partners, and warm introductions. | Planned |
| Service intelligence | Connect events and programs to community objectives and outcomes. | Next |
| Connector intelligence | Sync approved sources from Drive, Zoom, and calendars through one evidence pipeline. | Contract only |
| Leadership intelligence | Present health, risks, outcomes, and unresolved decisions in one operating view. | Partial |

## Quality gates for every future agent

A new agent or automated skill is not ready until it:

1. Receives only organization-scoped data.
2. Has a named version and policy version.
3. Produces structured output.
4. Links claims to evidence or explicitly marks uncertainty.
5. Records an agent_runs row.
6. Records an audit_events entry.
7. Has a human review path for consequential outputs.
8. Has a clear failure state and retry behavior.
9. Cannot silently mutate people, budgets, membership, or governance.
10. Has measurable acceptance, correction, reversal, and critical-error rates before autonomy is increased.

## Recommended build sequence

1. Seed one real EAAA organization and validate onboarding, membership roles, and source ownership.
2. Run the complete loop with real documents: upload → extract → recommend → review → audit.
3. Build accountability intelligence for commitments and blocked work.
4. Build service/outcome intelligence for events.
5. Build the alumni relationship and opportunity domains.
6. Connect external systems only after the manual evidence loop is reliable.
7. Use autonomy policies only after review metrics exist.

## Known risks and mitigations

- Scanned/image-only PDFs need OCR; current extraction handles text layers.
- Large documents need queued/background extraction once volume grows.
- Recommendation generation is capped at 20 runs per organization per 10-minute window; usage budgets and billing alerts are still needed before broad rollout.
- The OpenAI key must remain a Supabase Edge Function secret; common email, phone, and SSN-like patterns are redacted before claims are sent to the model.
- The live project currently has no organization/application rows; a pilot setup is required before end-to-end validation.
- Supabase still reports leaked-password protection disabled; enable it in Auth settings.
- Multiple permissive RLS policies are currently intentional role overlays; keep them monitored and do not replace them with weaker organization-only policies.

## Definition of an intelligent EAAA OS

The system should help leaders answer, at any moment:

- What does EAAA know, and what is the source?
- What decisions are waiting for human judgment?
- Who owns the next commitment?
- Which Brotherhood, Service, or Opportunity objective is active?
- What changed, what is blocked, and what outcome was produced?
- Which agent outputs are trustworthy enough to use—and why?

Until those questions are answered reliably, more agents would add noise rather than intelligence.

### Accountability intelligence

The first operational intelligence skill is deliberately rules-based and explainable. It does not infer hidden facts or take autonomous action. It reads organization-scoped commitments and surfaces:

- overdue open work;
- blocked work;
- commitments without an owner;
- commitments due within seven days;
- open work that is currently on track.

Contributors can change commitment status through the authenticated `update-commitment` Edge Function. The worker validates organization membership, sets `completed_at` when appropriate, and records `commitment.status_changed` in `audit_events`. This makes follow-through visible without allowing the system to silently execute work.


### Service and outcome intelligence

The next impact skill now connects event objectives to observed outcomes. Contributors can record an actual result and narrative, optionally attach organization-scoped evidence, and see an explainable signal:

- on track when the actual meets or exceeds the target;
- below target when the actual is under the target;
- unreviewed when the result has not been leader-validated;
- no outcome when the objective still needs follow-through.

Outcome writes go through the authenticated `record-event-outcome` Edge Function. It validates the event, objective, evidence organization, and contributor membership before inserting the outcome and recording `event.outcome_recorded`. It does not mark outcomes reviewed or trigger operational action.


### Leadership intelligence

The Command Center now provides a rules-based leadership pulse across the existing organization model:

- commitments needing ownership, timing, or intervention;
- recommendations waiting for human review;
- event objectives without recorded outcomes;
- source documents still pending or failing extraction.

The pulse is organization-scoped, read-only, and explainable. It points leaders to the next operating surface without making decisions or changing records.


### Event editing

Event plans are now editable by contributors through a protected `update-event` Edge Function. The edit path validates organization membership, event dates, allowed status values, and records `event.updated` in the audit trail. This keeps the operating record correct without allowing anonymous or cross-organization changes.
