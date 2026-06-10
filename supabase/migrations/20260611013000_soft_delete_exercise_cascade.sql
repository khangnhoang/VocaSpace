create or replace function public.soft_delete_exercise_cascade(
  p_exercise_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exercise record;
  v_removed_at timestamptz := now();
  v_deleted_options integer := 0;
  v_deleted_questions integer := 0;
  v_deleted_groups integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Lock the parent exercise so concurrent authoring/deletion cannot race the cascade.
  select e.id, e.course_id, e.removed_at
  into v_exercise
  from public.exercises e
  where e.id = p_exercise_id
  for update;

  if not found then
    raise exception 'EXERCISE_NOT_FOUND';
  end if;

  if v_exercise.removed_at is not null then
    raise exception 'EXERCISE_ALREADY_REMOVED';
  end if;

  if not (
    public.is_admin()
    or public.has_course_management_access(v_exercise.course_id)
  ) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  -- SECURITY DEFINER keeps this cascade atomic without depending on child-table RLS checks.
  -- Descendants are soft-deleted before the parent so no active option remains under a removed exercise.
  update public.question_options qo
  set removed_at = v_removed_at
  where qo.removed_at is null
    and exists (
      select 1
      from public.questions q
      where q.id = qo.question_id
        and q.exercise_id = p_exercise_id
    );

  get diagnostics v_deleted_options = row_count;

  update public.questions q
  set removed_at = v_removed_at
  where q.exercise_id = p_exercise_id
    and q.removed_at is null;

  get diagnostics v_deleted_questions = row_count;

  update public.question_groups qg
  set removed_at = v_removed_at
  where qg.exercise_id = p_exercise_id
    and qg.removed_at is null;

  get diagnostics v_deleted_groups = row_count;

  update public.exercises e
  set removed_at = v_removed_at
  where e.id = p_exercise_id
    and e.removed_at is null;

  return jsonb_build_object(
    'exercise_id', p_exercise_id,
    'deleted_options', v_deleted_options,
    'deleted_questions', v_deleted_questions,
    'deleted_groups', v_deleted_groups,
    'removed_at', v_removed_at
  );
end;
$$;

revoke all on function public.soft_delete_exercise_cascade(uuid) from public;
grant execute on function public.soft_delete_exercise_cascade(uuid) to authenticated;
grant execute on function public.soft_delete_exercise_cascade(uuid) to service_role;
