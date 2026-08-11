-- Migration: support image posts, audio track metadata, filter presets, and chat media/group conversation schema

BEGIN;

-- 1. Support image posts and media type enforcement.
ALTER TABLE wpx_posts ALTER COLUMN video_url DROP NOT NULL;
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'video';
ALTER TABLE wpx_posts ADD CONSTRAINT wpx_posts_media_type_check CHECK (media_type IN ('video', 'image'));

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
ALTER TABLE wpx_messages ADD CONSTRAINT wpx_messages_media_type_check CHECK (media_type IN ('text', 'image', 'video', 'voice_note'));
ALTER TABLE wpx_messages ADD COLUMN IF NOT EXISTS media_url text;

-- 5. API cache table for external service tokens.
CREATE TABLE IF NOT EXISTS wpx_api_cache (
  key text PRIMARY KEY,
  value text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Storage buckets for images and chat media.
INSERT INTO storage.buckets (id, name, owner, public, updated_at, created_at)
VALUES
  ('wpx-images', 'wpx-images', 'service_role', true, now(), now()),
  ('wpx-chat-media', 'wpx-chat-media', 'service_role', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Policies for wpx-images bucket objects.
INSERT INTO storage.policies (bucket_id, name, allowed_actions, subject, conditions, created_at, updated_at)
VALUES
  ('wpx-images', 'public_read', '{"read"}', 'public', null, now(), now()),
  ('wpx-images', 'authenticated_write', '{"insert","update"}', 'auth.role() = "authenticated"', null, now(), now())
ON CONFLICT DO NOTHING;

-- Policies for wpx-chat-media bucket objects.
INSERT INTO storage.policies (bucket_id, name, allowed_actions, subject, conditions, created_at, updated_at)
VALUES
  ('wpx-chat-media', 'public_read', '{"read"}', 'public', null, now(), now()),
  ('wpx-chat-media', 'authenticated_write', '{"insert","update"}', 'auth.role() = "authenticated"', null, now(), now())
ON CONFLICT DO NOTHING;

COMMIT;
