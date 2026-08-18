-- Native push (FCM) device tokens, for the Capacitor Android/iOS app.
-- Kept separate from wpx_push_subscriptions (which stores browser Web Push
-- endpoint/p256dh/auth) since FCM tokens are a different shape and are sent
-- through Firebase Cloud Messaging instead of web-push.

CREATE TABLE IF NOT EXISTS wpx_device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES wpx_profiles(user_id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wpx_device_push_tokens_user_id ON wpx_device_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_wpx_device_push_tokens_token ON wpx_device_push_tokens(token);

ALTER TABLE wpx_device_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own device tokens; all reads/writes from the
-- app go through the service-role API routes below, so this is a safety
-- net rather than the primary access path.
CREATE POLICY "Users manage their own device tokens" ON wpx_device_push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
