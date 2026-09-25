create or replace function public.get_public_course_detail(p_course_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_course as (
    select c.*, quota.marked_topic_count, quota.quota_cap
    from public.courses as c
    cross join lateral public.d2_preview_quota(c.id) as quota
    where c.slug = p_course_slug
      and c.status = 'published'::public.item_status
      and c.removed_at is null
    limit 1
  )
  select jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'slug', c.slug,
    'description', c.description,
    'thumbnail_url', c.thumbnail_url,
    'price', coalesce(c.price, 0::numeric),
    'created_at', c.created_at,
    'enrollment_count', (
      select count(*)::bigint
      from public.enrollments as e
      where e.course_id = c.id
    ),
    'is_preview_suspended', c.marked_topic_count > c.quota_cap,
    'owner', (
      select jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'avatar_url', p.avatar_url,
        'bio', tp.bio,
        'experience_years', tp.experience_years,
        'certifications', tp.certifications
      )
      from public.course_collaborators as cc
      join public.profiles as p
        on p.id = cc.user_id
       and p.removed_at is null
      left join public.teacher_profiles as tp
        on tp.id = p.id
      where cc.course_id = c.id
        and cc.role = 'owner'::public.course_member_role
      order by cc.created_at asc, cc.id asc
      limit 1
    ),
    'collaborators', coalesce((
      select jsonb_agg(
        collaborator.presentation
        order by collaborator.created_at asc, collaborator.collaborator_id asc
      )
      from (
        select
          cc.created_at,
          cc.id as collaborator_id,
          jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'avatar_url', p.avatar_url,
            'bio', tp.bio,
            'experience_years', tp.experience_years,
            'certifications', tp.certifications
          ) as presentation
        from public.course_collaborators as cc
        join public.profiles as p
          on p.id = cc.user_id
         and p.removed_at is null
        left join public.teacher_profiles as tp
          on tp.id = p.id
        where cc.course_id = c.id
          and cc.role in (
            'co_owner'::public.course_member_role,
            'editor'::public.course_member_role
          )
      ) as collaborator
    ), '[]'::jsonb),
    'syllabus', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ch.id,
          'title', ch.title,
          'order_index', ch.order_index,
          'topics', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', t.id,
                'title', t.title,
                'slug', t.slug,
                'order_index', t.order_index,
                'is_preview', t.is_preview
                  and c.marked_topic_count <= c.quota_cap
              )
              order by t.order_index asc, t.id asc
            )
            from public.topics as t
            where t.course_id = c.id
              and t.chapter_id = ch.id
              and t.status = 'published'::public.item_status
              and t.removed_at is null
          ), '[]'::jsonb)
        )
        order by ch.order_index asc, ch.id asc
      )
      from public.chapters as ch
      where ch.course_id = c.id
        and ch.removed_at is null
    ), '[]'::jsonb)
  )
  from eligible_course as c;
$$;

revoke all on function public.get_public_course_detail(text) from public;
grant execute on function public.get_public_course_detail(text)
  to anon, authenticated, service_role;

create or replace function private.d2_public_preview_is_eligible(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.topics as t
    join public.chapters as ch
      on ch.id = t.chapter_id
     and ch.course_id = t.course_id
    join public.courses as c
      on c.id = t.course_id
    cross join lateral public.d2_preview_quota(c.id) as quota
    where t.id = p_topic_id
      and t.status = 'published'::public.item_status
      and t.removed_at is null
      and t.is_preview
      and ch.removed_at is null
      and c.status = 'published'::public.item_status
      and c.removed_at is null
      and quota.marked_topic_count <= quota.quota_cap
  );
$$;

revoke all on function private.d2_public_preview_is_eligible(uuid)
  from public, anon, authenticated, service_role;

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

create or replace function public.get_public_course_preview_answer(
  p_course_slug text,
  p_topic_slug text,
  p_question_id uuid,
  p_option_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'is_correct', selected_option.is_correct,
    'explanation', question.explanation
  )
  from public.courses as c
  join public.chapters as ch
    on ch.course_id = c.id
   and ch.removed_at is null
  join public.topics as t
    on t.course_id = c.id
   and t.chapter_id = ch.id
  join public.exercises as exercise
    on exercise.course_id = c.id
   and exercise.topic_id = t.id
   and exercise.removed_at is null
  join public.questions as question
    on question.course_id = c.id
   and question.exercise_id = exercise.id
   and question.id = p_question_id
   and question.removed_at is null
  join public.question_options as selected_option
    on selected_option.question_id = question.id
   and selected_option.id = p_option_id
   and selected_option.removed_at is null
  where c.slug = p_course_slug
    and c.status = 'published'::public.item_status
    and c.removed_at is null
    and t.slug = p_topic_slug
    and private.d2_public_preview_is_eligible(t.id)
    and (
      question.group_id is null
      or exists (
        select 1 from public.question_groups as question_group
        where question_group.id = question.group_id
          and question_group.exercise_id = exercise.id
          and question_group.removed_at is null
      )
    )
  limit 1;
$$;

revoke all on function public.get_public_course_preview_answer(text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_course_preview_answer(text, text, uuid, uuid)
  to service_role;

create or replace function public.get_public_course_preview_group_media(
  p_group_id uuid,
  p_type text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'course_id', c.id,
    'topic_id', t.id,
    'media_reference', case p_type
      when 'image' then question_group.image_url
      when 'audio' then question_group.audio_url
      else null
    end
  )
  from public.question_groups as question_group
  join public.exercises as exercise
    on exercise.id = question_group.exercise_id
   and exercise.removed_at is null
  join public.topics as t
    on t.id = exercise.topic_id
   and t.course_id = exercise.course_id
  join public.chapters as ch
    on ch.id = t.chapter_id
   and ch.course_id = t.course_id
   and ch.removed_at is null
  join public.courses as c
    on c.id = t.course_id
   and c.status = 'published'::public.item_status
   and c.removed_at is null
  where question_group.id = p_group_id
    and question_group.removed_at is null
    and p_type in ('image', 'audio')
    and private.d2_public_preview_is_eligible(t.id)
  limit 1;
$$;

revoke all on function public.get_public_course_preview_group_media(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_public_course_preview_group_media(uuid, text)
  to service_role;
