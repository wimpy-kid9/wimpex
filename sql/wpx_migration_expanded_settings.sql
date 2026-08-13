-- Add expanded settings columns to wpx_profiles table
ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS privacy_setting VARCHAR(50) DEFAULT 'public'; -- 'public', 'friends', 'private'
ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS allow_direct_messages BOOLEAN DEFAULT true;
ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS disappearing_messages BOOLEAN DEFAULT false;
ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS disappearing_messages_timer INTEGER DEFAULT 3600; -- in seconds
ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS notification_sound VARCHAR(50) DEFAULT 'default'; -- 'default', 'none', 'custom'
ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT true;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_wpx_profiles_privacy_setting ON wpx_profiles(privacy_setting);
