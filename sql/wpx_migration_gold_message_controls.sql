BEGIN;

ALTER TABLE wpx_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE wpx_messages ADD COLUMN IF NOT EXISTS unsent_at timestamptz;

COMMIT;
