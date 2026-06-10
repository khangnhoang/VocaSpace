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

commit;
