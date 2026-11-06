-- U2: read model cho trang /courses. Thêm RPC mới thay vì sửa get_public_course_catalog: migration hosted
-- được push trước khi merge, lúc đó app cũ vẫn parse catalog bằng schema .strict() và sẽ lỗi nếu có thêm cột.
-- security definer vì topics.is_preview và enrollments không đọc được bằng anon/authenticated; hàm chỉ trả về
-- dữ liệu công khai của khóa đã xuất bản.
-- Tính theo tập hợp (một lượt cho mọi khóa) thay vì gọi helper từng khóa: gọi private.d2_public_preview_is_eligible
-- cho từng chủ đề làm thời gian tăng theo số khóa (khoảng 0,5 ms mỗi lần gọi).
create function public.get_public_course_catalog_listing()
returns table (
  id uuid,
  title text,
  slug text,
  thumbnail_url text,
  price numeric,
  created_at timestamp with time zone,
  enrollment_count bigint,
  recent_enrollment_count bigint,
  topic_count integer,
  card_count integer,
  preview_topic_slug text,
  instructor_name text,
  description_excerpt text
)
language sql
stable
security definer
set search_path = ''
as $$
  with published_course as (
    select c.id, c.title, c.slug, c.thumbnail_url, c.price, c.created_at, c.description
    from public.courses as c
    where c.status = 'published'::public.item_status
      and c.removed_at is null
  ),
  -- Chủ đề chưa gỡ trong chương chưa gỡ, mọi trạng thái: đúng tập mà public.d2_preview_quota dùng để tính quota.
  active_topic as (
    select
      t.id,
      t.course_id,
      t.slug,
      t.status,
      t.is_preview,
      t.order_index,
      ch.id as chapter_id,
      ch.order_index as chapter_order_index
    from public.topics as t
    join public.chapters as ch
      on ch.id = t.chapter_id
     and ch.course_id = t.course_id
     and ch.removed_at is null
    join published_course as pc
      on pc.id = t.course_id
    where t.removed_at is null
  ),
  topic_card as (
    select cd.topic_id, count(*) as card_count
    from public.cards as cd
    join active_topic as at
      on at.id = cd.topic_id
     and at.status = 'published'::public.item_status
    where cd.removed_at is null
    group by cd.topic_id
  ),
  course_content as (
    select
      at.course_id,
      -- Số chủ đề/thẻ theo đúng đề cương công khai của get_public_course_detail: chỉ chủ đề published.
      count(*) filter (where at.status = 'published'::public.item_status)::integer as topic_count,
      coalesce(sum(tc.card_count), 0)::integer as card_count,
      count(*)::integer as active_topic_count,
      count(*) filter (where at.is_preview)::integer as marked_topic_count
    from active_topic as at
    left join topic_card as tc
      on tc.topic_id = at.id
    group by at.course_id
  ),
  -- Tương đương private.d2_public_preview_is_eligible (chủ đề published, chưa gỡ, có marker, chương chưa gỡ, khóa
  -- published và marker không vượt quota (active + 4) / 5). Chỉ dùng để hiển thị nút "Học thử" trên catalog; route học
  -- thử vẫn tự kiểm tra qua D2. Test integration đối chiếu kết quả này với helper để bắt lệch khi quy tắc D2 thay đổi.
  preview_topic as (
    select distinct on (at.course_id) at.course_id, at.slug
    from active_topic as at
    join course_content as cc
      on cc.course_id = at.course_id
    where at.is_preview
      and at.status = 'published'::public.item_status
      and cc.marked_topic_count <= (cc.active_topic_count + 4) / 5
    order by at.course_id, at.chapter_order_index, at.chapter_id, at.order_index, at.id
  ),
  course_enrollment as (
    select
      e.course_id,
      count(*) as enrollment_count,
      count(*) filter (where e.enrolled_at >= now() - interval '30 days') as recent_enrollment_count
    from public.enrollments as e
    join published_course as pc
      on pc.id = e.course_id
    group by e.course_id
  ),
  -- Cùng quy tắc owner với get_public_course_detail để không công khai tên của hồ sơ đã xóa mềm.
  course_owner as (
    select distinct on (cc.course_id) cc.course_id, nullif(btrim(p.full_name), '') as instructor_name
    from public.course_collaborators as cc
    join public.profiles as p
      on p.id = cc.user_id
     and p.removed_at is null
    join published_course as pc
      on pc.id = cc.course_id
    where cc.role = 'owner'::public.course_member_role
    order by cc.course_id, cc.created_at asc, cc.id asc
  )
  select
    pc.id,
    pc.title,
    pc.slug,
    pc.thumbnail_url,
    coalesce(pc.price, 0::numeric) as price,
    pc.created_at,
    coalesce(ce.enrollment_count, 0)::bigint as enrollment_count,
    coalesce(ce.recent_enrollment_count, 0)::bigint as recent_enrollment_count,
    coalesce(content.topic_count, 0) as topic_count,
    coalesce(content.card_count, 0) as card_count,
    pt.slug as preview_topic_slug,
    co.instructor_name,
    left(nullif(btrim(pc.description), ''), 240) as description_excerpt
  from published_course as pc
  left join course_content as content
    on content.course_id = pc.id
  left join preview_topic as pt
    on pt.course_id = pc.id
  left join course_enrollment as ce
    on ce.course_id = pc.id
  left join course_owner as co
    on co.course_id = pc.id
  order by pc.created_at desc, pc.id asc;
$$;

revoke all on function public.get_public_course_catalog_listing() from public;
grant execute on function public.get_public_course_catalog_listing()
  to anon, authenticated, service_role;
