-- Create push subscriptions table for web push notifications
CREATE TABLE IF NOT EXISTS wpx_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES wpx_profiles(user_id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for quick user lookups
CREATE INDEX IF NOT EXISTS idx_wpx_push_subscriptions_user_id ON wpx_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_wpx_push_subscriptions_endpoint ON wpx_push_subscriptions(endpoint);
