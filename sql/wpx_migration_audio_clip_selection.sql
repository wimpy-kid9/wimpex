-- Migration: add audio clip selection and editing support

BEGIN;

-- Add audio clip timing columns for precise music segment selection
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS audio_clip_start_time numeric DEFAULT 0;
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS audio_clip_duration numeric DEFAULT 30;

COMMIT;
