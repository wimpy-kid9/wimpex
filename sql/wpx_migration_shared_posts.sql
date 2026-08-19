BEGIN;

ALTER TABLE wpx_messages ADD COLUMN IF NOT EXISTS shared_post_id uuid REFERENCES wpx_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wpx_messages_shared_post_id_idx ON wpx_messages (shared_post_id);

COMMIT;
