-- Migration: support image posts, audio track metadata, filter presets, and chat media/group conversation schema

BEGIN;

-- 1. Support image posts and media type enforcement.
ALTER TABLE wpx_posts ALTER COLUMN video_url DROP NOT NULL;
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'video';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wpx_posts_media_type_check'
  ) THEN
    ALTER TABLE wpx_posts
      ADD CONSTRAINT wpx_posts_media_type_check CHECK (media_type IN ('video', 'image'));
  END IF;
END $$;

-- 2. Attach music metadata for posts.
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS audio_track_id text;
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS audio_track_name text;
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS audio_artist_name text;
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS audio_preview_url text;
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS audio_cover_art_url text;

-- 3. Filter preset support for post rendering.
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS filter_preset text;

-- 4. Chat media support.
ALTER TABLE wpx_messages ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'text';
ALTER TABLE wpx_messages ADD COLUMN IF NOT EXISTS media_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wpx_messages_media_type_check'
  ) THEN
    ALTER TABLE wpx_messages
      ADD CONSTRAINT wpx_messages_media_type_check CHECK (media_type IN ('text', 'image', 'video', 'voice_note'));
  END IF;
END $$;

-- 5. API cache table for external service tokens.
CREATE TABLE IF NOT EXISTS wpx_api_cache (
  key text PRIMARY KEY,
  value text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- This table holds tokens/secrets for external services (WimpyPay, WimpyAI, etc.)
-- and is only ever read/written server-side via the service-role key, which
-- bypasses RLS entirely (see lib/supabase-server.ts). Enabling RLS with no
-- policies means anon/authenticated clients get zero access by default —
-- the correct posture for a secrets cache, not an oversight to patch later.
ALTER TABLE wpx_api_cache ENABLE ROW LEVEL SECURITY;

-- Storage buckets for images and chat media.
INSERT INTO storage.buckets (id, name, public, updated_at, created_at)
VALUES
  ('wpx-images', 'wpx-images', true, now(), now()),
  ('wpx-chat-media', 'wpx-chat-media', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Storage access is real Postgres Row-Level Security on storage.objects, not
-- a "storage.policies" table — that table doesn't exist, and the original
-- INSERT statements below it were silently inert even before hitting that
-- error (subject was a quoted string literal, never evaluated as a check).
-- Policy names are prefixed wpx_ to stay unique inside the shared Supabase
-- project (other Wimpy Cooperations products create policies on the same
-- storage.objects table, so generic names like "public_read" can collide).
DROP POLICY IF EXISTS "wpx_images_public_read" ON storage.objects;
CREATE POLICY "wpx_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wpx-images');

DROP POLICY IF EXISTS "wpx_images_authenticated_write" ON storage.objects;
CREATE POLICY "wpx_images_authenticated_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wpx-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "wpx_images_authenticated_update" ON storage.objects;
CREATE POLICY "wpx_images_authenticated_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'wpx-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "wpx_chat_media_public_read" ON storage.objects;
CREATE POLICY "wpx_chat_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wpx-chat-media');

DROP POLICY IF EXISTS "wpx_chat_media_authenticated_write" ON storage.objects;
CREATE POLICY "wpx_chat_media_authenticated_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wpx-chat-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "wpx_chat_media_authenticated_update" ON storage.objects;
CREATE POLICY "wpx_chat_media_authenticated_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'wpx-chat-media' AND auth.role() = 'authenticated');

COMMIT;