-- WIMPEX schema

-- NOTE: create tables with Row Level Security enabled by default in the shared Supabase project.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wpx_post_visibility') THEN
    CREATE TYPE wpx_post_visibility AS ENUM ('public', 'connections', 'private');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wpx_connection_status') THEN
    CREATE TYPE wpx_connection_status AS ENUM ('pending', 'accepted', 'declined');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wpx_message_status') THEN
    CREATE TYPE wpx_message_status AS ENUM ('sent', 'delivered', 'read');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wpx_call_type') THEN
    CREATE TYPE wpx_call_type AS ENUM ('voice', 'video');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wpx_call_status') THEN
    CREATE TYPE wpx_call_status AS ENUM ('ringing', 'in_progress', 'completed', 'missed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wpx_privacy_choice') THEN
    CREATE TYPE wpx_privacy_choice AS ENUM ('everyone', 'connections', 'no_one');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wpx_streak_type') THEN
    CREATE TYPE wpx_streak_type AS ENUM ('daily_post', 'daily_interaction', 'friend_streak');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wpx_notification_type') THEN
    CREATE TYPE wpx_notification_type AS ENUM ('connection_request', 'connection_accepted', 'message', 'missed_call', 'streak_alert', 'post_share', 'report', 'block');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wpx_conversation_type') THEN
    CREATE TYPE wpx_conversation_type AS ENUM ('direct', 'group');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS wpx_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  username text UNIQUE NOT NULL CHECK (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text,
  bio text,
  avatar_url text,
  date_of_birth date,
  gender text,
  onboarding_completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpx_privacy_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  message_privacy wpx_privacy_choice NOT NULL DEFAULT 'connections',
  call_privacy wpx_privacy_choice NOT NULL DEFAULT 'connections',
  post_default_visibility wpx_post_visibility NOT NULL DEFAULT 'connections',
  allow_followers boolean NOT NULL DEFAULT true,
  show_online_status boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpx_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES auth.users(id) NOT NULL,
  visibility wpx_post_visibility NOT NULL DEFAULT 'public',
  title text,
  caption text,
  video_url text NOT NULL,
  thumbnail_url text,
  duration_seconds integer,
  repost_of uuid REFERENCES wpx_posts(id),
  share_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpx_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id),
  recipient_id uuid NOT NULL REFERENCES auth.users(id),
  status wpx_connection_status NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  responded_at timestamp with time zone,
  CHECK (requester_id <> recipient_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS wpx_connections_pair_idx ON wpx_connections (
  LEAST(requester_id, recipient_id),
  GREATEST(requester_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS wpx_follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id),
  followed_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

CREATE TABLE IF NOT EXISTS wpx_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type wpx_conversation_type NOT NULL DEFAULT 'direct',
  title text,
  last_activity_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpx_conversation_members (
  conversation_id uuid NOT NULL REFERENCES wpx_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'member',
  joined_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS wpx_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES wpx_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  body text,
  media_url text,
  status wpx_message_status NOT NULL DEFAULT 'sent',
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpx_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  actor_id uuid REFERENCES auth.users(id),
  type wpx_notification_type NOT NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpx_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id),
  blocked_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS wpx_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id),
  reported_user_id uuid REFERENCES auth.users(id),
  reported_post_id uuid REFERENCES wpx_posts(id),
  report_type text NOT NULL,
  reason text,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  CHECK (((reported_user_id IS NOT NULL)::int + (reported_post_id IS NOT NULL)::int) = 1)
);

CREATE TABLE IF NOT EXISTS wpx_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES auth.users(id),
  callee_id uuid NOT NULL REFERENCES auth.users(id),
  connection_id uuid REFERENCES wpx_connections(id),
  call_type wpx_call_type NOT NULL DEFAULT 'voice',
  status wpx_call_status NOT NULL DEFAULT 'ringing',
  room_id text,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  duration_seconds integer,
  is_missed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CHECK (caller_id <> callee_id)
);

CREATE TABLE IF NOT EXISTS wpx_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  streak_type wpx_streak_type NOT NULL DEFAULT 'daily_post',
  current_count integer NOT NULL DEFAULT 0,
  current_start timestamp with time zone,
  longest_count integer NOT NULL DEFAULT 0,
  banked_days integer NOT NULL DEFAULT 0,
  bank_cap integer NOT NULL DEFAULT 3,
  last_activity_at timestamp with time zone,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE wpx_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_streaks ENABLE ROW LEVEL SECURITY;

ALTER TABLE wpx_privacy_settings ADD COLUMN IF NOT EXISTS presence_pulses_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS wpx_reading_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  is_live boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpx_room_participants (
  room_id uuid NOT NULL REFERENCES wpx_reading_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'listener',
  joined_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS wpx_room_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES wpx_reading_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  note text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpx_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES wpx_reading_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpx_room_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES wpx_reading_rooms(id) ON DELETE CASCADE,
  summary text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE wpx_reading_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_room_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpx_room_recaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wpx_profiles_select_own_or_all ON wpx_profiles;
CREATE POLICY wpx_profiles_select_own_or_all ON wpx_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS wpx_profiles_update_own ON wpx_profiles;
CREATE POLICY wpx_profiles_update_own ON wpx_profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS wpx_profiles_insert_own ON wpx_profiles;
CREATE POLICY wpx_profiles_insert_own ON wpx_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS wpx_posts_select_by_visibility ON wpx_posts;
CREATE POLICY wpx_posts_select_by_visibility ON wpx_posts
  FOR SELECT USING (
    visibility = 'public'
    OR author_id = auth.uid()
    OR (
      visibility = 'connections'
      AND EXISTS (
        SELECT 1 FROM wpx_connections c
        WHERE ((c.requester_id = author_id AND c.recipient_id = auth.uid()) OR (c.requester_id = auth.uid() AND c.recipient_id = author_id))
          AND c.status = 'accepted'
      )
    )
  );

DROP POLICY IF EXISTS wpx_posts_write_own ON wpx_posts;
CREATE POLICY wpx_posts_write_own ON wpx_posts
  FOR INSERT WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS wpx_posts_update_own ON wpx_posts;
CREATE POLICY wpx_posts_update_own ON wpx_posts
  FOR UPDATE USING (author_id = auth.uid());

DROP POLICY IF EXISTS wpx_posts_delete_own ON wpx_posts;
CREATE POLICY wpx_posts_delete_own ON wpx_posts
  FOR DELETE USING (author_id = auth.uid());

DROP POLICY IF EXISTS wpx_connections_access_own ON wpx_connections;
CREATE POLICY wpx_connections_access_own ON wpx_connections
  FOR SELECT USING (requester_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS wpx_connections_modify_own ON wpx_connections;
CREATE POLICY wpx_connections_modify_own ON wpx_connections
  FOR INSERT WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS wpx_connections_update_own ON wpx_connections;
CREATE POLICY wpx_connections_update_own ON wpx_connections
  FOR UPDATE USING (requester_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS wpx_conversations_members_view ON wpx_conversations;
CREATE POLICY wpx_conversations_members_view ON wpx_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wpx_conversation_members cm
      WHERE cm.conversation_id = wpx_conversations.id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS wpx_conversation_members_access ON wpx_conversation_members;
CREATE POLICY wpx_conversation_members_access ON wpx_conversation_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS wpx_messages_members_view ON wpx_messages;
CREATE POLICY wpx_messages_members_view ON wpx_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wpx_conversation_members cm
      WHERE cm.conversation_id = wpx_messages.conversation_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS wpx_messages_insert_own ON wpx_messages;
CREATE POLICY wpx_messages_insert_own ON wpx_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS wpx_notifications_own ON wpx_notifications;
CREATE POLICY wpx_notifications_own ON wpx_notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS wpx_notifications_update_own ON wpx_notifications;
CREATE POLICY wpx_notifications_update_own ON wpx_notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS wpx_streaks_own ON wpx_streaks;
CREATE POLICY wpx_streaks_own ON wpx_streaks
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS wpx_streaks_update_own ON wpx_streaks;
CREATE POLICY wpx_streaks_update_own ON wpx_streaks
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS wpx_streaks_insert_own ON wpx_streaks;
CREATE POLICY wpx_streaks_insert_own ON wpx_streaks
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS wpx_reports_insert_own ON wpx_reports;
CREATE POLICY wpx_reports_insert_own ON wpx_reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS wpx_blocks_insert_own ON wpx_blocks;
CREATE POLICY wpx_blocks_insert_own ON wpx_blocks
  FOR INSERT WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS wpx_reading_rooms_select ON wpx_reading_rooms;
CREATE POLICY wpx_reading_rooms_select ON wpx_reading_rooms
  FOR SELECT USING (is_live = true OR creator_id = auth.uid());

DROP POLICY IF EXISTS wpx_reading_rooms_insert_own ON wpx_reading_rooms;
CREATE POLICY wpx_reading_rooms_insert_own ON wpx_reading_rooms
  FOR INSERT WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS wpx_reading_rooms_update_own ON wpx_reading_rooms;
CREATE POLICY wpx_reading_rooms_update_own ON wpx_reading_rooms
  FOR UPDATE USING (creator_id = auth.uid());

DROP POLICY IF EXISTS wpx_room_participants_select ON wpx_room_participants;
CREATE POLICY wpx_room_participants_select ON wpx_room_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wpx_room_participants p
      WHERE p.room_id = wpx_room_participants.room_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS wpx_room_participants_insert_own ON wpx_room_participants;
CREATE POLICY wpx_room_participants_insert_own ON wpx_room_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS wpx_room_highlights_select ON wpx_room_highlights;
CREATE POLICY wpx_room_highlights_select ON wpx_room_highlights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wpx_room_participants p
      WHERE p.room_id = wpx_room_highlights.room_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS wpx_room_highlights_insert_own ON wpx_room_highlights;
CREATE POLICY wpx_room_highlights_insert_own ON wpx_room_highlights
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS wpx_room_messages_select ON wpx_room_messages;
CREATE POLICY wpx_room_messages_select ON wpx_room_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wpx_room_participants p
      WHERE p.room_id = wpx_room_messages.room_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS wpx_room_messages_insert_own ON wpx_room_messages;
CREATE POLICY wpx_room_messages_insert_own ON wpx_room_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS wpx_room_recaps_select ON wpx_room_recaps;
CREATE POLICY wpx_room_recaps_select ON wpx_room_recaps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wpx_room_participants p
      WHERE p.room_id = wpx_room_recaps.room_id AND p.user_id = auth.uid()
    )
  );
