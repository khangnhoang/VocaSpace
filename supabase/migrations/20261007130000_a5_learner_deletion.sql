-- AUTH-018: admin xóa được học viên đúng như /privacy hứa. Dữ liệu học của học viên bị xóa cùng tài khoản,
-- đơn thanh toán ở lại làm hồ sơ đơn hàng ẩn danh (user_id null). Chỉ động tới các bảng học viên và payments;
-- không bảng tác giả/kiểm duyệt nào được thêm ON DELETE (G5).

-- 1. payments: user_id cho phép null và FK ON DELETE SET NULL. Đơn đang chạy (creating/pending) bắt buộc có user_id,
--    nên xóa user có đơn đang chạy làm UPDATE SET NULL vi phạm CHECK và cả lần xóa bị hoàn tác.
alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint payments_user_id_fkey;
alter table public.payments
  add constraint payments_user_id_fkey foreign key (user_id) references public.profiles (id) on delete set null;
alter table public.payments
  add constraint payments_active_requires_user_check
  check (status not in ('creating', 'pending') or user_id is not null);

-- 2. Dữ liệu học của chính học viên: xóa theo hồ sơ.
alter table public.enrollments drop constraint enrollments_user_id_fkey;
alter table public.enrollments
  add constraint enrollments_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.user_topic_progress drop constraint utp_user_id_fkey;
alter table public.user_topic_progress
  add constraint utp_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.user_question_answers drop constraint uqa_user_id_fkey;
alter table public.user_question_answers
  add constraint uqa_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;

-- 3. RPC xóa học viên, chỉ service_role gọi được (sau requireAdmin ở Server Action).
-- Thứ tự khóa: auth.users rồi profiles, giống trigger đồng bộ email và FK cascade, nên đổi email song song và xóa
-- chỉ xếp hàng chờ nhau, không deadlock. Khóa profiles cũng chặn lời mời/đổi role/đơn mới commit chen vào giữa
-- lúc kiểm tra và xóa; mọi kiểm tra chạy lại sau khi có khóa (READ COMMITTED, mỗi câu lệnh một snapshot mới).
-- Trả về tên các object avatars do chính học viên tải lên (storage owner_id) để app xóa qua Storage API.
create or replace function public.admin_delete_learner(target uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_names text[];
begin
  perform 1 from auth.users u where u.id = target for update;
  if not found then raise exception 'LEARNER_NOT_FOUND'; end if;

  select p.role into v_role from public.profiles p where p.id = target for update;
  if not found then raise exception 'LEARNER_NOT_FOUND'; end if;

  if v_role <> 'student'::public.user_role then raise exception 'LEARNER_NOT_STUDENT'; end if;

  if exists (
    select 1 from public.payments pay
    where pay.user_id = target and pay.status in ('creating', 'pending')
  ) then
    raise exception 'LEARNER_HAS_ACTIVE_PAYMENT';
  end if;

  -- Lịch sử nhân sự/kiểm duyệt: xóa sẽ làm mất hoặc ẩn danh dấu vết, nên chuyển cho Owner xử lý thủ công.
  if exists (select 1 from public.course_collaborators x where x.user_id = target or x.added_by = target)
     or exists (
       select 1 from public.course_collaborator_invitations x
       where target in (x.invited_by_user_id, x.invitee_user_id, x.actioned_by_user_id))
     or exists (
       select 1 from public.topic_review_submissions x
       where target in (x.submitted_by_user_id, x.reviewed_by_user_id, x.cancelled_by_user_id))
     or exists (select 1 from public.review_notes x where target in (x.author_user_id, x.removed_by_user_id))
     or exists (
       select 1 from public.topic_authorship_feedback x
       where target in (x.actor_user_id, x.recipient_user_id, x.previous_responsible_user_id, x.new_responsible_user_id))
     or exists (
       select 1 from public.topic_contributors x
       where target in (x.user_id, x.added_by_user_id, x.removed_by_user_id))
     or exists (
       select 1 from public.topic_author_review_exclusions x
       where target in (x.user_id, x.recorded_by_user_id))
     or exists (select 1 from public.platform_moderation_audits x where x.actor_user_id = target)
     or exists (select 1 from public.courses x where x.reviewed_by = target)
     or exists (select 1 from public.chapters x where x.created_by_user_id = target)
     or exists (
       select 1 from public.topics x
       where target in (x.original_creator_user_id, x.responsible_author_user_id))
  then
    raise exception 'LEARNER_HAS_STAFF_HISTORY';
  end if;

  select coalesce(array_agg(o.name), '{}'::text[]) into v_names
  from storage.objects o
  where o.bucket_id = 'avatars' and o.owner_id = target::text;

  delete from auth.users where id = target;
  return v_names;
end;
$$;

revoke all on function public.admin_delete_learner(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_learner(uuid) to service_role;
