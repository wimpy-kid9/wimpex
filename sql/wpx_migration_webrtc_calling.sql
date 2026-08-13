-- Create calling infrastructure tables
CREATE TABLE IF NOT EXISTS wpx_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES wpx_profiles(user_id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES wpx_profiles(user_id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'ringing', 'active', 'ended', 'missed', 'declined'
  call_type VARCHAR(50) DEFAULT 'voice', -- 'voice', 'video'
  room_url TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create WebRTC signaling table for storing offer/answer/candidates
CREATE TABLE IF NOT EXISTS wpx_call_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES wpx_calls(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES wpx_profiles(user_id) ON DELETE CASCADE,
  signal_type VARCHAR(50) NOT NULL, -- 'offer', 'answer', 'candidate'
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create ICE candidate table for connection establishment
CREATE TABLE IF NOT EXISTS wpx_call_ice_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES wpx_calls(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES wpx_profiles(user_id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES wpx_profiles(user_id) ON DELETE CASCADE,
  candidate JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wpx_calls_caller ON wpx_calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_wpx_calls_callee ON wpx_calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_wpx_calls_status ON wpx_calls(status);
CREATE INDEX IF NOT EXISTS idx_wpx_call_signals_call_id ON wpx_call_signals(call_id);
CREATE INDEX IF NOT EXISTS idx_wpx_call_ice_candidates_call_id ON wpx_call_ice_candidates(call_id);
