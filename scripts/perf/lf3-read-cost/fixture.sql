-- LF3 AC1/AC2: fixture xác định (id và số lượng cố định) để đo chi phí đọc nội dung.
-- Chỉ chạy trên runtime E2E tách biệt (DB cổng 45442) sau `supabase db reset`; không bao giờ chạy trên root 45321 hay hosted.
-- Cách chạy: psql -h 127.0.0.1 -p 45442 -U postgres -d postgres -v ON_ERROR_STOP=1 -f scripts/perf/lf3-read-cost/fixture.sql
--
-- Nội dung: 20 khóa học published x 10 topic = 200 topic (mỗi 10 topic có 1 topic draft, trừ topic đích).
-- Topic đích (id kind 03, n = 1; khóa học 1) có 30 thẻ, 10 exercise x 10 câu x 4 lựa chọn (exercise 6-10 chia thành
-- 2 question_groups) và 1 memory check 5 câu x 4 lựa chọn. 199 topic còn lại mỗi topic có 3 thẻ và 1 exercise 3 câu x 4 lựa chọn.
-- Học viên của phép đo là student@gmail.com (seed), chỉ enroll vào khóa học 1.
-- Dọn trước khi dựng lại để chạy lặp lại cho cùng kết quả.

begin;

create function pg_temp.f3_id(kind int, n bigint) returns uuid language sql immutable as $$
  select format('f3%s0000-0000-4000-8000-%s', lpad(kind::text, 2, '0'), lpad(n::text, 12, '0'))::uuid
$$;

-- Dọn dữ liệu fixture cũ (id bắt đầu bằng f3).
delete from public.enrollments where course_id::text like 'f3%';
delete from public.question_options where id::text like 'f3%';
delete from public.questions where id::text like 'f3%';
delete from public.question_groups where id::text like 'f3%';
delete from public.exercises where id::text like 'f3%';
delete from public.cards where id::text like 'f3%';
delete from public.topics where id::text like 'f3%';
delete from public.chapters where id::text like 'f3%';
delete from public.course_collaborators where course_id::text like 'f3%';
delete from public.courses where id::text like 'f3%';

insert into public.courses (id, title, slug, price, status)
select pg_temp.f3_id(1, c), 'LF3 perf course ' || c, 'lf3-perf-' || c, 0, 'published'
from generate_series(1, 20) c;

insert into public.course_collaborators (course_id, user_id, role, added_by, can_review_topics)
select pg_temp.f3_id(1, c), '22222222-2222-4222-8222-222222222222', 'owner', '22222222-2222-4222-8222-222222222222', false
from generate_series(1, 20) c;

insert into public.chapters (id, course_id, title, created_by_user_id, order_index)
select pg_temp.f3_id(2, c), pg_temp.f3_id(1, c), 'LF3 chapter ' || c, '22222222-2222-4222-8222-222222222222', 0
from generate_series(1, 20) c;

insert into public.topics (id, course_id, chapter_id, title, slug, status, first_approved_at, order_index,
  original_creator_user_id, responsible_author_user_id)
select pg_temp.f3_id(3, t), pg_temp.f3_id(1, (t - 1) / 10 + 1), pg_temp.f3_id(2, (t - 1) / 10 + 1),
  'LF3 perf topic ' || t, 'lf3-perf-topic-' || t,
  case when t % 10 = 0 then 'draft'::public.item_status else 'published'::public.item_status end,
  case when t % 10 = 0 then null else timestamptz '2026-01-01 00:00:00+00' end,
  (t - 1) % 10,
  '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222'
from generate_series(1, 200) t;

-- Topic đích: 30 thẻ.
insert into public.cards (id, topic_id, front_content, back_content, order_index)
select pg_temp.f3_id(4, n), pg_temp.f3_id(3, 1), jsonb_build_object('word', 'w' || n), jsonb_build_object('translation', 'n' || n), n
from generate_series(1, 30) n;

-- Topic đích: 10 exercise + 1 memory check; question_groups cho exercise 6-10.
insert into public.exercises (id, topic_id, course_id, title, part_type, activity_stage, order_index)
select pg_temp.f3_id(5, e), pg_temp.f3_id(3, 1), pg_temp.f3_id(1, 1), 'LF3 exercise ' || e,
  case when e <= 5 then 'part5' else 'part7' end, 'exercise', e
from generate_series(1, 10) e;
insert into public.exercises (id, topic_id, course_id, title, part_type, activity_stage, order_index)
values (pg_temp.f3_id(5, 11), pg_temp.f3_id(3, 1), pg_temp.f3_id(1, 1), 'LF3 memory check', null, 'memory_check', 0);

insert into public.question_groups (id, exercise_id, passage_text, order_index)
select pg_temp.f3_id(6, (e - 6) * 2 + g), pg_temp.f3_id(5, e), 'LF3 passage ' || e || '-' || g, g
from generate_series(6, 10) e, generate_series(1, 2) g;

insert into public.questions (id, exercise_id, course_id, group_id, content, order_index)
select pg_temp.f3_id(7, (e - 1) * 10 + q), pg_temp.f3_id(5, e), pg_temp.f3_id(1, 1),
  case when e >= 6 then pg_temp.f3_id(6, (e - 6) * 2 + (q - 1) / 5 + 1) end,
  'LF3 question ' || e || '-' || q, q
from generate_series(1, 10) e, generate_series(1, 10) q;
insert into public.questions (id, exercise_id, course_id, content, order_index)
select pg_temp.f3_id(7, 100 + q), pg_temp.f3_id(5, 11), pg_temp.f3_id(1, 1), 'LF3 memory question ' || q, q
from generate_series(1, 5) q;

insert into public.question_options (id, question_id, content, label, is_correct, order_index)
select pg_temp.f3_id(8, (qn - 1) * 4 + o), pg_temp.f3_id(7, qn), 'option ' || o, chr(64 + o), o = 1, o - 1
from generate_series(1, 105) qn, generate_series(1, 4) o;

-- 199 topic còn lại: 3 thẻ, 1 exercise, 3 câu x 4 lựa chọn.
insert into public.cards (id, topic_id, front_content, back_content, order_index)
select pg_temp.f3_id(4, 1000 + (t - 2) * 3 + j), pg_temp.f3_id(3, t),
  jsonb_build_object('word', 'w' || t || '-' || j), jsonb_build_object('translation', 'n' || t || '-' || j), j
from generate_series(2, 200) t, generate_series(1, 3) j;

insert into public.exercises (id, topic_id, course_id, title, part_type, activity_stage, order_index)
select pg_temp.f3_id(5, 1000 + t), pg_temp.f3_id(3, t), pg_temp.f3_id(1, (t - 1) / 10 + 1), 'LF3 exercise t' || t, 'part5', 'exercise', 1
from generate_series(2, 200) t;

insert into public.questions (id, exercise_id, course_id, content, order_index)
select pg_temp.f3_id(7, 1000 + (t - 2) * 3 + j), pg_temp.f3_id(5, 1000 + t), pg_temp.f3_id(1, (t - 1) / 10 + 1),
  'LF3 question t' || t || '-' || j, j
from generate_series(2, 200) t, generate_series(1, 3) j;

insert into public.question_options (id, question_id, content, label, is_correct, order_index)
select pg_temp.f3_id(8, (1000 + (t - 2) * 3 + j - 1) * 4 + o), pg_temp.f3_id(7, 1000 + (t - 2) * 3 + j),
  'option ' || o, chr(64 + o), o = 1, o - 1
from generate_series(2, 200) t, generate_series(1, 3) j, generate_series(1, 4) o;

-- Một học viên đã enroll vào khóa học đích.
insert into public.enrollments (course_id, user_id)
values (pg_temp.f3_id(1, 1), '33333333-3333-4333-8333-333333333333');

commit;

-- Bước ANALYZE bắt buộc của quy trình đo (plan LF3 section 1.5) và bản ghi số hàng.
analyze public.courses, public.chapters, public.topics, public.cards, public.exercises, public.question_groups,
  public.questions, public.question_options, public.enrollments, public.course_collaborators, public.profiles;

select 'topics' as table_name, count(*) as row_count from public.topics
union all select 'cards', count(*) from public.cards
union all select 'exercises', count(*) from public.exercises
union all select 'question_groups', count(*) from public.question_groups
union all select 'questions', count(*) from public.questions
union all select 'question_options', count(*) from public.question_options
union all select 'enrollments', count(*) from public.enrollments
union all select 'course_collaborators', count(*) from public.course_collaborators
order by 1;
