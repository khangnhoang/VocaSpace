-- Create public Storage buckets used by question group media fields.
-- The UI stores and renders public URLs for this PR, so both buckets are public.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('question_group_images', 'question_group_images', true),
  ('question_group_audios', 'question_group_audios', true)
ON CONFLICT (id) DO UPDATE
SET
  name = excluded.name,
  public = excluded.public;

-- Harden bucket-level upload restrictions when the local Storage schema supports them.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
      AND column_name = 'file_size_limit'
  ) THEN
    UPDATE storage.buckets
    SET file_size_limit = 5242880
    WHERE id = 'question_group_images';

    UPDATE storage.buckets
    SET file_size_limit = 26214400
    WHERE id = 'question_group_audios';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
      AND column_name = 'allowed_mime_types'
  ) THEN
    UPDATE storage.buckets
    SET allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
    WHERE id = 'question_group_images';

    UPDATE storage.buckets
    SET allowed_mime_types = ARRAY[
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/ogg',
      'audio/mp4',
      'audio/aac',
      'audio/webm'
    ]::text[]
    WHERE id = 'question_group_audios';
  END IF;
END $$;

-- Public reads keep existing direct URL rendering working without signed URLs.
DROP POLICY IF EXISTS "Public View Question Group Images" ON storage.objects;

CREATE POLICY "Public View Question Group Images"
ON storage.objects
AS permissive
FOR SELECT
TO public
USING ((bucket_id = 'question_group_images'::text));

DROP POLICY IF EXISTS "Public View Question Group Audios" ON storage.objects;

CREATE POLICY "Public View Question Group Audios"
ON storage.objects
AS permissive
FOR SELECT
TO public
USING ((bucket_id = 'question_group_audios'::text));

-- Teachers and admins can upload question group images.
DROP POLICY IF EXISTS "Teacher and Admin Upload Question Group Images" ON storage.objects;

CREATE POLICY "Teacher and Admin Upload Question Group Images"
ON storage.objects
AS permissive
FOR INSERT
TO public
WITH CHECK (((bucket_id = 'question_group_images'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::public.user_role, 'admin'::public.user_role])))))));

-- Teachers and admins can upload question group audio files.
DROP POLICY IF EXISTS "Teacher and Admin Upload Question Group Audios" ON storage.objects;

CREATE POLICY "Teacher and Admin Upload Question Group Audios"
ON storage.objects
AS permissive
FOR INSERT
TO public
WITH CHECK (((bucket_id = 'question_group_audios'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::public.user_role, 'admin'::public.user_role])))))));

-- Owners can remove their own uploads; admins can remove any question group image.
DROP POLICY IF EXISTS "Owner or Admin Delete Question Group Images" ON storage.objects;

CREATE POLICY "Owner or Admin Delete Question Group Images"
ON storage.objects
AS permissive
FOR DELETE
TO public
USING (((bucket_id = 'question_group_images'::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))))));

-- Owners can remove their own uploads; admins can remove any question group audio file.
DROP POLICY IF EXISTS "Owner or Admin Delete Question Group Audios" ON storage.objects;

CREATE POLICY "Owner or Admin Delete Question Group Audios"
ON storage.objects
AS permissive
FOR DELETE
TO public
USING (((bucket_id = 'question_group_audios'::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))))));
