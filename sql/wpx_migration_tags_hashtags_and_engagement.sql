BEGIN;

CREATE TABLE IF NOT EXISTS wpx_post_hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES wpx_posts(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (post_id, tag)
);
CREATE INDEX IF NOT EXISTS wpx_post_hashtags_tag_idx ON wpx_post_hashtags (tag);

CREATE TABLE IF NOT EXISTS wpx_post_user_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES wpx_posts(id) ON DELETE CASCADE,
  tagged_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (post_id, tagged_user_id)
);
CREATE INDEX IF NOT EXISTS wpx_post_user_tags_user_idx ON wpx_post_user_tags (tagged_user_id);

-- Lightweight engagement log the FYP ranking reads from — one row per
-- meaningful interaction, cheap to append, easy to aggregate/decay over time.
CREATE TABLE IF NOT EXISTS wpx_user_post_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  post_id uuid NOT NULL REFERENCES wpx_posts(id) ON DELETE CASCADE,
  interaction_type text NOT NULL CHECK (interaction_type IN ('view', 'watch_complete', 'like', 'comment', 'share', 'skip')),
  watch_ms integer,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wpx_user_post_interactions_user_idx ON wpx_user_post_interactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wpx_user_post_interactions_post_idx ON wpx_user_post_interactions (post_id);

COMMIT;
