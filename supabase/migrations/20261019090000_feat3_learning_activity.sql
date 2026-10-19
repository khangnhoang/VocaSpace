-- FEAT3: máy chủ ghi lại mỗi hành động học (trả lời bài tập/memory check, chấm thẻ) theo từng phút để tính streak,
-- chủ đề học gần đây và thời gian học ước tính. Không backfill từ dữ liệu cũ (plan r3, G1-G6).
-- Contract: docs/programs/student-user-flow-route/implementation-plans/feat3/plan.md.
-- Rollback: supabase/rollbacks/20261019090000_feat3_learning_activity.down.sql (dừng ghi và gỡ RPC đọc, giữ bảng và lịch sử).
-- Không đổi RPC `lf2_submit_question_answer`, `lf2_submit_card_review`, policy, cổng hay chế độ bảo mật nào hiện có.

-- 1. Bảng: một dòng cho mỗi (học viên, topic, phút). Khóa chính là khóa idempotent của G2 và cũng là index tra "dòng mới nhất
--    của một topic". FK ghép (topic_id, course_id) bắt course luôn đúng là course của topic (cùng mẫu với `exercises`);
--    cascade để dọn topic không bị chặn bởi bảng này, giống `cards`/`exercises`.
create table public.user_learning_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null,
  course_id uuid not null,
  activity_minute timestamptz not null,
  constraint user_learning_activity_pkey primary key (user_id, topic_id, activity_minute),
  constraint user_learning_activity_topic_course_fkey
    foreign key (topic_id, course_id) references public.topics (id, course_id) on delete cascade
);

-- Hai index đọc của G6: tổng thể (streak, 7 ngày, tuần) và theo course (streak course).
create index user_learning_activity_user_time_idx on public.user_learning_activity (user_id, activity_minute desc);
create index user_learning_activity_user_course_time_idx
  on public.user_learning_activity (user_id, course_id, activity_minute desc);

-- 2. Quyền: chỉ chủ dòng được đọc; không ai trong anon/authenticated/service_role ghi hay xóa trực tiếp (G4, AC8).
--    Dòng chỉ đến từ trigger SECURITY DEFINER bên dưới. Revoke cả quyền mặc định Supabase cấp cho bảng mới.
alter table public.user_learning_activity enable row level security;
revoke all on table public.user_learning_activity from public, anon, authenticated, service_role;
grant select on table public.user_learning_activity to authenticated;
create policy "User_learning_activity - Own Select" on public.user_learning_activity
  for select to authenticated using ((select auth.uid()) = user_id);

-- 3. Ngày và tuần luôn tính bằng SQL theo Asia/Ho_Chi_Minh, một nơi duy nhất (G3).
create function private.feat3_ict_date(p_at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$ select (p_at at time zone 'Asia/Ho_Chi_Minh')::date $$;

create function private.feat3_ict_day_start(p_day date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$ select p_day::timestamp at time zone 'Asia/Ho_Chi_Minh' $$;

revoke all on function private.feat3_ict_date(timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.feat3_ict_day_start(date) from public, anon, authenticated, service_role;

-- 4. Ghi hoạt động. Trigger SECURITY DEFINER chạy cùng transaction với dòng đáp án/thẻ đã lưu (G1). Chỉ ghi khi
--    auth.uid() chính là chủ dòng, nên migration, backfill, service_role và trigger LF9 (không đụng hai bảng này) không ghi.
--    Phép ghi nằm trong subtransaction bắt cả OTHERS và QUERY_CANCELED (57014): lỗi hay timeout ở đây không làm hỏng
--    hay rollback hành động học (G2, AC10). Course lấy từ chính topic để không thể lệch với khóa ngoại.
create function private.feat3_record_learning_activity(p_user_id uuid, p_topic_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.user_learning_activity (user_id, topic_id, course_id, activity_minute)
  select p_user_id, t.id, t.course_id, date_trunc('minute', now())
  from public.topics t
  where t.id = p_topic_id
  on conflict (user_id, topic_id, activity_minute) do nothing
$$;

revoke all on function private.feat3_record_learning_activity(uuid, uuid) from public, anon, authenticated, service_role;

create function private.feat3_record_answer_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic_id uuid;
begin
  if (select auth.uid()) is distinct from new.user_id then return null; end if;
  begin
    select e.topic_id into v_topic_id
    from public.questions q
    join public.exercises e on e.id = q.exercise_id
    where q.id = new.question_id;
    if v_topic_id is not null then
      perform private.feat3_record_learning_activity(new.user_id, v_topic_id);
    end if;
  exception when others or query_canceled then
    null;
  end;
  return null;
end;
$$;

create function private.feat3_record_card_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic_id uuid;
begin
  if (select auth.uid()) is distinct from new.user_id then return null; end if;
  begin
    select c.topic_id into v_topic_id from public.cards c where c.id = new.card_id;
    if v_topic_id is not null then
      perform private.feat3_record_learning_activity(new.user_id, v_topic_id);
    end if;
  exception when others or query_canceled then
    null;
  end;
  return null;
end;
$$;

revoke all on function private.feat3_record_answer_activity() from public, anon, authenticated, service_role;
revoke all on function private.feat3_record_card_activity() from public, anon, authenticated, service_role;

-- `update of <cột>` kích hoạt khi cột nằm trong SET, kể cả giá trị không đổi: nộp lại cùng đáp án/điểm vẫn tính, còn một lệnh
-- chỉ đổi `updated_at` thì không.
create trigger feat3_record_answer_activity
after insert or update of selected_option_id on public.user_question_answers
for each row execute function private.feat3_record_answer_activity();

create trigger feat3_record_card_activity
after insert or update of last_rating on public.user_flashcards
for each row execute function private.feat3_record_card_activity();

-- 5. Đọc. Mỗi phần có chi phí bị chặn bởi thứ nó hiển thị, không theo độ dài lịch sử (G6).
-- Một ngày có hoạt động hay không: một tra cứu index, dừng ở dòng đầu tiên.
create function private.feat3_day_has_activity(p_user_id uuid, p_course_id uuid, p_day date)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_start timestamptz := private.feat3_ict_day_start(p_day);
  v_end timestamptz := private.feat3_ict_day_start(p_day + 1);
  v_found boolean;
begin
  -- Hai nhánh riêng để mỗi nhánh dùng đúng index của nó thay vì một plan chung cho `course_id is null or ...`.
  if p_course_id is null then
    select exists (
      select 1 from public.user_learning_activity a
      where a.user_id = p_user_id and a.activity_minute >= v_start and a.activity_minute < v_end
    ) into v_found;
  else
    select exists (
      select 1 from public.user_learning_activity a
      where a.user_id = p_user_id and a.course_id = p_course_id
        and a.activity_minute >= v_start and a.activity_minute < v_end
    ) into v_found;
  end if;
  return v_found;
end;
$$;

-- Streak: số ngày liên tiếp kết thúc hôm nay, hoặc hôm qua khi hôm nay chưa có hành động; ngược lại 0 (AC3).
-- Đi lùi từng ngày và dừng ở ngày trống đầu tiên, nên chi phí theo độ dài streak.
create function private.feat3_streak(p_user_id uuid, p_course_id uuid, p_today date)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_probe date := p_today;
  v_streak integer := 0;
begin
  if not private.feat3_day_has_activity(p_user_id, p_course_id, p_today) then
    v_probe := p_today - 1;
  end if;
  while private.feat3_day_has_activity(p_user_id, p_course_id, v_probe) loop
    v_streak := v_streak + 1;
    v_probe := v_probe - 1;
  end loop;
  return v_streak;
end;
$$;

-- Thời gian học tuần này (thứ Hai 00:00 đến bây giờ, giờ Việt Nam), tính tổng thể không theo course (AC4).
-- Mỗi phút có hành động tính 1 phút; hai phút hoạt động cách nhau không quá 5 phút thì các phút trống ở giữa cũng tính
-- (cách nhau d phút thì cộng thêm d - 1). Chỉ đọc các dòng trong cửa sổ tuần; cùng một phút ở nhiều topic gộp làm một.
create function private.feat3_week_study_minutes(p_user_id uuid, p_today date, p_now timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select (count(*) + coalesce(sum(
    case when g.gap <= interval '5 minutes' then extract(epoch from g.gap) / 60 - 1 else 0 end
  ), 0))::integer
  from (
    select m.activity_minute - lag(m.activity_minute) over (order by m.activity_minute) as gap
    from (
      select distinct a.activity_minute
      from public.user_learning_activity a
      where a.user_id = p_user_id
        and a.activity_minute >= private.feat3_ict_day_start(p_today - (extract(isodow from p_today)::integer - 1))
        and a.activity_minute <= p_now
    ) m
  ) g
$$;

-- Tối đa p_limit topic gần nhất của course: mỗi topic chỉ một tra cứu "dòng mới nhất" qua khóa chính, sắp theo phút gần nhất;
-- hòa phút thì theo vị trí trong course (chapter rồi topic, rồi id để thứ tự luôn cố định). Topic người học không còn
-- đọc được bị bỏ qua bằng đúng helper đọc của Q7 (nhờ vậy cần auth.uid() là chính p_user_id).
create function private.feat3_recent_topics(p_user_id uuid, p_course_id uuid, p_today date, p_limit integer)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_row record;
  v_items jsonb := '[]'::jsonb;
begin
  for v_row in
    select t.id, t.slug, t.title, l.activity_minute
    from public.topics t
    join public.chapters ch on ch.id = t.chapter_id and ch.course_id = t.course_id and ch.removed_at is null
    cross join lateral (
      select a.activity_minute
      from public.user_learning_activity a
      where a.user_id = p_user_id and a.topic_id = t.id
      order by a.activity_minute desc
      limit 1
    ) l
    where t.course_id = p_course_id
      and t.removed_at is null
      and t.status = 'published'::public.item_status
    order by l.activity_minute desc, ch.order_index, t.order_index, t.id
  loop
    if private.q7_can_read_topic(v_row.id) then
      v_items := v_items || jsonb_build_object(
        'topic_id', v_row.id,
        'slug', v_row.slug,
        'title', v_row.title,
        'last_activity_at', v_row.activity_minute,
        'days_ago', p_today - private.feat3_ict_date(v_row.activity_minute)
      );
      exit when jsonb_array_length(v_items) >= p_limit;
    end if;
  end loop;
  return v_items;
end;
$$;

revoke all on function private.feat3_day_has_activity(uuid, uuid, date) from public, anon, authenticated, service_role;
revoke all on function private.feat3_streak(uuid, uuid, date) from public, anon, authenticated, service_role;
revoke all on function private.feat3_week_study_minutes(uuid, date, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.feat3_recent_topics(uuid, uuid, date, integer) from public, anon, authenticated, service_role;

-- 6. RPC đọc cho chính người gọi. Không có tham số người dùng: actor luôn là auth.uid(), nên học viên khác, giáo viên
--    tác giả hay admin chỉ nhận dữ liệu của chính họ, không bao giờ của người khác (G4, AC8). SECURITY DEFINER vì bảng
--    chỉ cho đọc trực tiếp dòng của mình còn helper Q7 là definer; trả về đúng các con số cần hiển thị.
--    p_course_id null: tổng thể (streak, 7 ngày, phút tuần). Có p_course_id: streak course và tối đa 3 topic gần nhất.
create function public.feat3_learning_summary(p_course_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := now();
  v_today date := private.feat3_ict_date(now());
  v_studied_today boolean;
  v_streak integer;
  v_days jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  v_studied_today := private.feat3_day_has_activity(v_uid, p_course_id, v_today);
  v_streak := private.feat3_streak(v_uid, p_course_id, v_today);

  if p_course_id is not null then
    return jsonb_build_object(
      'streak', v_streak,
      'studied_today', v_studied_today,
      'recent_topics', private.feat3_recent_topics(v_uid, p_course_id, v_today, 3)
    );
  end if;

  select jsonb_agg(jsonb_build_object(
    'date', to_char(d.day, 'YYYY-MM-DD'),
    'studied', private.feat3_day_has_activity(v_uid, null, d.day)
  ) order by d.day)
  into v_days
  from (select v_today - n as day from generate_series(0, 6) n) d;

  return jsonb_build_object(
    'streak', v_streak,
    'studied_today', v_studied_today,
    'days', v_days,
    'week_study_minutes', private.feat3_week_study_minutes(v_uid, v_today, v_now)
  );
end;
$$;

-- Default privileges của schema public cấp EXECUTE cho anon và service_role; chỉ authenticated được gọi.
revoke all on function public.feat3_learning_summary(uuid) from public, anon, service_role;
grant execute on function public.feat3_learning_summary(uuid) to authenticated;
