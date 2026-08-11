-- WIMPEX storage bucket migration
--
-- This script creates the storage buckets used by the application.
-- Run this manually in Supabase SQL or your database migration tool.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'wpx-videos') THEN
    PERFORM storage.create_bucket('wpx-videos', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'wpx-avatars') THEN
    PERFORM storage.create_bucket('wpx-avatars', true);
  END IF;
END$$;
