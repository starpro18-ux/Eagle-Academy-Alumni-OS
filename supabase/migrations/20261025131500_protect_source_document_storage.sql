insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'eagle-source-documents',
  'eagle-source-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv'
  ]::text[]
)
on conflict (id) do nothing;

create policy "Eagle members can read source objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'eagle-source-documents'
  and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id::text = (storage.foldername(name))[1]
      and membership.user_id = (select auth.uid())
  )
);

create policy "Eagle members can upload source objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'eagle-source-documents'
  and exists (
    select 1
    from public.source_documents document
    where document.id::text = (storage.foldername(name))[2]
      and document.organization_id::text = (storage.foldername(name))[1]
      and exists (
        select 1
        from public.organization_memberships membership
        where membership.organization_id = document.organization_id
          and membership.user_id = (select auth.uid())
      )
  )
);

create policy "Eagle members can update source objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'eagle-source-documents'
  and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id::text = (storage.foldername(name))[1]
      and membership.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'eagle-source-documents'
  and exists (
    select 1
    from public.source_documents document
    where document.id::text = (storage.foldername(name))[2]
      and document.organization_id::text = (storage.foldername(name))[1]
      and exists (
        select 1
        from public.organization_memberships membership
        where membership.organization_id = document.organization_id
          and membership.user_id = (select auth.uid())
      )
  )
);

create policy "Eagle members can delete source objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'eagle-source-documents'
  and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id::text = (storage.foldername(name))[1]
      and membership.user_id = (select auth.uid())
  )
);
