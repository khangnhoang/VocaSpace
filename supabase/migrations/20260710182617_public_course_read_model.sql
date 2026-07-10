create index if not exists idx_enrollments_course_id
  on public.enrollments (course_id);

create or replace function public.get_public_course_catalog()
returns table (
  id uuid,
  title text,
  slug text,
  thumbnail_url text,
  price numeric,
  created_at timestamp with time zone,
  enrollment_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.title,
    c.slug,
    c.thumbnail_url,
    coalesce(c.price, 0::numeric) as price,
    c.created_at,
    count(e.id)::bigint as enrollment_count
  from public.courses as c
  left join public.enrollments as e
    on e.course_id = c.id
  where c.status = 'published'::public.item_status
    and c.removed_at is null
  group by
    c.id,
    c.title,
    c.slug,
    c.thumbnail_url,
    c.price,
    c.created_at
  order by c.created_at desc, c.id asc;
$$;

create or replace function public.get_public_course_detail(p_course_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
                'order_index', t.order_index
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
  from public.courses as c
  where c.slug = p_course_slug
    and c.status = 'published'::public.item_status
    and c.removed_at is null
  limit 1;
$$;

revoke all on function public.get_public_course_catalog() from public;
grant execute on function public.get_public_course_catalog()
  to anon, authenticated, service_role;

revoke all on function public.get_public_course_detail(text) from public;
grant execute on function public.get_public_course_detail(text)
  to anon, authenticated, service_role;
