-- Sync existing remote Storage buckets and RLS policies into migration history.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('course_thumbnails', 'course_thumbnails', true)
ON CONFLICT (id) DO UPDATE
SET
  name = excluded.name,
  public = excluded.public;

DROP POLICY IF EXISTS "Allow insert and select avatars for all users 1oj01fe_0" ON storage.objects;

CREATE POLICY "Allow insert and select avatars for all users 1oj01fe_0"
ON storage.objects
AS permissive
FOR SELECT
TO anon, authenticated
USING ((bucket_id = 'avatars'::text));

DROP POLICY IF EXISTS "Allow insert and select avatars for all users 1oj01fe_1" ON storage.objects;

CREATE POLICY "Allow insert and select avatars for all users 1oj01fe_1"
ON storage.objects
AS permissive
FOR INSERT
TO anon, authenticated
WITH CHECK ((bucket_id = 'avatars'::text));

DROP POLICY IF EXISTS "Public View Thumbnails" ON storage.objects;

CREATE POLICY "Public View Thumbnails"
ON storage.objects
AS permissive
FOR SELECT
TO public
USING ((bucket_id = 'course_thumbnails'::text));

DROP POLICY IF EXISTS "Teacher and Admin Upload Thumbnails" ON storage.objects;

CREATE POLICY "Teacher and Admin Upload Thumbnails"
ON storage.objects
AS permissive
FOR INSERT
TO public
WITH CHECK (((bucket_id = 'course_thumbnails'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::public.user_role, 'admin'::public.user_role])))))));

DROP POLICY IF EXISTS "Owner or Admin Delete Thumbnails" ON storage.objects;

CREATE POLICY "Owner or Admin Delete Thumbnails"
ON storage.objects
AS permissive
FOR DELETE
TO public
USING (((bucket_id = 'course_thumbnails'::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))))));
