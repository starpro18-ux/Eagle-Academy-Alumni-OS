create index if not exists agent_runs_organization_id_idx
  on public.agent_runs (organization_id);

create index if not exists audit_events_actor_user_id_idx
  on public.audit_events (actor_user_id);

create index if not exists autonomy_policies_approved_by_idx
  on public.autonomy_policies (approved_by);

create index if not exists commitments_meeting_id_idx
  on public.commitments (meeting_id);

create index if not exists commitments_owner_id_idx
  on public.commitments (owner_id);

create index if not exists event_objectives_event_id_idx
  on public.event_objectives (event_id);

create index if not exists event_objectives_organization_id_idx
  on public.event_objectives (organization_id);

create index if not exists event_outcomes_event_id_idx
  on public.event_outcomes (event_id);

create index if not exists event_outcomes_objective_id_idx
  on public.event_outcomes (objective_id);

create index if not exists event_outcomes_organization_id_idx
  on public.event_outcomes (organization_id);

create index if not exists event_outcomes_reviewed_by_idx
  on public.event_outcomes (reviewed_by);

create index if not exists event_outcomes_source_evidence_id_idx
  on public.event_outcomes (source_evidence_id);

create index if not exists events_organization_id_idx
  on public.events (organization_id);

create index if not exists evidence_source_fragment_id_idx
  on public.evidence (source_fragment_id);

create index if not exists meetings_organization_id_idx
  on public.meetings (organization_id);

create index if not exists meetings_source_document_id_idx
  on public.meetings (source_document_id);

create index if not exists organization_memberships_user_id_idx
  on public.organization_memberships (user_id);

create index if not exists people_organization_id_idx
  on public.people (organization_id);

create index if not exists recommendation_reviews_organization_id_idx
  on public.recommendation_reviews (organization_id);

create index if not exists recommendation_reviews_recommendation_id_idx
  on public.recommendation_reviews (recommendation_id);

create index if not exists recommendation_reviews_reviewer_id_idx
  on public.recommendation_reviews (reviewer_id);

create index if not exists source_documents_connector_account_id_idx
  on public.source_documents (connector_account_id);

create index if not exists source_documents_sync_run_id_idx
  on public.source_documents (sync_run_id);

create index if not exists sync_runs_connector_account_id_idx
  on public.sync_runs (connector_account_id);

create index if not exists sync_runs_organization_id_idx
  on public.sync_runs (organization_id);
