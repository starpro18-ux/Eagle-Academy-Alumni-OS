create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = target_org
      and user_id = auth.uid()
  );
$$;

create or replace function private.require_recommendation_citation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'draft'
     and not exists (
       select 1
       from public.recommendation_citations
       where recommendation_id = new.id
     ) then
    raise exception 'recommendation must have a citation before review or execution';
  end if;
  return new;
end;
$$;

revoke all on function private.is_org_member(uuid) from public;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;

revoke all on function private.require_recommendation_citation() from public;
grant execute on function private.require_recommendation_citation() to authenticated, service_role;

alter policy "members can read organizations" on public.organizations
  using (private.is_org_member(id));

alter policy "members can read organization membership" on public.organization_memberships
  using (private.is_org_member(organization_id));

alter policy "members can access organization data" on public.connector_accounts
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.sync_runs
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.source_documents
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.source_fragments
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.evidence
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.meetings
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.people
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.commitments
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.events
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.event_objectives
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.event_outcomes
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.recommendations
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.recommendation_reviews
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.agent_runs
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.autonomy_policies
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
alter policy "members can access organization data" on public.audit_events
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

alter policy "members can access recommendation citations" on public.recommendation_citations
  using (
    exists (
      select 1
      from public.recommendations r
      where r.id = recommendation_id
        and private.is_org_member(r.organization_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recommendations r
      join public.evidence e on e.id = evidence_id
      where r.id = recommendation_id
        and r.organization_id = e.organization_id
        and private.is_org_member(r.organization_id)
    )
  );

drop trigger recommendation_citation_required on public.recommendations;

create constraint trigger recommendation_citation_required
after insert or update of status on public.recommendations
deferrable initially deferred
for each row execute function private.require_recommendation_citation();

drop function public.is_org_member(uuid);
drop function public.require_recommendation_citation();
