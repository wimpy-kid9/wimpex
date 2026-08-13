BEGIN;

ALTER TABLE wpx_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES wpx_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wpx_messages_reply_to_idx ON wpx_messages (reply_to_message_id);

CREATE TABLE IF NOT EXISTS wpx_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES wpx_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS wpx_message_reactions_message_idx ON wpx_message_reactions (message_id);

ALTER TABLE wpx_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS wpx_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  plan text NOT NULL,
  status text NOT NULL,
  active_from timestamptz NOT NULL DEFAULT now(),
  active_until timestamptz NOT NULL,
  external_reference text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wpx_subscriptions ENABLE ROW LEVEL SECURITY;

COMMIT;
