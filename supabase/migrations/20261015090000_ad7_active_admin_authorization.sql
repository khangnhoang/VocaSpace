-- AD7: một predicate cho đặc quyền admin; phiên còn hợp lệ không giữ quyền sau khi profile bị xóa mềm.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::public.user_role
      and p.removed_at is null
  );
$$;

CREATE OR REPLACE FUNCTION "public"."can_view_course_basic"("target_course_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_status text;
  v_removed_at timestamp with time zone;
  v_is_collaborator boolean;
BEGIN
  -- 1. Lấy trạng thái khóa học
  SELECT status, removed_at INTO v_status, v_removed_at
  FROM public.courses
  WHERE id = target_course_id;

  -- Khắc phục góp ý 1: Dùng FOUND biến native của PL/pgSQL, chặn đứng data bug
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 2. Nếu không đăng nhập: Chỉ được xem nếu đã PUBLISHED và CHƯA bị xóa
  IF auth.uid() IS NULL THEN
    RETURN (v_status = 'published' AND v_removed_at IS NULL);
  END IF;

  -- 3. Đã đăng nhập: Kiểm tra quyền tối cao (Admin hệ thống)
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  -- 4. CHỐT CHẶN THÙNG RÁC: Nếu khóa học đã bị xóa mềm
  -- Ngắt luồng sớm tại đây, đảm bảo chỉ quét bảng collaborators ĐÚNG 1 LẦN
  IF v_removed_at IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.course_collaborators cc
      WHERE cc.course_id = target_course_id
        AND cc.user_id = auth.uid()
        AND cc.role IN ('owner', 'co_owner')
    );
  END IF;

  -- 5. Nếu khóa học CHƯA bị xóa mềm (Trạng thái Active bình thường)
  SELECT EXISTS (
    SELECT 1 FROM public.course_collaborators cc
    WHERE cc.course_id = target_course_id
      AND cc.user_id = auth.uid()
      AND cc.role IN ('owner', 'co_owner', 'editor', 'previewer')
  ) INTO v_is_collaborator;

  IF v_status = 'published' THEN
    RETURN true;
  ELSE
    RETURN v_is_collaborator;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."has_course_content_read_access"("target_course_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_status text;
  v_removed_at timestamp with time zone;
BEGIN
  SELECT status, removed_at INTO v_status, v_removed_at
  FROM public.courses
  WHERE id = target_course_id;

  -- Khóa học cha bị xóa mềm -> Đóng băng toàn bộ tài nguyên con trực thuộc
  IF v_removed_at IS NOT NULL THEN
    IF auth.uid() IS NULL THEN RETURN false; END IF;
    RETURN public.is_admin();
  END IF;

  -- Xem tài nguyên bài học/đề thi bắt buộc phải có tài khoản đăng nhập
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Đặc quyền kiểm thử: Admin, Giáo viên quản trị, và Previewer được xem trước không cần mua/enroll
  IF public.is_admin() THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM public.course_collaborators cc
    WHERE cc.course_id = target_course_id
      AND cc.user_id = auth.uid()
      AND cc.role IN ('owner', 'co_owner', 'editor', 'previewer')
  ) THEN
    RETURN true;
  END IF;

  -- Đối với học viên thông thường: Khóa học bắt buộc phải PUBLISHED mới được kiểm tra phân quyền truy cập
  IF v_status != 'published' THEN
    RETURN false;
  END IF;

  -- CHỐT CHẶN KHÓA CỔNG: Phải tồn tại một bản ghi hợp lệ trong bảng enrollments
  RETURN EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = target_course_id AND e.user_id = auth.uid()
  );
END;
$$;

create or replace function public.moderate_platform_content(
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_course_id uuid;
  v_previous_status public.item_status;
  v_previous_removed_at timestamptz;
  v_topic_ids uuid[];
  v_active_pending_ids uuid[];
  v_cancelled integer := 0;
  v_audit_id uuid;
  v_before record;
  v_after record;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin() then
    raise exception 'ADMIN_MODERATION_FORBIDDEN';
  end if;
  if p_target_type not in ('course', 'chapter', 'topic') then raise exception 'MODERATION_TARGET_INVALID'; end if;
  if p_action not in ('demote', 'takedown', 'invalidate_review') then raise exception 'MODERATION_ACTION_INVALID'; end if;
  if v_reason is null then raise exception 'MODERATION_REASON_REQUIRED'; end if;
  if length(v_reason) > 2000 then raise exception 'MODERATION_REASON_TOO_LONG'; end if;

  if p_target_type = 'topic' then
    select t.course_id, t.status, t.removed_at
    into v_course_id, v_previous_status, v_previous_removed_at
    from public.topics t where t.id = p_target_id;
    if v_course_id is null then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    perform pg_advisory_xact_lock(hashtext(p_target_id::text));
    select t.status, t.removed_at
    into v_previous_status, v_previous_removed_at
    from public.topics t where t.id = p_target_id for update;
    if p_action = 'invalidate_review' and v_previous_status <> 'pending' then
      raise exception 'MODERATION_TARGET_STATE_INVALID';
    elsif p_action = 'demote' and v_previous_status not in ('published', 'pending') then
      raise exception 'MODERATION_TARGET_STATE_INVALID';
    elsif p_action = 'takedown' and v_previous_removed_at is not null then
      raise exception 'MODERATION_TARGET_ALREADY_REMOVED';
    end if;
    select * into v_before from public.d2_preview_quota(v_course_id);
    if v_previous_status = 'pending' then
      v_cancelled := public.d1_cancel_pending_reviews_for_topics(array[p_target_id], v_actor, v_reason);
    end if;
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    perform set_config('voca.d2_preview_internal_mutation', 'on', true);
    update public.topics t
    set status = 'draft',
        removed_at = case when p_action = 'takedown' then timezone('utc', now()) else null end,
        is_preview = case when p_action = 'takedown' then false else t.is_preview end
    where t.id = p_target_id;
  elsif p_target_type = 'chapter' then
    select ch.course_id, ch.removed_at
    into v_course_id, v_previous_removed_at
    from public.chapters ch where ch.id = p_target_id;
    if v_course_id is null then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    select ch.removed_at into v_previous_removed_at
    from public.chapters ch where ch.id = p_target_id for update;
    if p_action <> 'takedown' or v_previous_removed_at is not null then
      raise exception 'MODERATION_ACTION_NOT_SUPPORTED';
    end if;
    select * into v_before from public.d2_preview_quota(v_course_id);
    select array_agg(t.id order by t.id),
           array_agg(t.id order by t.id) filter (where t.removed_at is null and t.status = 'pending')
    into v_topic_ids, v_active_pending_ids
    from public.topics t where t.chapter_id = p_target_id and t.course_id = v_course_id;
    if v_topic_ids is not null then perform public.d1_lock_topics_for_moderation(v_topic_ids); end if;
    if v_active_pending_ids is not null then
      v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_active_pending_ids, v_actor, v_reason);
    end if;
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    perform set_config('voca.d2_preview_internal_mutation', 'on', true);
    update public.topics t set is_preview = false
    where t.course_id = v_course_id and t.chapter_id = p_target_id and t.is_preview;
    update public.chapters ch set removed_at = timezone('utc', now()) where ch.id = p_target_id;
    v_previous_status := null;
  else
    select c.status, c.removed_at
    into v_previous_status, v_previous_removed_at
    from public.courses c where c.id = p_target_id;
    if not found then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    v_course_id := p_target_id;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    select c.status, c.removed_at
    into v_previous_status, v_previous_removed_at
    from public.courses c where c.id = p_target_id for update;
    if not found then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    select * into v_before from public.d2_preview_quota(v_course_id);
    if p_action = 'demote' then
      if v_previous_status <> 'published' then raise exception 'MODERATION_TARGET_STATE_INVALID'; end if;
      select array_agg(t.id order by t.id) into v_active_pending_ids
      from public.topics t
      where t.course_id = p_target_id and t.status = 'pending' and t.removed_at is null;
      if v_active_pending_ids is not null then
        perform public.d1_lock_topics_for_moderation(v_active_pending_ids);
        v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_active_pending_ids, v_actor, v_reason);
      end if;
      update public.courses c set status = 'draft' where c.id = p_target_id;
    elsif p_action = 'takedown' then
      if v_previous_removed_at is not null then raise exception 'MODERATION_TARGET_ALREADY_REMOVED'; end if;
      select array_agg(t.id order by t.id),
             array_agg(t.id order by t.id) filter (where t.status = 'pending' and t.removed_at is null)
      into v_topic_ids, v_active_pending_ids
      from public.topics t where t.course_id = p_target_id;
      if v_topic_ids is not null then perform public.d1_lock_topics_for_moderation(v_topic_ids); end if;
      if v_active_pending_ids is not null then
        v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_active_pending_ids, v_actor, v_reason);
      end if;
      perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
      perform set_config('voca.d2_preview_internal_mutation', 'on', true);
      update public.topics t set is_preview = false
      where t.course_id = p_target_id and t.is_preview;
      update public.courses c
      set status = 'draft', removed_at = timezone('utc', now())
      where c.id = p_target_id;
    else
      raise exception 'MODERATION_ACTION_NOT_SUPPORTED';
    end if;
  end if;

  insert into public.platform_moderation_audits (
    actor_user_id, target_type, target_id, action, reason, previous_status, previous_removed_at
  ) values (
    v_actor, p_target_type, p_target_id, p_action, v_reason, v_previous_status, v_previous_removed_at
  ) returning id into v_audit_id;

  select * into v_after from public.d2_preview_quota(v_course_id);
  if v_after.marked_topic_count <= v_after.quota_cap then
    delete from public.course_preview_moderation_causes p where p.course_id = v_course_id;
  elsif v_before.marked_topic_count <= v_before.quota_cap then
    insert into public.course_preview_moderation_causes(course_id, audit_id, created_at)
    values (v_course_id, v_audit_id, timezone('utc', now()))
    on conflict (course_id) do update
      set audit_id = excluded.audit_id,
          created_at = excluded.created_at;
  end if;

  return jsonb_build_object(
    'status', case when p_action = 'takedown' then 'removed' else 'draft' end,
    'course_id', v_course_id,
    'target_type', p_target_type,
    'target_id', p_target_id,
    'audit_id', v_audit_id,
    'cancelled_reviews', v_cancelled
  );
end;
$$;

-- Giữ nhánh uploader; chỉ thay đặc quyền xóa thumbnail của admin toàn cục.
alter policy "Owner or Admin Delete Thumbnails" on storage.objects
using (
  bucket_id = 'course_thumbnails'
  and (owner = auth.uid() or public.is_admin())
);
