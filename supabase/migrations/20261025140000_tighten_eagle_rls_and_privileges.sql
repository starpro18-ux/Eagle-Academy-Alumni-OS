create or replace function private.has_org_role(target_org uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = target_org
      and user_id = (select auth.uid())
      and role = any(allowed_roles)
  );
$function$;

revoke all on function private.has_org_role(uuid, text[]) from public;
grant execute on function private.has_org_role(uuid, text[]) to authenticated, service_role;

revoke all on all tables in schema public from anon, public;
revoke references, trigger, truncate on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, public;
revoke execute on all functions in schema public from anon, public;
revoke usage on schema public from anon;

alter default privileges in schema public revoke all on tables from anon, public;
alter default privileges in schema public revoke references, trigger, truncate on tables from authenticated;
alter default privileges in schema public revoke all on sequences from anon, public;
alter default privileges in schema public revoke execute on functions from anon, public;

alter policy "members can read organizations" on public.organizations to authenticated;
alter policy "members can read organization membership" on public.organization_memberships to authenticated;

do $policy$
declare
  table_name text;
begin
  foreach table_name in array array[
    'source_documents',
    'source_fragments',
    'evidence',
    'meetings',
    'people',
    'commitments',
    'events',
    'event_objectives',
    'event_outcomes',
    'recommendations'
  ] loop
    execute format('drop policy if exists "members can access organization data" on public.%I', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_org_member(organization_id))',
      table_name || ' members can read',
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.has_org_role(organization_id, ARRAY[''owner'',''leader'',''committee_lead'',''contributor'']::text[])) with check (private.has_org_role(organization_id, ARRAY[''owner'',''leader'',''committee_lead'',''contributor'']::text[]))',
      table_name || ' contributors can manage',
      table_name
    );
  end loop;
end
$policy$;

do $policy$
declare
  table_name text;
begin
  foreach table_name in array array[
    'connector_accounts',
    'sync_runs',
    'recommendation_reviews',
    'agent_runs',
    'autonomy_policies'
  ] loop
    execute format('drop policy if exists "members can access organization data" on public.%I', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_org_member(organization_id))',
      table_name || ' members can read',
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.has_org_role(organization_id, ARRAY[''owner'',''leader'',''committee_lead'']::text[])) with check (private.has_org_role(organization_id, ARRAY[''owner'',''leader'',''committee_lead'']::text[]))',
      table_name || ' leaders can manage',
      table_name
    );
  end loop;
end
$policy$;

drop policy if exists "members can access organization data" on public.audit_events;
create policy "audit events members can read" on public.audit_events
  for select to authenticated
  using (private.is_org_member(organization_id));

drop policy if exists "members can access recommendation citations" on public.recommendation_citations;
create policy "recommendation citations members can read" on public.recommendation_citations
  for select to authenticated
  using (
    exists (
      select 1
      from public.recommendations r
      where r.id = recommendation_id
        and private.is_org_member(r.organization_id)
    )
  );
create policy "recommendation citations contributors can manage" on public.recommendation_citations
  for all to authenticated
  using (
    exists (
      select 1
      from public.recommendations r
      where r.id = recommendation_id
        and private.has_org_role(r.organization_id, ARRAY['owner','leader','committee_lead','contributor']::text[])
    )
  )
  with check (
    exists (
      select 1
      from public.recommendations r
      join public.evidence e on e.id = evidence_id
      where r.id = recommendation_id
        and r.organization_id = e.organization_id
        and private.has_org_role(r.organization_id, ARRAY['owner','leader','committee_lead','contributor']::text[])
    )
  );

create or replace function private.require_recommendation_citation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.status <> 'draft'
     and not exists (
       select 1
       from public.recommendation_citations c
       join public.evidence e on e.id = c.evidence_id
       where c.recommendation_id = new.id
         and e.organization_id = new.organization_id
     ) then
    raise exception 'recommendation must have a same-organization citation before review or execution';
  end if;
  return new;
end;
$function$;

revoke all on function private.require_recommendation_citation() from public;
grant execute on function private.require_recommendation_citation() to authenticated, service_role;

create or replace function private.validate_recommendation_citation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not exists (
    select 1
    from public.recommendations r
    join public.evidence e on e.id = new.evidence_id
    where r.id = new.recommendation_id
      and r.organization_id = e.organization_id
  ) then
    raise exception 'recommendation citation must reference evidence from the same organization';
  end if;
  return new;
end;
$function$;

revoke all on function private.validate_recommendation_citation() from public;
grant execute on function private.validate_recommendation_citation() to authenticated, service_role;

drop trigger if exists recommendation_citation_org_guard on public.recommendation_citations;
create constraint trigger recommendation_citation_org_guard
after insert or update on public.recommendation_citations
deferrable initially deferred
for each row execute function private.validate_recommendation_citation();

drop policy if exists "Eagle members can read source objects" on storage.objects;
create policy "Eagle members can read source objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'eagle-source-documents'
  and private.is_org_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Eagle members can upload source objects" on storage.objects;
create policy "Eagle contributors can upload source objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'eagle-source-documents'
  and exists (
    select 1
    from public.source_documents document
    where document.id::text = (storage.foldername(name))[2]
      and document.organization_id::text = (storage.foldername(name))[1]
      and private.has_org_role(document.organization_id, ARRAY['owner','leader','committee_lead','contributor']::text[])
  )
);

drop policy if exists "Eagle members can update source objects" on storage.objects;
create policy "Eagle contributors can update source objects"
on storage.objects for update to authenticated
using (
  bucket_id = 'eagle-source-documents'
  and private.has_org_role((storage.foldername(name))[1]::uuid, ARRAY['owner','leader','committee_lead','contributor']::text[])
)
with check (
  bucket_id = 'eagle-source-documents'
  and exists (
    select 1
    from public.source_documents document
    where document.id::text = (storage.foldername(name))[2]
      and document.organization_id::text = (storage.foldername(name))[1]
      and private.has_org_role(document.organization_id, ARRAY['owner','leader','committee_lead','contributor']::text[])
  )
);

drop policy if exists "Eagle members can delete source objects" on storage.objects;
create policy "Eagle leaders can delete source objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'eagle-source-documents'
  and private.has_org_role((storage.foldername(name))[1]::uuid, ARRAY['owner','leader','committee_lead']::text[])
);
