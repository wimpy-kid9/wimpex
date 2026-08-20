BEGIN;

ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS notification_sound text NOT NULL DEFAULT 'default';

COMMIT;
