-- D3 C5: the public preview reports each exercise's activity stage so the
-- preview can show a memory check (part_type null) as its own transient stage.
-- Same body, gate and grants as 20260924120000; only `activity_stage` is added.
-- Grading stays in get_public_course_preview_answer, which already scores the
-- selected option statelessly and never writes learner rows.

create or replace function public.get_public_course_preview(
  p_course_slug text,
  p_topic_slug text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select c.id as course_id, c.slug as course_slug, c.title as course_title,
      t.id as topic_id, t.slug as topic_slug, t.title as topic_title,
      t.description as topic_description
    from public.courses as c
    join public.chapters as ch
      on ch.course_id = c.id
     and ch.removed_at is null
    join public.topics as t
      on t.course_id = c.id
     and t.chapter_id = ch.id
    where c.slug = p_course_slug
      and t.slug = p_topic_slug
      and private.d2_public_preview_is_eligible(t.id)
    limit 1
  )
  select jsonb_build_object(
    'course', jsonb_build_object(
      'slug', target.course_slug,
      'title', target.course_title
    ),
    'topic', jsonb_build_object(
      'id', target.topic_id,
      'slug', target.topic_slug,
      'title', target.topic_title,
      'description', target.topic_description
    ),
    'flashcards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', card.id,
        'front_content', jsonb_strip_nulls(jsonb_build_object(
          'word', card.front_content -> 'word',
          'pos', card.front_content -> 'pos',
          'phonetic', card.front_content -> 'phonetic'
        )),
        'back_content', jsonb_strip_nulls(jsonb_build_object(
          'translation', card.back_content -> 'translation',
          'example', card.back_content -> 'example',
          'exampleTranslation', card.back_content -> 'exampleTranslation',
          'explanation', card.back_content -> 'explanation',
          'hint', card.back_content -> 'hint'
        )),
        'audio_url', card.audio_url,
        'image_url', card.image_url,
        'order_index', coalesce(card.order_index, 0)
      ) order by card.order_index asc, card.id asc)
      from public.cards as card
      where card.topic_id = target.topic_id
        and card.removed_at is null
    ), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', exercise.id,
        'title', exercise.title,
        'activity_stage', exercise.activity_stage,
        'part_type', exercise.part_type,
        'order_index', coalesce(exercise.order_index, 0),
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', question.id,
            'content', question.content,
            'order_index', coalesce(question.order_index, 0),
            'options', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', option_row.id,
                'content', option_row.content,
                'label', option_row.label,
                'order_index', coalesce(option_row.order_index, 0)
              ) order by option_row.order_index asc, option_row.id asc)
              from public.question_options as option_row
              where option_row.question_id = question.id
                and option_row.removed_at is null
            ), '[]'::jsonb)
          ) order by question.order_index asc, question.id asc)
          from public.questions as question
          where question.exercise_id = exercise.id
            and question.course_id = target.course_id
            and question.group_id is null
            and question.removed_at is null
        ), '[]'::jsonb),
        'groups', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', question_group.id,
            'passage_text', question_group.passage_text,
            'audio_url', question_group.audio_url,
            'image_url', question_group.image_url,
            'order_index', coalesce(question_group.order_index, 0),
            'questions', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', question.id,
                'content', question.content,
                'order_index', coalesce(question.order_index, 0),
                'options', coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'id', option_row.id,
                    'content', option_row.content,
                    'label', option_row.label,
                    'order_index', coalesce(option_row.order_index, 0)
                  ) order by option_row.order_index asc, option_row.id asc)
                  from public.question_options as option_row
                  where option_row.question_id = question.id
                    and option_row.removed_at is null
                ), '[]'::jsonb)
              ) order by question.order_index asc, question.id asc)
              from public.questions as question
              where question.exercise_id = exercise.id
                and question.course_id = target.course_id
                and question.group_id = question_group.id
                and question.removed_at is null
            ), '[]'::jsonb)
          ) order by question_group.order_index asc, question_group.id asc)
          from public.question_groups as question_group
          where question_group.exercise_id = exercise.id
            and question_group.removed_at is null
        ), '[]'::jsonb)
      ) order by exercise.order_index asc, exercise.id asc)
      from public.exercises as exercise
      where exercise.topic_id = target.topic_id
        and exercise.course_id = target.course_id
        and exercise.removed_at is null
    ), '[]'::jsonb)
  )
  from target;
$$;

revoke all on function public.get_public_course_preview(text, text)
  from public, anon, authenticated;
grant execute on function public.get_public_course_preview(text, text)
  to service_role;
