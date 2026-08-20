BEGIN;

ALTER TABLE wpx_conversation_members ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
ALTER TABLE wpx_conversation_members ADD COLUMN IF NOT EXISTS wallpaper_url text;
ALTER TABLE wpx_conversation_members ADD COLUMN IF NOT EXISTS wallpaper_color text;

COMMIT;
