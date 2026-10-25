create extension if not exists pgcrypto;

create type public.source_provider as enum ('upload', 'google_drive', 'zoom');
create type public.review_status as enum ('draft', 'proposed', 'approved', 'rejected', 'executed', 'reversed');
create type public.evidence_label as enum ('verified', 'claimed', 'inferred', 'missing');
create type public.risk_class as enum ('low', 'medium', 'high');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'leader', 'committee_lead', 'contributor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.connector_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider public.source_provider not null,
  provider_account_id text,
  display_name text,
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'paused', 'error')),
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, provider_account_id)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connector_account_id uuid references public.connector_accounts(id) on delete set null,
  provider public.source_provider not null,
  status text not null default 'running' check (status in ('running', 'completed', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items_seen integer not null default 0,
  items_imported integer not null default 0,
  items_failed integer not null default 0,
  error_summary text
);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connector_account_id uuid references public.connector_accounts(id) on delete set null,
  sync_run_id uuid references public.sync_runs(id) on delete set null,
  provider public.source_provider not null,
  provider_document_id text,
  source_url text,
  storage_path text,
  title text not null,
  mime_type text,
  content_hash text not null,
  version_label text,
  source_created_at timestamptz,
  source_modified_at timestamptz,
  extracted_at timestamptz,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'complete', 'failed')),
  created_at timestamptz not null default now(),
  unique (organization_id, provider, provider_document_id, content_hash)
);

create table public.source_fragments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  fragment_type text not null check (fragment_type in ('page', 'paragraph', 'cell_range', 'timestamp')),
  locator text not null,
  content text not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (source_document_id, locator, content_hash)
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_fragment_id uuid references public.source_fragments(id) on delete set null,
  label public.evidence_label not null default 'claimed',
  claim text not null,
  confidence numeric(5,4) check (confidence between 0 and 1),
  observed_at timestamptz,
  extracted_by text not null,
  model_version text,
  created_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid references public.source_documents(id) on delete set null,
  title text not null,
  meeting_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved')),
  created_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  title text not null,
  owner_id uuid references public.people(id) on delete set null,
  due_date date,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'in_progress', 'completed', 'blocked', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'idea' check (status in ('idea', 'planning', 'approved', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.event_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  target numeric,
  unit text,
  measurement_method text,
  created_at timestamptz not null default now()
);

create table public.event_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  objective_id uuid references public.event_objectives(id) on delete set null,
  actual numeric,
  narrative text,
  source_evidence_id uuid references public.evidence(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  status public.review_status not null default 'proposed',
  risk_class public.risk_class not null default 'medium',
  agent_name text not null,
  agent_version text not null,
  policy_version text not null,
  citations uuid[] not null default '{}',
  uncertainty text,
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  reversed_at timestamptz
);

create table public.recommendation_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected', 'corrected')),
  correction text,
  created_at timestamptz not null default now()
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_name text not null,
  agent_version text not null,
  input_document_ids uuid[] not null default '{}',
  output_recommendation_ids uuid[] not null default '{}',
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  error_summary text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.autonomy_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action_kind text not null,
  autonomy_level smallint not null default 0 check (autonomy_level between 0 and 4),
  enabled boolean not null default false,
  min_reviewed integer not null default 30,
  min_acceptance_rate numeric(5,4) not null default 0.9,
  max_correction_rate numeric(5,4) not null default 0.05,
  max_reversal_rate numeric(5,4) not null default 0.05,
  max_critical_errors integer not null default 0,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, action_kind)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index on public.source_documents (organization_id, source_modified_at desc);
create index on public.source_fragments (organization_id, source_document_id);
create index on public.evidence (organization_id, created_at desc);
create index on public.commitments (organization_id, status, due_date);
create index on public.recommendations (organization_id, status, created_at desc);
create index on public.audit_events (organization_id, created_at desc);

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = target_org
      and user_id = auth.uid()
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.connector_accounts enable row level security;
alter table public.sync_runs enable row level security;
alter table public.source_documents enable row level security;
alter table public.source_fragments enable row level security;
alter table public.evidence enable row level security;
alter table public.meetings enable row level security;
alter table public.people enable row level security;
alter table public.commitments enable row level security;
alter table public.events enable row level security;
alter table public.event_objectives enable row level security;
alter table public.event_outcomes enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_reviews enable row level security;
alter table public.agent_runs enable row level security;
alter table public.autonomy_policies enable row level security;
alter table public.audit_events enable row level security;

create policy "members can read organizations" on public.organizations
  for select using (public.is_org_member(id));

create policy "members can read organization membership" on public.organization_memberships
  for select using (public.is_org_member(organization_id));

create policy "members can access organization data" on public.connector_accounts
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.sync_runs
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.source_documents
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.source_fragments
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.evidence
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.meetings
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.people
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.commitments
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.events
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.event_objectives
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.event_outcomes
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.recommendations
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.recommendation_reviews
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.agent_runs
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.autonomy_policies
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can access organization data" on public.audit_events
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
