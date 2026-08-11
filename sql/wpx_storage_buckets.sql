-- WIMPEX storage bucket migration
--
-- This script creates the storage buckets used by the application.
-- Run this manually in Supabase SQL or your database migration tool.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'wpx-videos') THEN
    PERFORM storage.create_bucket('wpx-videos', json_build_object(
      'public', true,
      'allowed_mime_types', ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/ogg'],
      'file_size_limit', 104857600
    )::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'wpx-avatars') THEN
    PERFORM storage.create_bucket('wpx-avatars', json_build_object(
      'public', true,
      'allowed_mime_types', ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
      'file_size_limit', 5242880
    )::jsonb);
  END IF;
END$$;
