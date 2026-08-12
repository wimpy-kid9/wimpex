BEGIN;

ALTER TABLE wpx_posts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wpx_posts_status_check'
  ) THEN
    ALTER TABLE wpx_posts
      ADD CONSTRAINT wpx_posts_status_check CHECK (status IN ('published', 'draft'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wpx_posts_author_status_idx ON wpx_posts (author_id, status);

ALTER TABLE wpx_post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES wpx_post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS wpx_post_comments_parent_idx ON wpx_post_comments (parent_comment_id);
CREATE INDEX IF NOT EXISTS wpx_post_comments_post_idx ON wpx_post_comments (post_id);

COMMIT;
