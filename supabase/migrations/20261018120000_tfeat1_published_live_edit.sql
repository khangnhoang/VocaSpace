-- TFEAT1: sửa nội dung topic published tại chỗ (không demote về draft).
-- Chỉ các RPC nội dung tin cậy mới được ghi vào topic published; ghi trực tiếp qua Data API
-- vẫn bị chặn vì RLS can_modify_* giữ nguyên draft-only và trigger khóa vẫn từ chối.
-- Rollback: supabase/rollbacks/20261018120000_tfeat1_published_live_edit.down.sql (không có dữ liệu cần hoàn tác).

-- Helper nội bộ cho các worker *_unchecked: topic draft, hoặc topic published đã được
-- d1_prepare_topic_content_mutation đánh dấu trong transaction hiện tại. Vẫn yêu cầu
-- thành viên nhóm tác giả; pending và removed không bao giờ qua.
create or replace function public.d1_topic_content_edit_allowed(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.topics t
    where t.id = p_topic_id
      and t.removed_at is null
      and public.d1_topic_group_member(t.id)
      and (
        t.status = 'draft'::public.item_status
        or (
          t.status = 'published'::public.item_status
          and current_setting('voca.d1_published_edit_topic', true) is not distinct from t.id::text
        )
      )
  )
$$;

revoke all on function public.d1_topic_content_edit_allowed(uuid) from public, anon, authenticated;
grant execute on function public.d1_topic_content_edit_allowed(uuid) to service_role;

create or replace function public.d1_lock_topic_for_mutation(p_topic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_status public.item_status;
  v_removed_at timestamptz;
begin
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    return;
  end if;

  select t.course_id
  into v_course_id
  from public.topics t
  where t.id = p_topic_id;
  if not found then
    raise exception 'TOPIC_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));

  select t.status, t.removed_at
  into v_status, v_removed_at
  from public.topics t
  where t.id = p_topic_id
  for update;

  if v_removed_at is not null then
    raise exception 'TOPIC_NOT_FOUND';
  end if;
  if v_status = 'pending' then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;
  -- Published chỉ được ghi khi RPC tin cậy đã đánh dấu đúng topic này trong transaction.
  if v_status = 'published'
    and current_setting('voca.d1_published_edit_topic', true) is distinct from p_topic_id::text
  then
    raise exception 'TOPIC_PUBLISHED_MUTATION_REQUIRES_TRUSTED_BOUNDARY';
  end if;
  if not public.d1_topic_group_member(p_topic_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;
end;
$$;

create or replace function public.d1_prepare_topic_content_mutation(
  p_topic_id uuid,
  p_confirm_published boolean default false
)
returns public.item_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_course_id uuid;
  v_topic public.topics%rowtype;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select t.course_id into v_course_id
  from public.topics t
  where t.id = p_topic_id;
  if not found then
    raise exception 'TOPIC_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));
  select * into v_topic
  from public.topics t
  where t.id = p_topic_id
  for update;

  if v_topic.removed_at is not null then
    raise exception 'TOPIC_NOT_FOUND';
  end if;
  if not public.d1_topic_group_member(v_topic.id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;
  if v_topic.status = 'pending' then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;
  if v_topic.status = 'published' then
    -- TFEAT1: sửa tại chỗ, topic giữ nguyên published. p_confirm_published vẫn nằm trong chữ ký
    -- RPC để app cũ không vỡ nhưng bị bỏ qua. Dấu hiệu chỉ sống trong transaction này và chỉ
    -- cho đúng topic đã qua các kiểm tra thành viên/pending/removed ở trên.
    perform set_config('voca.d1_published_edit_topic', v_topic.id::text, true);
  end if;

  return v_topic.status;
end;
$$;

CREATE OR REPLACE FUNCTION public.d1_create_exercise_with_content_unchecked(p_topic_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- M24: cùng topic-content authority với edit/delete/card mutation, không giữ veto cấp course.
  if not public.d1_topic_content_edit_allowed(p_topic_id) then
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
$function$;

CREATE OR REPLACE FUNCTION public.d1_soft_delete_exercise_cascade_unchecked(p_exercise_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_exercise record;
  v_removed_at timestamptz := now();
  v_deleted_options integer := 0;
  v_deleted_questions integer := 0;
  v_deleted_groups integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select e.id, e.topic_id, e.course_id, e.removed_at into v_exercise
  from public.exercises e where e.id = p_exercise_id for update;
  if not found then raise exception 'EXERCISE_NOT_FOUND'; end if;
  if v_exercise.removed_at is not null then raise exception 'EXERCISE_ALREADY_REMOVED'; end if;
  if not public.d1_topic_content_edit_allowed(v_exercise.topic_id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;

  perform public.d1_lock_topic_for_mutation(v_exercise.topic_id);
  update public.question_options qo set removed_at = v_removed_at
  where qo.removed_at is null and exists (
    select 1 from public.questions q where q.id = qo.question_id and q.exercise_id = p_exercise_id
  );
  get diagnostics v_deleted_options = row_count;
  update public.questions q set removed_at = v_removed_at where q.exercise_id = p_exercise_id and q.removed_at is null;
  get diagnostics v_deleted_questions = row_count;
  update public.question_groups qg set removed_at = v_removed_at where qg.exercise_id = p_exercise_id and qg.removed_at is null;
  get diagnostics v_deleted_groups = row_count;
  update public.exercises e set removed_at = v_removed_at where e.id = p_exercise_id and e.removed_at is null;

  return jsonb_build_object(
    'exercise_id', p_exercise_id,
    'deleted_options', v_deleted_options,
    'deleted_questions', v_deleted_questions,
    'deleted_groups', v_deleted_groups,
    'removed_at', v_removed_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.d1_sync_question_with_options_unchecked(p_question_id uuid, p_content text, p_explanation text, p_options jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_question record;
  v_clean_content text;
  v_option jsonb;
  v_option_id uuid;
  v_option_content text;
  v_option_order integer := 0;
  v_option_order_offset integer := 0;
  v_clean_option_count integer := 0;
  v_correct_option_count integer := 0;
  v_payload_ids uuid[] := array[]::uuid[];
  v_label text;
  v_label_index integer;
  v_updated_option_id uuid;
  v_deleted_count integer := 0;
  v_updated_count integer := 0;
  v_inserted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT q.id, q.exercise_id, q.course_id, q.removed_at
  INTO v_question
  FROM public.questions q
  WHERE q.id = p_question_id
  FOR UPDATE;

  IF NOT found OR v_question.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'QUESTION_NOT_FOUND';
  END IF;

  IF NOT public.d1_topic_content_edit_allowed((
    SELECT e.topic_id FROM public.questions q JOIN public.exercises e ON e.id = q.exercise_id WHERE q.id = p_question_id
  )) THEN
    RAISE EXCEPTION 'QUESTION_EDIT_FORBIDDEN';
  END IF;

  v_clean_content := nullif(btrim(coalesce(p_content, '')), '');
  IF v_clean_content IS NULL THEN
    RAISE EXCEPTION 'QUESTION_CONTENT_REQUIRED';
  END IF;

  FOR v_option IN
    SELECT value
    FROM jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
  LOOP
    v_option_content := nullif(btrim(coalesce(v_option->>'content', '')), '');
    CONTINUE WHEN v_option_content IS NULL;

    v_clean_option_count := v_clean_option_count + 1;
    IF coalesce((v_option->>'is_correct')::boolean, false) THEN
      v_correct_option_count := v_correct_option_count + 1;
    END IF;

    IF nullif(v_option->>'id', '') IS NOT NULL THEN
      v_option_id := (v_option->>'id')::uuid;

      IF v_option_id = ANY(v_payload_ids) THEN
        RAISE EXCEPTION 'OPTION_DUPLICATE';
      END IF;

      v_payload_ids := array_append(v_payload_ids, v_option_id);
    END IF;
  END LOOP;

  IF v_clean_option_count < 2 THEN
    RAISE EXCEPTION 'QUESTION_REQUIRES_TWO_OPTIONS';
  END IF;

  IF v_correct_option_count < 1 THEN
    RAISE EXCEPTION 'QUESTION_REQUIRES_CORRECT_OPTION';
  END IF;

  UPDATE public.questions
  SET
    content = v_clean_content,
    explanation = nullif(btrim(coalesce(p_explanation, '')), '')
  WHERE id = p_question_id;

  UPDATE public.question_options qo
  SET removed_at = now()
  WHERE qo.question_id = p_question_id
    AND qo.removed_at IS NULL
    AND NOT (qo.id = ANY(v_payload_ids));

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  SELECT coalesce(max(qo.order_index), 0) + v_clean_option_count + 1
  INTO v_option_order_offset
  FROM public.question_options qo
  WHERE qo.question_id = p_question_id
    AND qo.removed_at IS NULL
    AND qo.id = ANY(v_payload_ids);

  UPDATE public.question_options qo
  SET order_index = qo.order_index + v_option_order_offset
  WHERE qo.question_id = p_question_id
    AND qo.removed_at IS NULL
    AND qo.id = ANY(v_payload_ids);

  FOR v_option IN
    SELECT value
    FROM jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
  LOOP
    v_option_content := nullif(btrim(coalesce(v_option->>'content', '')), '');
    CONTINUE WHEN v_option_content IS NULL;

    v_label := '';
    v_label_index := v_option_order;
    LOOP
      v_label := chr(65 + (v_label_index % 26)) || v_label;
      v_label_index := floor(v_label_index / 26)::integer - 1;
      EXIT WHEN v_label_index < 0;
    END LOOP;

    IF nullif(v_option->>'id', '') IS NOT NULL THEN
      v_option_id := (v_option->>'id')::uuid;

      UPDATE public.question_options
      SET
        content = v_option_content,
        is_correct = coalesce((v_option->>'is_correct')::boolean, false),
        label = v_label,
        order_index = v_option_order
      WHERE id = v_option_id
        AND question_id = p_question_id
        AND removed_at IS NULL
      RETURNING id INTO v_updated_option_id;

      IF v_updated_option_id IS NULL THEN
        RAISE EXCEPTION 'OPTION_NOT_FOUND';
      END IF;

      v_updated_count := v_updated_count + 1;
    ELSE
      INSERT INTO public.question_options (
        question_id,
        content,
        label,
        is_correct,
        order_index
      )
      VALUES (
        p_question_id,
        v_option_content,
        v_label,
        coalesce((v_option->>'is_correct')::boolean, false),
        v_option_order
      );

      v_inserted_count := v_inserted_count + 1;
    END IF;

    v_option_order := v_option_order + 1;
    v_updated_option_id := NULL;
  END LOOP;

  RETURN jsonb_build_object(
    'question_id', p_question_id,
    'deleted_options', v_deleted_count,
    'updated_options', v_updated_count,
    'inserted_options', v_inserted_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.d1_question_group_media_delete_allowed(p_bucket_id text, p_object_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    or v_topic.status not in ('draft'::public.item_status, 'published'::public.item_status)
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
$function$;
