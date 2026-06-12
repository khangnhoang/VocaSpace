-- Enforce MVP TOEIC part-specific group context at the RPC write boundary.
-- The UI and Server Action validate first for UX, but this function remains
-- the final database boundary for exercise creation.

create or replace function public.create_exercise_with_content(
  p_topic_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic record;
  v_exercise_id uuid;
  v_exercise_order integer;
  v_group jsonb;
  v_question jsonb;
  v_option jsonb;
  v_group_id uuid;
  v_question_id uuid;
  v_group_order integer;
  v_question_order integer;
  v_option_order integer;
  v_clean_option_count integer;
  v_correct_option_count integer;
  v_group_question_count integer;
  v_inserted_question_count integer := 0;
  v_group_count integer := 0;
  v_standalone_question_count integer := 0;
  v_title text;
  v_part_type text;
  v_group_passage text;
  v_group_audio_url text;
  v_group_image_url text;
  v_question_content text;
  v_option_content text;
  v_label text;
  v_label_index integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select t.id, t.course_id, t.removed_at
  into v_topic
  from public.topics t
  where t.id = p_topic_id
  for update;

  if not found then
    raise exception 'TOPIC_NOT_FOUND';
  end if;

  if v_topic.removed_at is not null then
    raise exception 'TOPIC_REMOVED';
  end if;

  if not public.has_course_management_access(v_topic.course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  v_title := nullif(btrim(coalesce(p_payload->>'title', '')), '');
  v_part_type := nullif(btrim(coalesce(p_payload->>'part_type', '')), '');

  if v_title is null then
    raise exception 'EXERCISE_TITLE_REQUIRED';
  end if;

  if length(v_title) < 4 then
    raise exception 'EXERCISE_TITLE_TOO_SHORT';
  end if;

  if v_part_type is null then
    raise exception 'EXERCISE_PART_TYPE_REQUIRED';
  end if;

  -- MVP TOEIC structure rules. Keep this hardcoded until a future
  -- exercise format/template system owns part-specific rules.
  select count(*)
  into v_group_count
  from jsonb_array_elements(coalesce(p_payload->'groups', '[]'::jsonb));

  select count(*)
  into v_standalone_question_count
  from jsonb_array_elements(coalesce(p_payload->'questions', '[]'::jsonb))
  where nullif(btrim(coalesce(value->>'content', '')), '') is not null;

  if v_part_type in ('part1', 'part2', 'part3', 'part4', 'part6', 'part7')
    and v_group_count < 1 then
    raise exception 'PART_REQUIRES_GROUP';
  end if;

  if v_part_type = 'part5' and v_standalone_question_count < 1 then
    raise exception 'PART_REQUIRES_STANDALONE_QUESTION';
  end if;

  select coalesce(max(e.order_index), 0) + 1
  into v_exercise_order
  from public.exercises e
  where e.topic_id = p_topic_id
    and e.removed_at is null;

  insert into public.exercises (
    topic_id,
    course_id,
    title,
    part_type,
    order_index
  )
  values (
    p_topic_id,
    v_topic.course_id,
    v_title,
    v_part_type,
    v_exercise_order
  )
  returning id into v_exercise_id;

  for v_group, v_group_order in
    select value, ordinality::integer
    from jsonb_array_elements(coalesce(p_payload->'groups', '[]'::jsonb))
      with ordinality
  loop
    v_group_passage := nullif(btrim(coalesce(v_group->>'passage_text', '')), '');
    v_group_audio_url := nullif(btrim(coalesce(v_group->>'audio_url', '')), '');
    v_group_image_url := nullif(btrim(coalesce(v_group->>'image_url', '')), '');

    -- TOEIC Part 1 requires both image and audio. Parts 2/3/4 require audio.
    -- Parts 6/7 require passage text. Optional fields may remain null.
    if v_part_type = 'part1' and v_group_image_url is null then
      raise exception 'GROUP_REQUIRES_IMAGE';
    end if;

    if v_part_type in ('part1', 'part2', 'part3', 'part4')
      and v_group_audio_url is null then
      raise exception 'GROUP_REQUIRES_AUDIO';
    end if;

    if v_part_type in ('part6', 'part7') and v_group_passage is null then
      raise exception 'GROUP_REQUIRES_PASSAGE';
    end if;

    select count(*)
    into v_group_question_count
    from jsonb_array_elements(coalesce(v_group->'questions', '[]'::jsonb))
    where nullif(btrim(coalesce(value->>'content', '')), '') is not null;

    if v_group_question_count < 1 then
      raise exception 'GROUP_REQUIRES_QUESTION';
    end if;

    insert into public.question_groups (
      exercise_id,
      passage_text,
      audio_url,
      image_url,
      order_index
    )
    values (
      v_exercise_id,
      v_group_passage,
      v_group_audio_url,
      v_group_image_url,
      v_group_order
    )
    returning id into v_group_id;

    for v_question, v_question_order in
      select value, ordinality::integer
      from jsonb_array_elements(coalesce(v_group->'questions', '[]'::jsonb))
        with ordinality
    loop
      v_question_content := nullif(btrim(coalesce(v_question->>'content', '')), '');
      if v_question_content is null then
        continue;
      end if;

      select count(*), count(*) filter (where coalesce((value->>'is_correct')::boolean, false))
      into v_clean_option_count, v_correct_option_count
      from jsonb_array_elements(coalesce(v_question->'options', '[]'::jsonb))
      where nullif(btrim(coalesce(value->>'content', '')), '') is not null;

      if v_clean_option_count < 2 then
        raise exception 'QUESTION_REQUIRES_TWO_OPTIONS';
      end if;

      if v_correct_option_count < 1 then
        raise exception 'QUESTION_REQUIRES_CORRECT_OPTION';
      end if;

      insert into public.questions (
        group_id,
        exercise_id,
        course_id,
        content,
        explanation,
        order_index
      )
      values (
        v_group_id,
        v_exercise_id,
        v_topic.course_id,
        v_question_content,
        nullif(btrim(coalesce(v_question->>'explanation', '')), ''),
        v_question_order
      )
      returning id into v_question_id;

      v_option_order := 0;
      for v_option in
        select value
        from jsonb_array_elements(coalesce(v_question->'options', '[]'::jsonb))
      loop
        v_option_content := nullif(btrim(coalesce(v_option->>'content', '')), '');
        continue when v_option_content is null;

        v_label := '';
        v_label_index := v_option_order;
        loop
          v_label := chr(65 + (v_label_index % 26)) || v_label;
          v_label_index := floor(v_label_index / 26)::integer - 1;
          exit when v_label_index < 0;
        end loop;

        insert into public.question_options (
          question_id,
          content,
          label,
          is_correct,
          order_index
        )
        values (
          v_question_id,
          v_option_content,
          v_label,
          coalesce((v_option->>'is_correct')::boolean, false),
          v_option_order
        );

        v_option_order := v_option_order + 1;
      end loop;

      v_inserted_question_count := v_inserted_question_count + 1;
    end loop;
  end loop;

  for v_question, v_question_order in
    select value, ordinality::integer
    from jsonb_array_elements(coalesce(p_payload->'questions', '[]'::jsonb))
      with ordinality
  loop
    v_question_content := nullif(btrim(coalesce(v_question->>'content', '')), '');
    if v_question_content is null then
      continue;
    end if;

    select count(*), count(*) filter (where coalesce((value->>'is_correct')::boolean, false))
    into v_clean_option_count, v_correct_option_count
    from jsonb_array_elements(coalesce(v_question->'options', '[]'::jsonb))
    where nullif(btrim(coalesce(value->>'content', '')), '') is not null;

    if v_clean_option_count < 2 then
      raise exception 'QUESTION_REQUIRES_TWO_OPTIONS';
    end if;

    if v_correct_option_count < 1 then
      raise exception 'QUESTION_REQUIRES_CORRECT_OPTION';
    end if;

    insert into public.questions (
      group_id,
      exercise_id,
      course_id,
      content,
      explanation,
      order_index
    )
    values (
      null,
      v_exercise_id,
      v_topic.course_id,
      v_question_content,
      nullif(btrim(coalesce(v_question->>'explanation', '')), ''),
      v_question_order
    )
    returning id into v_question_id;

    v_option_order := 0;
    for v_option in
      select value
      from jsonb_array_elements(coalesce(v_question->'options', '[]'::jsonb))
    loop
      v_option_content := nullif(btrim(coalesce(v_option->>'content', '')), '');
      continue when v_option_content is null;

      v_label := '';
      v_label_index := v_option_order;
      loop
        v_label := chr(65 + (v_label_index % 26)) || v_label;
        v_label_index := floor(v_label_index / 26)::integer - 1;
        exit when v_label_index < 0;
      end loop;

      insert into public.question_options (
        question_id,
        content,
        label,
        is_correct,
        order_index
      )
      values (
        v_question_id,
        v_option_content,
        v_label,
        coalesce((v_option->>'is_correct')::boolean, false),
        v_option_order
      );

      v_option_order := v_option_order + 1;
    end loop;

    v_inserted_question_count := v_inserted_question_count + 1;
  end loop;

  if v_inserted_question_count = 0 then
    raise exception 'EXERCISE_REQUIRES_QUESTION';
  end if;

  return jsonb_build_object(
    'exercise_id', v_exercise_id,
    'order_index', v_exercise_order
  );
end;
$$;

revoke all on function public.create_exercise_with_content(uuid, jsonb) from public;
grant execute on function public.create_exercise_with_content(uuid, jsonb) to authenticated;
grant execute on function public.create_exercise_with_content(uuid, jsonb) to service_role;
