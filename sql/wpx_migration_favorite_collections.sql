BEGIN;

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

COMMIT;