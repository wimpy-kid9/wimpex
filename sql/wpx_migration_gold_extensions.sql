BEGIN;

ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

CREATE TABLE IF NOT EXISTS wpx_ai_daily_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  message_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

CREATE TABLE IF NOT EXISTS wpx_profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_user_id, viewer_user_id)
);

CREATE INDEX IF NOT EXISTS wpx_profile_views_owner_idx ON wpx_profile_views(profile_user_id, created_at DESC);

COMMIT;
