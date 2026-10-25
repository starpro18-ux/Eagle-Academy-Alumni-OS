create or replace function private.add_organization_member_impl(
  target_org uuid,
  target_user uuid,
  target_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  caller_id uuid := (select auth.uid());
  created_membership public.organization_memberships;
begin
  if caller_id is null then
    raise exception 'authentication required';
  end if;

  if target_role not in ('leader', 'committee_lead', 'contributor', 'viewer') then
    raise exception 'owners must use the owner workflow and cannot be assigned through this endpoint';
  end if;

  if not private.has_org_role(target_org, ARRAY['owner', 'leader']::text[]) then
    raise exception 'only organization owners and leaders can manage members';
  end if;

  if target_role = 'leader'
     and not private.has_org_role(target_org, ARRAY['owner']::text[]) then
    raise exception 'only organization owners can assign leaders';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (target_org, target_user, target_role)
  returning * into created_membership;

  return jsonb_build_object(
    'id', created_membership.id,
    'organization_id', created_membership.organization_id,
    'user_id', created_membership.user_id,
    'role', created_membership.role
  );
exception
  when unique_violation then
    raise exception 'user is already a member of this organization';
  when foreign_key_violation then
    raise exception 'target user or organization does not exist';
end;
$function$;

revoke all on function private.add_organization_member_impl(uuid, uuid, text) from public;
grant execute on function private.add_organization_member_impl(uuid, uuid, text) to authenticated, service_role;

create or replace function public.add_organization_member(
  target_org uuid,
  target_user uuid,
  target_role text
)
returns jsonb
language sql
volatile
security invoker
set search_path = public, private, pg_temp
as $function$
  select private.add_organization_member_impl(target_org, target_user, target_role);
$function$;

revoke all on function public.add_organization_member(uuid, uuid, text) from public, anon;
grant execute on function public.add_organization_member(uuid, uuid, text) to authenticated, service_role;

create or replace function private.remove_organization_member_impl(
  target_org uuid,
  target_user uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  caller_id uuid := (select auth.uid());
  removed_membership public.organization_memberships;
begin
  if caller_id is null then
    raise exception 'authentication required';
  end if;

  if not private.has_org_role(target_org, ARRAY['owner', 'leader']::text[]) then
    raise exception 'only organization owners and leaders can manage members';
  end if;

  if target_user = caller_id then
    raise exception 'members cannot remove themselves through this endpoint';
  end if;

  if exists (
    select 1
    from public.organization_memberships
    where organization_id = target_org
      and user_id = target_user
      and role = 'owner'
  ) and not private.has_org_role(target_org, ARRAY['owner']::text[]) then
    raise exception 'only organization owners can remove owners';
  end if;

  delete from public.organization_memberships
  where organization_id = target_org
    and user_id = target_user
  returning * into removed_membership;

  if removed_membership.id is null then
    raise exception 'user is not a member of this organization';
  end if;

  return jsonb_build_object(
    'id', removed_membership.id,
    'organization_id', removed_membership.organization_id,
    'user_id', removed_membership.user_id,
    'role', removed_membership.role
  );
end;
$function$;

revoke all on function private.remove_organization_member_impl(uuid, uuid) from public;
grant execute on function private.remove_organization_member_impl(uuid, uuid) to authenticated, service_role;

create or replace function public.remove_organization_member(
  target_org uuid,
  target_user uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = public, private, pg_temp
as $function$
  select private.remove_organization_member_impl(target_org, target_user);
$function$;

revoke all on function public.remove_organization_member(uuid, uuid) from public, anon;
grant execute on function public.remove_organization_member(uuid, uuid) to authenticated, service_role;
