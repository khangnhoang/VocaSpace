create or replace function public.sync_question_with_options(
  p_question_id uuid,
  p_content text,
  p_explanation text,
  p_options jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question record;
  v_clean_content text;
  v_option jsonb;
  v_option_id uuid;
  v_option_content text;
  v_option_order integer := 0;
  v_clean_option_count integer := 0;
  v_correct_option_count integer := 0;
  v_payload_ids uuid[] := array[]::uuid[];
  v_label text;
  v_label_index integer;
  v_updated_option_id uuid;
  v_deleted_count integer := 0;
  v_updated_count integer := 0;
  v_inserted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select q.id, q.exercise_id, q.course_id, q.removed_at
  into v_question
  from public.questions q
  where q.id = p_question_id
  for update;

  if not found or v_question.removed_at is not null then
    raise exception 'QUESTION_NOT_FOUND';
  end if;

  if not public.can_modify_question_option(p_question_id) then
    raise exception 'QUESTION_EDIT_FORBIDDEN';
  end if;

  v_clean_content := nullif(btrim(coalesce(p_content, '')), '');
  if v_clean_content is null then
    raise exception 'QUESTION_CONTENT_REQUIRED';
  end if;

  for v_option in
    select value
    from jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
  loop
    v_option_content := nullif(btrim(coalesce(v_option->>'content', '')), '');
    continue when v_option_content is null;

    v_clean_option_count := v_clean_option_count + 1;
    if coalesce((v_option->>'is_correct')::boolean, false) then
      v_correct_option_count := v_correct_option_count + 1;
    end if;

    if nullif(v_option->>'id', '') is not null then
      v_option_id := (v_option->>'id')::uuid;

      if v_option_id = any(v_payload_ids) then
        raise exception 'OPTION_DUPLICATE';
      end if;

      v_payload_ids := array_append(v_payload_ids, v_option_id);
    end if;
  end loop;

  if v_clean_option_count < 2 then
    raise exception 'QUESTION_REQUIRES_TWO_OPTIONS';
  end if;

  if v_correct_option_count < 1 then
    raise exception 'QUESTION_REQUIRES_CORRECT_OPTION';
  end if;

  update public.questions
  set
    content = v_clean_content,
    explanation = nullif(btrim(coalesce(p_explanation, '')), '')
  where id = p_question_id;

  update public.question_options qo
  set removed_at = now()
  where qo.question_id = p_question_id
    and qo.removed_at is null
    and not (qo.id = any(v_payload_ids));

  get diagnostics v_deleted_count = row_count;

  for v_option in
    select value
    from jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
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

    if nullif(v_option->>'id', '') is not null then
      v_option_id := (v_option->>'id')::uuid;

      update public.question_options
      set
        content = v_option_content,
        is_correct = coalesce((v_option->>'is_correct')::boolean, false),
        label = v_label,
        order_index = v_option_order
      where id = v_option_id
        and question_id = p_question_id
        and removed_at is null
      returning id into v_updated_option_id;

      if v_updated_option_id is null then
        raise exception 'OPTION_NOT_FOUND';
      end if;

      v_updated_count := v_updated_count + 1;
    else
      insert into public.question_options (
        question_id,
        content,
        label,
        is_correct,
        order_index
      )
      values (
        p_question_id,
        v_option_content,
        v_label,
        coalesce((v_option->>'is_correct')::boolean, false),
        v_option_order
      );

      v_inserted_count := v_inserted_count + 1;
    end if;

    v_option_order := v_option_order + 1;
    v_updated_option_id := null;
  end loop;

  return jsonb_build_object(
    'question_id', p_question_id,
    'deleted_options', v_deleted_count,
    'updated_options', v_updated_count,
    'inserted_options', v_inserted_count
  );
end;
$$;

revoke all on function public.sync_question_with_options(uuid, text, text, jsonb) from public;
grant execute on function public.sync_question_with_options(uuid, text, text, jsonb) to authenticated;
grant execute on function public.sync_question_with_options(uuid, text, text, jsonb) to service_role;
