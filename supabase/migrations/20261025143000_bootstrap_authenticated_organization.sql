create or replace function private.bootstrap_organization_impl(org_name text, org_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  current_user_id uuid := (select auth.uid());
  created_org public.organizations;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if org_name is null
     or length(btrim(org_name)) < 2
     or length(btrim(org_name)) > 120 then
    raise exception 'organization name must be between 2 and 120 characters';
  end if;

  if org_slug is null
     or length(org_slug) < 3
     or length(org_slug) > 64
     or org_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'organization slug must use lowercase letters, numbers, and single hyphens';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  if exists (
    select 1
    from public.organization_memberships
    where user_id = current_user_id
  ) then
    raise exception 'user already belongs to an organization';
  end if;

  insert into public.organizations (name, slug)
  values (btrim(org_name), org_slug)
  returning * into created_org;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (created_org.id, current_user_id, 'owner');

  return jsonb_build_object(
    'id', created_org.id,
    'name', created_org.name,
    'slug', created_org.slug,
    'role', 'owner'
  );
exception
  when unique_violation then
    raise exception 'organization slug is already in use';
end;
$function$;

revoke all on function private.bootstrap_organization_impl(text, text) from public;
grant execute on function private.bootstrap_organization_impl(text, text) to authenticated, service_role;

create or replace function public.bootstrap_organization(org_name text, org_slug text)
returns jsonb
language sql
volatile
security invoker
set search_path = public, private, pg_temp
as $function$
  select private.bootstrap_organization_impl(org_name, org_slug);
$function$;

revoke all on function public.bootstrap_organization(text, text) from public, anon;
grant execute on function public.bootstrap_organization(text, text) to authenticated, service_role;
