-- D1 P2: durable review notes attached to a topic, with row-level permissions
-- derived from the topic alone.
--
-- Ghi chú phản hồi KHÔNG mang verdict: nó không duyệt, không từ chối, không
-- chặn và không đổi `status` của topic. Vì vậy toàn bộ lớp race của thiết kế cũ
-- (thứ tự note so với verdict) biến mất — không cần `order_index`, không cần
-- ràng buộc thứ tự.
--
-- Quyền LUÔN suy trực tiếp từ `topic_id`, không bao giờ suy ngược qua
-- `cards`/`exercises`. Đây chính là chỗ đã sinh ra drift ở thiết kế cũ.

create table if not exists public.review_notes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete cascade,
  -- Server-owned: default auth.uid() để client không bao giờ gửi field này.
  author_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  removed_at timestamptz,
  removed_by_user_id uuid references public.profiles(id) on delete set null,
  -- Note gắn tối đa một đối tượng: card HOẶC exercise HOẶC không gắn gì (note cấp topic).
  constraint review_notes_single_target_check check (num_nonnulls(card_id, exercise_id) <= 1),
  constraint review_notes_body_not_blank_check check (nullif(btrim(body), '') is not null),
  constraint review_notes_body_length_check check (length(body) <= 2000)
);

-- Khớp đúng query đọc note của một topic (mới nhất trước).
create index if not exists review_notes_topic_created_idx
  on public.review_notes (topic_id, created_at desc, id desc);

create index if not exists review_notes_card_idx
  on public.review_notes (card_id) where card_id is not null;

create index if not exists review_notes_exercise_idx
  on public.review_notes (exercise_id) where exercise_id is not null;

-- Dùng lại helper updated-at sẵn có, không tạo helper mới.
drop trigger if exists set_updated_at_review_notes on public.review_notes;
create trigger set_updated_at_review_notes
before update on public.review_notes
for each row execute function public.handle_updated_at();

-- Ép invariant "note chỉ trỏ content thuộc đúng topic_id" ở tầng DB thay vì
-- composite FK (tránh thêm `unique (id, topic_id)` trên cards/exercises).
-- Trigger ép được cả khi ghi bằng service_role.
create or replace function public.d1_guard_review_note_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- UPDATE: các cột định danh bất biến. Chỉ body / updated_at / removed_at được đổi.
  if tg_op = 'UPDATE' and (
    new.topic_id is distinct from old.topic_id
    or new.author_user_id is distinct from old.author_user_id
    or new.card_id is distinct from old.card_id
    or new.exercise_id is distinct from old.exercise_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'REVIEW_NOTE_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;

  -- Chỉ kiểm tra đích khi INSERT. Cố ý KHÔNG kiểm lại khi UPDATE:
  -- một card/exercise có thể bị xóa mềm sau khi note được viết, và tác giả
  -- vẫn phải sửa được nội dung note của mình.
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.topics t
      where t.id = new.topic_id and t.removed_at is null
    ) then
      raise exception 'TOPIC_NOT_FOUND';
    end if;

    if new.card_id is not null and not exists (
      select 1 from public.cards c
      where c.id = new.card_id and c.topic_id = new.topic_id and c.removed_at is null
    ) then
      raise exception 'REVIEW_NOTE_TARGET_TOPIC_MISMATCH';
    end if;

    if new.exercise_id is not null and not exists (
      select 1 from public.exercises e
      where e.id = new.exercise_id and e.topic_id = new.topic_id and e.removed_at is null
    ) then
      raise exception 'REVIEW_NOTE_TARGET_TOPIC_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists d1_guard_review_note_mutation on public.review_notes;
create trigger d1_guard_review_note_mutation
before insert or update on public.review_notes
for each row execute function public.d1_guard_review_note_mutation();

revoke all on function public.d1_guard_review_note_mutation() from public, anon, authenticated;

-- Helper cho đường đọc: hai helper sẵn có đều không diễn đạt được biên này.
--   * `has_topic_review_access` (F21) LOẠI TRỪ creator/responsible/contributor
--     → creator không thấy được note của topic mình.
--   * `d1_topic_group_member` (F20) không bao gồm creator, chỉ nhận
--     owner/co_owner/editor (trượt previewer có can_review_topics), và bỏ qua
--     reviewer không thuộc nhóm tác giả.
create or replace function public.d1_can_read_topic_review_notes(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    -- Nhánh reviewer: đã gồm owner/co-owner và editor/previewer có can_review_topics.
    public.has_topic_review_access(p_topic_id)
    -- Nhánh participant: creator / responsible / contributor đang hoạt động,
    -- nhưng BẮT BUỘC còn là thành viên khoá học (mất role = mất quyền).
    -- Đây là compensating control: remove/leave collaborator không dọn
    -- topic_contributors.
    or exists (
      select 1
      from public.topics t
      join public.chapters ch on ch.id = t.chapter_id
      join public.courses c on c.id = t.course_id
      join public.course_collaborators cc
        on cc.course_id = t.course_id and cc.user_id = auth.uid()
      join public.profiles p on p.id = auth.uid()
      where t.id = p_topic_id
        and t.removed_at is null
        and ch.removed_at is null
        and ch.course_id = t.course_id
        and c.removed_at is null
        and p.removed_at is null
        and cc.role in (
          'owner'::public.course_member_role,
          'co_owner'::public.course_member_role,
          'editor'::public.course_member_role,
          'previewer'::public.course_member_role
        )
        and (
          t.original_creator_user_id = auth.uid()
          or t.responsible_author_user_id = auth.uid()
          or exists (
            select 1 from public.topic_contributors tc
            where tc.topic_id = t.id and tc.user_id = auth.uid() and tc.removed_at is null
          )
        )
    )
  )
$$;

revoke all on function public.d1_can_read_topic_review_notes(uuid) from public, anon;
grant execute on function public.d1_can_read_topic_review_notes(uuid) to authenticated, service_role;

alter table public.review_notes enable row level security;

-- Đây là bảng D1 DUY NHẤT cấp quyền cho `authenticated` thay vì service_role-only.
-- Bù lại: guard trigger ép đích + bất biến, và WITH CHECK ép quyền sở hữu.
revoke all on table public.review_notes from public, anon;
grant select, insert, update on table public.review_notes to authenticated;
grant all on table public.review_notes to service_role;
-- Không grant DELETE: hard delete là bất khả thi với `authenticated`.

drop policy if exists "Review notes - Reader select" on public.review_notes;
create policy "Review notes - Reader select" on public.review_notes
for select to authenticated
using (public.d1_can_read_topic_review_notes(topic_id));

drop policy if exists "Review notes - Reviewer insert" on public.review_notes;
create policy "Review notes - Reviewer insert" on public.review_notes
for insert to authenticated
with check (
  author_user_id = auth.uid()
  and public.has_topic_review_access(topic_id)
  and removed_at is null
  and removed_by_user_id is null
);

drop policy if exists "Review notes - Author update" on public.review_notes;
create policy "Review notes - Author update" on public.review_notes
for update to authenticated
using (author_user_id = auth.uid())
with check (
  author_user_id = auth.uid()
  and public.has_topic_review_access(topic_id)
  and (
    (removed_at is null and removed_by_user_id is null)
    or (removed_at is not null and removed_by_user_id = auth.uid())
  )
);
