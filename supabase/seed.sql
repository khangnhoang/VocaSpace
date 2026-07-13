begin;

insert into storage.buckets (id, name, public)
values
  ('course_thumbnails', 'course_thumbnails', true),
  ('avatars', 'avatars', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

with local_users as (
  select *
  from (
    values
      (
        '11111111-1111-4111-8111-111111111111'::uuid,
        'admin@gmail.com',
        'admin'::public.user_role,
        'Local Admin',
        'local_admin'
      ),
      (
        '22222222-2222-4222-8222-222222222222'::uuid,
        'teacher@gmail.com',
        'teacher'::public.user_role,
        'Local Teacher',
        'local_teacher'
      ),
      (
        '33333333-3333-4333-8333-333333333333'::uuid,
        'student@gmail.com',
        'student'::public.user_role,
        'Local Student',
        'local_student'
      )
  ) as seeded(id, email, app_role, full_name, username)
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  id,
  'authenticated',
  'authenticated',
  email,
  crypt('123123', gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name, 'username', username),
  now(),
  now(),
  false,
  false
from local_users
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  confirmation_token = '',
  recovery_token = '',
  email_change_token_new = '',
  email_change = '',
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = excluded.updated_at,
  deleted_at = null,
  is_sso_user = false,
  is_anonymous = false;

with local_users as (
  select *
  from (
    values
      (
        '11111111-1111-4111-8111-111111111111'::uuid,
        'admin@gmail.com',
        'admin'::public.user_role,
        'Local Admin',
        'local_admin'
      ),
      (
        '22222222-2222-4222-8222-222222222222'::uuid,
        'teacher@gmail.com',
        'teacher'::public.user_role,
        'Local Teacher',
        'local_teacher'
      ),
      (
        '33333333-3333-4333-8333-333333333333'::uuid,
        'student@gmail.com',
        'student'::public.user_role,
        'Local Student',
        'local_student'
      )
  ) as seeded(id, email, app_role, full_name, username)
)
insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  id,
  id::text,
  id,
  jsonb_build_object(
    'sub', id::text,
    'email', email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from local_users
on conflict (provider_id, provider) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = excluded.updated_at;

with local_users as (
  select *
  from (
    values
      (
        '11111111-1111-4111-8111-111111111111'::uuid,
        'admin@gmail.com',
        'admin'::public.user_role,
        'Local Admin',
        'local_admin'
      ),
      (
        '22222222-2222-4222-8222-222222222222'::uuid,
        'teacher@gmail.com',
        'teacher'::public.user_role,
        'Local Teacher',
        'local_teacher'
      ),
      (
        '33333333-3333-4333-8333-333333333333'::uuid,
        'student@gmail.com',
        'student'::public.user_role,
        'Local Student',
        'local_student'
      )
  ) as seeded(id, email, app_role, full_name, username)
)
insert into public.profiles (
  id,
  email,
  full_name,
  username,
  role,
  removed_at
)
select
  id,
  email,
  full_name,
  username,
  app_role,
  null
from local_users
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  username = excluded.username,
  role = excluded.role,
  removed_at = null;

insert into public.teacher_profiles (id, bio, experience_years, certifications)
values (
  '22222222-2222-4222-8222-222222222222',
  'Local teacher account for manual testing.',
  1,
  'Local seed'
)
on conflict (id) do update
set
  bio = excluded.bio,
  experience_years = excluded.experience_years,
  certifications = excluded.certifications;

insert into public.courses (
  id,
  title,
  slug,
  description,
  price,
  status,
  order_index,
  removed_at
)
values (
  '44444444-4444-4444-8444-444444444444',
  'Local TOEIC Test Course',
  'local-toeic-test-course',
  'Local seed course for exercise authoring manual tests.',
  0,
  'published',
  1,
  null
)
on conflict (id) do update
set
  title = excluded.title,
  slug = excluded.slug,
  description = excluded.description,
  price = excluded.price,
  status = excluded.status,
  order_index = excluded.order_index,
  removed_at = null;

insert into public.course_collaborators (
  id,
  course_id,
  user_id,
  role,
  added_by
)
values
  (
    '77777777-7777-4777-8777-777777777771',
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'owner',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    '77777777-7777-4777-8777-777777777772',
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'owner',
    '11111111-1111-4111-8111-111111111111'
  )
on conflict (course_id, user_id) do update
set
  role = excluded.role,
  added_by = excluded.added_by;

insert into public.chapters (
  id,
  course_id,
  title,
  order_index,
  removed_at
)
values (
  '55555555-5555-4555-8555-555555555555',
  '44444444-4444-4444-8444-444444444444',
  'Local Test Chapter',
  1,
  null
)
on conflict (id) do update
set
  course_id = excluded.course_id,
  title = excluded.title,
  order_index = excluded.order_index,
  removed_at = null;

insert into public.topics (
  id,
  course_id,
  chapter_id,
  title,
  slug,
  status,
  order_index,
  removed_at
)
values (
  '66666666-6666-4666-8666-666666666666',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  'Local Test Topic',
  'local-test-topic',
  'published',
  1,
  null
)
on conflict (id) do update
set
  course_id = excluded.course_id,
  chapter_id = excluded.chapter_id,
  title = excluded.title,
  slug = excluded.slug,
  status = excluded.status,
  order_index = excluded.order_index,
  removed_at = null;

-- B2 QA: trạng thái course trên dashboard, ranh giới hiển thị và đích payment.
insert into public.courses (
  id,
  title,
  slug,
  description,
  price,
  status,
  order_index,
  created_at,
  updated_at,
  removed_at
)
values
  (
    'b2000000-0000-4000-8000-000000000001',
    'B2 QA - Lộ trình đang học',
    'b2-qa-in-progress',
    'Khóa học seed để kiểm tra tiến độ, chapter rỗng và next topic.',
    199000,
    'published',
    101,
    '2026-07-01 08:00:00+00',
    '2026-07-01 08:00:00+00',
    null
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'B2 QA - Lộ trình đã hoàn thành',
    'b2-qa-completed',
    'Khóa học seed để kiểm tra trạng thái hoàn thành và bài học cuối.',
    249000,
    'published',
    102,
    '2026-07-01 08:10:00+00',
    '2026-07-01 08:10:00+00',
    null
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    'B2 QA - Lộ trình chưa có nội dung',
    'b2-qa-no-content',
    'Khóa học chỉ có topic draft hoặc đã xóa để kiểm tra no-content state.',
    390000,
    'published',
    103,
    '2026-07-01 03:00:00+00',
    '2026-07-01 03:00:00+00',
    null
  ),
  (
    'b2000000-0000-4000-8000-000000000004',
    'B2 QA - Course draft bị ẩn',
    'b2-qa-hidden-draft',
    'Course draft có enrollment nhưng không được xuất hiện trên learner dashboard.',
    290000,
    'draft',
    104,
    '2026-07-01 04:00:00+00',
    '2026-07-01 04:00:00+00',
    null
  ),
  (
    'b2000000-0000-4000-8000-000000000005',
    'B2 QA - Course pending bị ẩn',
    'b2-qa-hidden-pending',
    'Course pending có enrollment nhưng không được xuất hiện trên learner dashboard.',
    290000,
    'pending',
    105,
    '2026-07-01 05:00:00+00',
    '2026-07-01 05:00:00+00',
    null
  ),
  (
    'b2000000-0000-4000-8000-000000000006',
    'B2 QA - Course đã xóa bị ẩn',
    'b2-qa-hidden-removed',
    'Course published đã soft-delete có enrollment nhưng không được xuất hiện.',
    290000,
    'published',
    106,
    '2026-07-01 06:00:00+00',
    '2026-07-01 06:00:00+00',
    '2026-07-02 00:00:00+00'
  ),
  (
    'b2000011-0000-4000-8000-000000000011',
    'B2 QA - Thanh toán 1 - Cũ nhất',
    'b2-qa-payment-1',
    'Course published cho payment active cũ nhất.',
    159000,
    'published',
    111,
    '2026-07-01 11:00:00+00',
    '2026-07-01 11:00:00+00',
    null
  ),
  (
    'b2000012-0000-4000-8000-000000000012',
    'B2 QA - Thanh toán 2',
    'b2-qa-payment-2',
    'Course published cho payment active thứ hai.',
    169000,
    'published',
    112,
    '2026-07-01 12:00:00+00',
    '2026-07-01 12:00:00+00',
    null
  ),
  (
    'b2000013-0000-4000-8000-000000000013',
    'B2 QA - Thanh toán 3',
    'b2-qa-payment-3',
    'Course published cho payment active thứ ba.',
    179000,
    'published',
    113,
    '2026-07-01 13:00:00+00',
    '2026-07-01 13:00:00+00',
    null
  ),
  (
    'b2000014-0000-4000-8000-000000000014',
    'B2 QA - Thanh toán 4 - Mới nhất',
    'b2-qa-payment-4',
    'Course published cho payment active mới nhất.',
    189000,
    'published',
    114,
    '2026-07-01 14:00:00+00',
    '2026-07-01 14:00:00+00',
    null
  )
on conflict (id) do update
set
  title = excluded.title,
  slug = excluded.slug,
  description = excluded.description,
  price = excluded.price,
  status = excluded.status,
  order_index = excluded.order_index,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  removed_at = excluded.removed_at;

-- B2 QA: thứ tự INSERT cố ý khác order_index; chapter giữa của course đang học để trống.
insert into public.chapters (
  id,
  course_id,
  title,
  order_index,
  created_at,
  updated_at,
  removed_at
)
values
  (
    'b2100000-0000-4000-8000-000000000013',
    'b2000000-0000-4000-8000-000000000001',
    'Chặng 3 - Tiếp tục sau chapter trống',
    3,
    '2026-07-03 03:00:00+00',
    '2026-07-03 03:00:00+00',
    null
  ),
  (
    'b2100000-0000-4000-8000-000000000012',
    'b2000000-0000-4000-8000-000000000001',
    'Chặng 2 - Chapter trống',
    2,
    '2026-07-03 02:00:00+00',
    '2026-07-03 02:00:00+00',
    null
  ),
  (
    'b2100000-0000-4000-8000-000000000011',
    'b2000000-0000-4000-8000-000000000001',
    'Chặng 1 - Khởi động',
    1,
    '2026-07-03 01:00:00+00',
    '2026-07-03 01:00:00+00',
    null
  ),
  (
    'b2100000-0000-4000-8000-000000000022',
    'b2000000-0000-4000-8000-000000000002',
    'Chặng 2 - Hoàn tất',
    2,
    '2026-07-04 02:00:00+00',
    '2026-07-04 02:00:00+00',
    null
  ),
  (
    'b2100000-0000-4000-8000-000000000021',
    'b2000000-0000-4000-8000-000000000002',
    'Chặng 1 - Nền tảng',
    1,
    '2026-07-04 01:00:00+00',
    '2026-07-04 01:00:00+00',
    null
  ),
  (
    'b2100000-0000-4000-8000-000000000031',
    'b2000000-0000-4000-8000-000000000003',
    'Nội dung chưa khả dụng',
    1,
    '2026-07-05 01:00:00+00',
    '2026-07-05 01:00:00+00',
    null
  )
on conflict (id) do update
set
  course_id = excluded.course_id,
  title = excluded.title,
  order_index = excluded.order_index,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  removed_at = excluded.removed_at;

insert into public.topics (
  id,
  course_id,
  chapter_id,
  title,
  slug,
  description,
  status,
  order_index,
  created_at,
  updated_at,
  removed_at
)
values
  (
    'b2200000-0000-4000-8000-000000000132',
    'b2000000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000013',
    'Topic 4 - Đích đến',
    'b2-qa-progress-topic-4',
    'Topic cuối được INSERT trước nhưng đứng cuối theo order_index.',
    'published',
    2,
    '2026-07-06 04:00:00+00',
    '2026-07-06 04:00:00+00',
    null
  ),
  (
    'b2200000-0000-4000-8000-000000000112',
    'b2000000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000011',
    'Topic 2 - Bước tiếp theo',
    'b2-qa-progress-topic-2',
    'Topic chưa hoàn thành đầu tiên trong full course order.',
    'published',
    2,
    '2026-07-06 02:00:00+00',
    '2026-07-06 02:00:00+00',
    null
  ),
  (
    'b2200000-0000-4000-8000-000000000131',
    'b2000000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000013',
    'Topic 3 - Sau khoảng trống',
    'b2-qa-progress-topic-3',
    'Topic đầu tiên sau chapter trống.',
    'published',
    1,
    '2026-07-06 03:00:00+00',
    '2026-07-06 03:00:00+00',
    null
  ),
  (
    'b2200000-0000-4000-8000-000000000111',
    'b2000000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000011',
    'Topic 1 - Đã hoàn thành',
    'b2-qa-progress-topic-1',
    'Topic đầu tiên trong full course order.',
    'published',
    1,
    '2026-07-06 01:00:00+00',
    '2026-07-06 01:00:00+00',
    null
  ),
  (
    'b2200000-0000-4000-8000-000000000222',
    'b2000000-0000-4000-8000-000000000002',
    'b2100000-0000-4000-8000-000000000022',
    'Topic cuối - Xem lại tại đây',
    'b2-qa-completed-final-topic',
    'Topic cuối deterministic của course đã hoàn thành.',
    'published',
    2,
    '2026-07-07 03:00:00+00',
    '2026-07-07 03:00:00+00',
    null
  ),
  (
    'b2200000-0000-4000-8000-000000000212',
    'b2000000-0000-4000-8000-000000000002',
    'b2100000-0000-4000-8000-000000000021',
    'Topic giữa - Đã hoàn thành',
    'b2-qa-completed-topic-2',
    'Topic thứ hai của course đã hoàn thành.',
    'published',
    2,
    '2026-07-07 02:00:00+00',
    '2026-07-07 02:00:00+00',
    null
  ),
  (
    'b2200000-0000-4000-8000-000000000211',
    'b2000000-0000-4000-8000-000000000002',
    'b2100000-0000-4000-8000-000000000021',
    'Topic đầu - Đã hoàn thành',
    'b2-qa-completed-topic-1',
    'Topic đầu của course đã hoàn thành.',
    'published',
    1,
    '2026-07-07 01:00:00+00',
    '2026-07-07 01:00:00+00',
    null
  ),
  (
    'b2200000-0000-4000-8000-000000000312',
    'b2000000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000031',
    'Topic đã xóa',
    'b2-qa-no-content-removed-topic',
    'Topic published đã soft-delete không được tính là eligible.',
    'published',
    2,
    '2026-07-08 02:00:00+00',
    '2026-07-08 02:00:00+00',
    '2026-07-09 00:00:00+00'
  ),
  (
    'b2200000-0000-4000-8000-000000000311',
    'b2000000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000031',
    'Topic draft',
    'b2-qa-no-content-draft-topic',
    'Topic draft không được tính là eligible.',
    'draft',
    1,
    '2026-07-08 01:00:00+00',
    '2026-07-08 01:00:00+00',
    null
  )
on conflict (id) do update
set
  course_id = excluded.course_id,
  chapter_id = excluded.chapter_id,
  title = excluded.title,
  slug = excluded.slug,
  description = excluded.description,
  status = excluded.status,
  order_index = excluded.order_index,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  removed_at = excluded.removed_at;

insert into public.enrollments (id, user_id, course_id, enrolled_at)
values
  (
    'b2300000-0000-4000-8000-000000000001',
    '33333333-3333-4333-8333-333333333333',
    'b2000000-0000-4000-8000-000000000001',
    '2026-07-10 01:00:00+00'
  ),
  (
    'b2300000-0000-4000-8000-000000000002',
    '33333333-3333-4333-8333-333333333333',
    'b2000000-0000-4000-8000-000000000002',
    '2026-07-10 02:00:00+00'
  ),
  (
    'b2300000-0000-4000-8000-000000000003',
    '33333333-3333-4333-8333-333333333333',
    'b2000000-0000-4000-8000-000000000003',
    '2026-07-10 03:00:00+00'
  ),
  (
    'b2300000-0000-4000-8000-000000000004',
    '33333333-3333-4333-8333-333333333333',
    'b2000000-0000-4000-8000-000000000004',
    '2026-07-10 04:00:00+00'
  ),
  (
    'b2300000-0000-4000-8000-000000000005',
    '33333333-3333-4333-8333-333333333333',
    'b2000000-0000-4000-8000-000000000005',
    '2026-07-10 05:00:00+00'
  ),
  (
    'b2300000-0000-4000-8000-000000000006',
    '33333333-3333-4333-8333-333333333333',
    'b2000000-0000-4000-8000-000000000006',
    '2026-07-10 06:00:00+00'
  )
on conflict (id) do update
set
  user_id = excluded.user_id,
  course_id = excluded.course_id,
  enrolled_at = excluded.enrolled_at;

insert into public.user_topic_progress (
  id,
  user_id,
  topic_id,
  is_flashcard_completed,
  is_exercise_completed,
  is_topic_completed,
  completed_at,
  created_at,
  updated_at
)
values
  (
    'b2400000-0000-4000-8000-000000000111',
    '33333333-3333-4333-8333-333333333333',
    'b2200000-0000-4000-8000-000000000111',
    true,
    true,
    true,
    '2026-07-11 01:00:00+00',
    '2026-07-11 01:00:00+00',
    '2026-07-11 01:00:00+00'
  ),
  (
    'b2400000-0000-4000-8000-000000000132',
    '33333333-3333-4333-8333-333333333333',
    'b2200000-0000-4000-8000-000000000132',
    true,
    true,
    true,
    '2026-07-11 04:00:00+00',
    '2026-07-11 04:00:00+00',
    '2026-07-11 04:00:00+00'
  ),
  (
    'b2400000-0000-4000-8000-000000000211',
    '33333333-3333-4333-8333-333333333333',
    'b2200000-0000-4000-8000-000000000211',
    true,
    true,
    true,
    '2026-07-11 05:00:00+00',
    '2026-07-11 05:00:00+00',
    '2026-07-11 05:00:00+00'
  ),
  (
    'b2400000-0000-4000-8000-000000000212',
    '33333333-3333-4333-8333-333333333333',
    'b2200000-0000-4000-8000-000000000212',
    true,
    true,
    true,
    '2026-07-11 06:00:00+00',
    '2026-07-11 06:00:00+00',
    '2026-07-11 06:00:00+00'
  ),
  (
    'b2400000-0000-4000-8000-000000000222',
    '33333333-3333-4333-8333-333333333333',
    'b2200000-0000-4000-8000-000000000222',
    true,
    true,
    true,
    '2026-07-11 07:00:00+00',
    '2026-07-11 07:00:00+00',
    '2026-07-11 07:00:00+00'
  )
on conflict (id) do update
set
  user_id = excluded.user_id,
  topic_id = excluded.topic_id,
  is_flashcard_completed = excluded.is_flashcard_completed,
  is_exercise_completed = excluded.is_exercise_completed,
  is_topic_completed = excluded.is_topic_completed,
  completed_at = excluded.completed_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

-- B2 QA: hai card đến hạn, hai card đang học và một card có lịch ôn trong tương lai.
insert into public.cards (
  id,
  topic_id,
  front_content,
  back_content,
  order_index,
  created_at,
  updated_at,
  removed_at
)
values
  (
    'b2500000-0000-4000-8000-000000000001',
    'b2200000-0000-4000-8000-000000000111',
    '{"word":"deterministic","pos":"adjective","phonetic":"/dɪˌtɜː.mɪˈnɪs.tɪk/"}'::jsonb,
    '{"translation":"có tính xác định","example":"The QA result is deterministic.","exampleTranslation":"Kết quả QA có tính xác định."}'::jsonb,
    1,
    '2026-07-09 01:00:00+00',
    '2026-07-09 01:00:00+00',
    null
  ),
  (
    'b2500000-0000-4000-8000-000000000002',
    'b2200000-0000-4000-8000-000000000112',
    '{"word":"progress","pos":"noun","phonetic":"/ˈprəʊ.ɡres/"}'::jsonb,
    '{"translation":"tiến độ","example":"Track your learning progress.","exampleTranslation":"Theo dõi tiến độ học tập của bạn."}'::jsonb,
    1,
    '2026-07-09 02:00:00+00',
    '2026-07-09 02:00:00+00',
    null
  ),
  (
    'b2500000-0000-4000-8000-000000000003',
    'b2200000-0000-4000-8000-000000000131',
    '{"word":"future","pos":"noun","phonetic":"/ˈfjuː.tʃər/"}'::jsonb,
    '{"translation":"tương lai","example":"This card is due in the future.","exampleTranslation":"Thẻ này đến hạn trong tương lai."}'::jsonb,
    1,
    '2026-07-09 03:00:00+00',
    '2026-07-09 03:00:00+00',
    null
  )
on conflict (id) do update
set
  topic_id = excluded.topic_id,
  front_content = excluded.front_content,
  back_content = excluded.back_content,
  order_index = excluded.order_index,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  removed_at = excluded.removed_at;

insert into public.user_flashcards (
  id,
  user_id,
  card_id,
  ease_factor,
  interval_days,
  next_review_date,
  fsrs_meta,
  created_at,
  updated_at
)
values
  (
    'b2600000-0000-4000-8000-000000000001',
    '33333333-3333-4333-8333-333333333333',
    'b2500000-0000-4000-8000-000000000001',
    2.5,
    1,
    '2026-07-01 01:00:00+00',
    '{"due":"2026-07-01T01:00:00.000Z","stability":1,"difficulty":5,"elapsed_days":1,"scheduled_days":1,"reps":1,"lapses":0,"state":1,"last_review":"2026-06-30T01:00:00.000Z"}'::jsonb,
    '2026-06-30 01:00:00+00',
    '2026-07-01 01:00:00+00'
  ),
  (
    'b2600000-0000-4000-8000-000000000002',
    '33333333-3333-4333-8333-333333333333',
    'b2500000-0000-4000-8000-000000000002',
    2.5,
    7,
    '2026-07-02 02:00:00+00',
    '{"due":"2026-07-02T02:00:00.000Z","stability":4,"difficulty":4,"elapsed_days":7,"scheduled_days":7,"reps":3,"lapses":0,"state":2,"last_review":"2026-06-25T02:00:00.000Z"}'::jsonb,
    '2026-06-25 02:00:00+00',
    '2026-07-02 02:00:00+00'
  ),
  (
    'b2600000-0000-4000-8000-000000000003',
    '33333333-3333-4333-8333-333333333333',
    'b2500000-0000-4000-8000-000000000003',
    2.5,
    30000,
    '2099-01-01 03:00:00+00',
    '{"due":"2099-01-01T03:00:00.000Z","stability":2,"difficulty":5,"elapsed_days":1,"scheduled_days":30000,"reps":2,"lapses":1,"state":3,"last_review":"2026-07-09T03:00:00.000Z"}'::jsonb,
    '2026-07-09 03:00:00+00',
    '2026-07-09 03:00:00+00'
  )
on conflict (id) do update
set
  user_id = excluded.user_id,
  card_id = excluded.card_id,
  ease_factor = excluded.ease_factor,
  interval_days = excluded.interval_days,
  next_review_date = excluded.next_review_date,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  fsrs_meta = excluded.fsrs_meta;

-- B2 QA: bốn reminder active xếp mới nhất trước; payment paid phải bị loại.
insert into public.payments (
  id,
  user_id,
  course_id,
  amount_original,
  amount_discount,
  amount_final,
  currency,
  status,
  gateway,
  gateway_order_id,
  gateway_metadata,
  created_at,
  updated_at,
  expires_at
)
values
  (
    'b2700001-0000-4000-8000-000000000001',
    '33333333-3333-4333-8333-333333333333',
    'b2000011-0000-4000-8000-000000000011',
    159000,
    0,
    159000,
    'VND',
    'creating',
    'local-seed',
    'b2-qa-payment-1',
    '{"scenario":"b2-dashboard-oldest"}',
    '2026-07-07 08:00:00+00',
    '2026-07-07 08:00:00+00',
    '2099-01-01 00:00:00+00'
  ),
  (
    'b2700002-0000-4000-8000-000000000002',
    '33333333-3333-4333-8333-333333333333',
    'b2000012-0000-4000-8000-000000000012',
    169000,
    0,
    169000,
    'VND',
    'pending',
    'local-seed',
    'b2-qa-payment-2',
    '{"scenario":"b2-dashboard-second"}',
    '2026-07-08 08:00:00+00',
    '2026-07-08 08:00:00+00',
    '2099-01-02 00:00:00+00'
  ),
  (
    'b2700003-0000-4000-8000-000000000003',
    '33333333-3333-4333-8333-333333333333',
    'b2000013-0000-4000-8000-000000000013',
    179000,
    0,
    179000,
    'VND',
    'creating',
    'local-seed',
    'b2-qa-payment-3',
    '{"scenario":"b2-dashboard-third"}',
    '2026-07-09 08:00:00+00',
    '2026-07-09 08:00:00+00',
    '2099-01-03 00:00:00+00'
  ),
  (
    'b2700004-0000-4000-8000-000000000004',
    '33333333-3333-4333-8333-333333333333',
    'b2000014-0000-4000-8000-000000000014',
    189000,
    0,
    189000,
    'VND',
    'pending',
    'local-seed',
    'b2-qa-payment-4',
    '{"scenario":"b2-dashboard-newest"}',
    '2026-07-10 08:00:00+00',
    '2026-07-10 08:00:00+00',
    '2099-01-04 00:00:00+00'
  ),
  (
    'b2700005-0000-4000-8000-000000000005',
    '33333333-3333-4333-8333-333333333333',
    'b2000014-0000-4000-8000-000000000014',
    189000,
    0,
    189000,
    'VND',
    'paid',
    'local-seed',
    'b2-qa-payment-inactive',
    '{"scenario":"b2-dashboard-inactive"}',
    '2026-07-06 08:00:00+00',
    '2026-07-06 08:00:00+00',
    null
  )
on conflict (id) do update
set
  user_id = excluded.user_id,
  course_id = excluded.course_id,
  amount_original = excluded.amount_original,
  amount_discount = excluded.amount_discount,
  amount_final = excluded.amount_final,
  currency = excluded.currency,
  status = excluded.status,
  gateway = excluded.gateway,
  gateway_order_id = excluded.gateway_order_id,
  gateway_metadata = excluded.gateway_metadata,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  expires_at = excluded.expires_at;

commit;
