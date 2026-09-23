-- Legacy reference chỉ thuộc Storage của chính issuer; URL ngoài cùng path không giữ object.
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
  v_legacy_origin text := substring(auth.jwt()->>'iss' from '^(https?://[^/]+)/auth/v1$');
  v_legacy_reference text;
begin
  if p_bucket_id not in ('question_group_images', 'question_group_audios')
    or split_part(p_object_name, '/', 3) = ''
    or split_part(p_object_name, '/', 4) = ''
    or v_legacy_origin is null
  then
    return false;
  end if;

  v_legacy_reference := v_legacy_origin || '/storage/v1/object/public/' || p_bucket_id || '/' || p_object_name;

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
        or qg.audio_url = v_legacy_reference
        or qg.image_url = v_legacy_reference
      )
  );
end;
$$;
