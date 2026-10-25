alter table public.recommendations
  drop column if exists citations;

create table public.recommendation_citations (
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  evidence_id uuid not null references public.evidence(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (recommendation_id, evidence_id)
);

create index on public.recommendation_citations (evidence_id);

create or replace function public.require_recommendation_citation()
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

create constraint trigger recommendation_citation_required
after insert or update of status on public.recommendations
deferrable initially deferred
for each row execute function public.require_recommendation_citation();

alter table public.recommendation_citations enable row level security;

create policy "members can access recommendation citations"
  on public.recommendation_citations
  for all
  using (
    exists (
      select 1
      from public.recommendations r
      where r.id = recommendation_id
        and public.is_org_member(r.organization_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recommendations r
      join public.evidence e on e.id = evidence_id
      where r.id = recommendation_id
        and r.organization_id = e.organization_id
        and public.is_org_member(r.organization_id)
    )
  );

create or replace function public.is_org_member(target_org uuid)
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

revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to service_role;

revoke all on function public.require_recommendation_citation() from public;
grant execute on function public.require_recommendation_citation() to authenticated;
grant execute on function public.require_recommendation_citation() to service_role;
