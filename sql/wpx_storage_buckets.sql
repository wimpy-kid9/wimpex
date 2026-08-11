-- WIMPEX storage bucket migration
--
-- This script creates the storage buckets used by the application and applies
-- the required read/upload policies for videos and avatars.

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'wpx-videos',
  'wpx-videos',
  true,
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/ogg'],
  104857600
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'wpx-avatars',
  'wpx-avatars',
  true,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
  5242880
)
ON CONFLICT (id) DO NOTHING;

-- Video bucket policies
DROP POLICY IF EXISTS "Users can upload their own videos" ON storage.objects;
CREATE POLICY "Users can upload their own videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wpx-videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can read public videos" ON storage.objects;
CREATE POLICY "Users can read public videos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'wpx-videos');

-- Avatar bucket policies
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wpx-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can read public avatars" ON storage.objects;
CREATE POLICY "Users can read public avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'wpx-avatars');
