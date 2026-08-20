BEGIN;

ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS custom_links jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS digest_notifications boolean NOT NULL DEFAULT false;
ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS quiet_hours_start time;
ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS quiet_hours_end time;

ALTER TABLE wpx_conversation_members ADD COLUMN IF NOT EXISTS folder_name text;

COMMIT;
