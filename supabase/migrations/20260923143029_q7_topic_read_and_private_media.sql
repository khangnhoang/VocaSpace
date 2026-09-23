-- Q7 giữ course/structure read hiện hữu; topic content cần quyền theo từng topic.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.q7_can_read_topic(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.topics t
    join public.chapters ch on ch.id = t.chapter_id and ch.course_id = t.course_id
    join public.courses c on c.id = t.course_id
    join public.profiles p on p.id = (select auth.uid())
    where t.id = p_topic_id
      and t.removed_at is null
      and p.removed_at is null
      and public.has_course_content_read_access(t.course_id)
      and (
        public.is_admin()
        or (c.removed_at is null and ch.removed_at is null)
      )
      and (
        t.status = 'published'::public.item_status
        or public.is_admin()
        or exists (
          select 1 from public.course_collaborators cc
          where cc.course_id = t.course_id
            and cc.user_id = (select auth.uid())
            and cc.role in (
              'owner'::public.course_member_role,
              'co_owner'::public.course_member_role,
              'editor'::public.course_member_role
            )
        )
        or public.d1_topic_group_member(t.id)
        or public.has_topic_review_access(t.id)
      )
  )
$$;

revoke all on function private.q7_can_read_topic(uuid) from public, anon;
grant execute on function private.q7_can_read_topic(uuid) to authenticated, service_role;

drop policy if exists "Select topics credential bound" on public.topics;
create policy "Select topics credential bound" on public.topics
for select to authenticated
using (removed_at is null and private.q7_can_read_topic(id));

drop policy if exists "Select cards credential bound" on public.cards;
create policy "Select cards credential bound" on public.cards
for select to authenticated
using (
  removed_at is null and exists (
    select 1 from public.topics t
    where t.id = cards.topic_id and private.q7_can_read_topic(t.id)
  )
);

drop policy if exists "Select exercises credential bound" on public.exercises;
create policy "Select exercises credential bound" on public.exercises
for select to authenticated
using (
  removed_at is null and exists (
    select 1 from public.topics t
    where t.id = exercises.topic_id and private.q7_can_read_topic(t.id)
  )
);

drop policy if exists "Select question_groups credential bound" on public.question_groups;
create policy "Select question_groups credential bound" on public.question_groups
for select to authenticated
using (
  removed_at is null and exists (
    select 1 from public.exercises e
    join public.topics t on t.id = e.topic_id
    where e.id = question_groups.exercise_id
      and e.removed_at is null
      and private.q7_can_read_topic(t.id)
  )
);

drop policy if exists "Select questions credential bound" on public.questions;
create policy "Select questions credential bound" on public.questions
for select to authenticated
using (
  removed_at is null and exists (
    select 1 from public.exercises e
    join public.topics t on t.id = e.topic_id
    where e.id = questions.exercise_id
      and e.removed_at is null
      and private.q7_can_read_topic(t.id)
  )
);

drop policy if exists "Select question_options credential bound" on public.question_options;
create policy "Select question_options credential bound" on public.question_options
for select to authenticated
using (
  removed_at is null and exists (
    select 1 from public.questions q
    join public.exercises e on e.id = q.exercise_id
    join public.topics t on t.id = e.topic_id
    where q.id = question_options.question_id
      and q.removed_at is null
      and e.removed_at is null
      and private.q7_can_read_topic(t.id)
  )
);

-- D1 vẫn sở hữu nội dung workflow; Q7 chỉ chặn entry RPC trước khi trả DTO.
alter function public.get_topic_workflow_state(uuid) set schema private;
revoke all on function private.get_topic_workflow_state(uuid) from public, anon, authenticated;

create function public.get_topic_workflow_state(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.q7_can_read_topic(p_topic_id) then
    raise exception 'TOPIC_WORKFLOW_FORBIDDEN';
  end if;
  return private.get_topic_workflow_state(p_topic_id);
end;
$$;
revoke all on function public.get_topic_workflow_state(uuid) from public, anon;
grant execute on function public.get_topic_workflow_state(uuid) to authenticated, service_role;

alter function public.d1_topic_structure_capabilities(uuid[]) set schema private;
revoke all on function private.d1_topic_structure_capabilities(uuid[]) from public, anon, authenticated;

create function public.d1_topic_structure_capabilities(p_topic_ids uuid[])
returns table(topic_id uuid, can_edit_content boolean, can_manage_structure boolean, can_delete_topic boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select d.topic_id, d.can_edit_content, d.can_manage_structure, d.can_delete_topic
  from private.d1_topic_structure_capabilities(p_topic_ids) d
  where private.q7_can_read_topic(d.topic_id)
$$;
revoke all on function public.d1_topic_structure_capabilities(uuid[]) from public, anon;
grant execute on function public.d1_topic_structure_capabilities(uuid[]) to authenticated, service_role;

create or replace function private.q7_can_read_question_group_media_object(
  p_bucket_id text,
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_bucket_id in ('question_group_images', 'question_group_audios')
    and array_length(string_to_array(p_object_name, '/'), 1) = 4
    and exists (
      select 1 from public.topics t
      where t.id::text = split_part(p_object_name, '/', 2)
        and t.course_id::text = split_part(p_object_name, '/', 1)
        and private.q7_can_read_topic(t.id)
    )
$$;
revoke all on function private.q7_can_read_question_group_media_object(text, text)
  from public, anon;
grant execute on function private.q7_can_read_question_group_media_object(text, text)
  to authenticated, service_role;

-- Bucket public bỏ qua read RLS dù policy SELECT đã hạn chế.
update storage.buckets set public = false
where id in ('question_group_images', 'question_group_audios');
drop policy if exists "Public View Question Group Images" on storage.objects;
drop policy if exists "Public View Question Group Audios" on storage.objects;

create policy "Q7 Read Question Group Images" on storage.objects
for select to authenticated
using (
  bucket_id = 'question_group_images'
  and private.q7_can_read_question_group_media_object(bucket_id, name)
);
create policy "Q7 Read Question Group Audios" on storage.objects
for select to authenticated
using (
  bucket_id = 'question_group_audios'
  and private.q7_can_read_question_group_media_object(bucket_id, name)
);

-- D1 DELETE chỉ được dọn object sau khi persisted reference đã rời group.
create or replace function public.d1_question_group_media_delete_allowed(
  p_bucket_id text,
  p_object_name text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_course_id text := split_part(p_object_name, '/', 1);
  v_topic_id text := split_part(p_object_name, '/', 2);
  v_topic public.topics%rowtype;
  v_reference text := 'storage://' || p_bucket_id || '/' || p_object_name;
begin
  if p_bucket_id not in ('question_group_images', 'question_group_audios')
    or split_part(p_object_name, '/', 3) = ''
    or split_part(p_object_name, '/', 4) = ''
  then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_course_id));
  perform pg_advisory_xact_lock(hashtext(v_topic_id));
  select * into v_topic
  from public.topics t
  where t.id::text = v_topic_id
    and t.course_id::text = v_course_id
  for update;

  if not found
    or v_topic.removed_at is not null
    or v_topic.status <> 'draft'::public.item_status
    or not public.d1_topic_group_member(v_topic.id)
  then
    return false;
  end if;

  return not exists (
    select 1
    from public.question_groups qg
    join public.exercises e on e.id = qg.exercise_id
    where e.topic_id = v_topic.id
      and qg.removed_at is null
      and e.removed_at is null
      and (
        qg.audio_url = v_reference
        or qg.image_url = v_reference
        or split_part(qg.audio_url, '/storage/v1/object/public/' || p_bucket_id || '/', 2) = p_object_name
        or split_part(qg.image_url, '/storage/v1/object/public/' || p_bucket_id || '/', 2) = p_object_name
      )
  );
end;
$$;
