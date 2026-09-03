BEGIN;

-- Consolidated migration for schema changes introduced in this implementation pass.
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS audio_clip_start_time numeric DEFAULT 0;
ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS audio_clip_duration numeric DEFAULT 30;

ALTER TABLE wpx_conversation_members ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
ALTER TABLE wpx_conversation_members ADD COLUMN IF NOT EXISTS wallpaper_url text;
ALTER TABLE wpx_conversation_members ADD COLUMN IF NOT EXISTS wallpaper_color text;
ALTER TABLE wpx_conversation_members ADD COLUMN IF NOT EXISTS show_typing_indicator boolean NOT NULL DEFAULT true;
UPDATE wpx_conversation_members AS member
SET role = 'owner'
WHERE member.role = 'member'
  AND NOT EXISTS (
    SELECT 1 FROM wpx_conversation_members AS earlier
    WHERE earlier.conversation_id = member.conversation_id
      AND earlier.joined_at < member.joined_at
  );

ALTER TABLE wpx_messages ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
CREATE INDEX IF NOT EXISTS wpx_messages_scheduled_idx ON wpx_messages (scheduled_at)
  WHERE scheduled_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS wpx_favorite_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE wpx_favorite_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wpx_favorite_collections_own ON wpx_favorite_collections;
CREATE POLICY wpx_favorite_collections_own ON wpx_favorite_collections
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE wpx_post_favorites
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES wpx_favorite_collections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS wpx_favorite_collections_user_idx ON wpx_favorite_collections (user_id, created_at);
CREATE INDEX IF NOT EXISTS wpx_post_favorites_collection_idx ON wpx_post_favorites (collection_id);

CREATE TABLE IF NOT EXISTS wpx_story_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES wpx_stories(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, story_id)
);

ALTER TABLE wpx_story_highlights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wpx_story_highlights_own ON wpx_story_highlights;
CREATE POLICY wpx_story_highlights_own ON wpx_story_highlights
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS wpx_story_highlights_user_idx ON wpx_story_highlights (user_id, created_at);

COMMIT;