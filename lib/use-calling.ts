import { useState, useCallback, useEffect } from 'react';
import { authedFetch } from '@/lib/api-client';

export interface Call {
  id: string;
  caller_id: string;
  callee_id: string;
  status: 'pending' | 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
  call_type: 'voice' | 'video';
  room_url?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface UseCallingState {
  activeCall: Call | null;
  incomingCall: Call | null;
  callHistory: Call[];
  isLoading: boolean;
  error: string | null;
}

export function useCalling(userId?: string) {
  const [state, setState] = useState<UseCallingState>({
    activeCall: null,
    incomingCall: null,
    callHistory: [],
    isLoading: false,
    error: null
  });

  // Fetch active calls
  const fetchCalls = useCallback(async () => {
    try {
      const response = await authedFetch('/api/calls');
      if (!response.ok) return;

      const data = await response.json();
      const calls = data.calls || [];

      // Separate active and incoming calls
      const activeCall = calls.find((c: Call) => c.status === 'active');
      const incomingCall = calls.find((c: Call) => c.status === 'ringing' && c.callee_id === userId);

      setState((prev) => ({
        ...prev,
        activeCall: activeCall || null,
        incomingCall: incomingCall || null,
        callHistory: calls
      }));
    } catch (err) {
      console.error('Error fetching calls:', err);
    }
  }, [userId]);

  // Poll for calls
  useEffect(() => {
    void fetchCalls();
    const interval = setInterval(() => void fetchCalls(), 3000);
    return () => clearInterval(interval);
  }, [fetchCalls]);

  // Initiate call
  const initiateCall = useCallback(
    async (calleeId: string, callType: 'voice' | 'video' = 'video') => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await authedFetch('/api/calls', {
          method: 'POST',
          body: JSON.stringify({
            callee_id: calleeId,
            call_type: callType
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to initiate call');
        }

        const data = await response.json();
        await fetchCalls();
        return data.call;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initiate call';
        setState((prev) => ({ ...prev, error: errorMessage }));
        throw err;
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [fetchCalls]
  );

  // Accept call
  const acceptCall = useCallback(
    async (callId: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await authedFetch(`/api/calls/${callId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'active' })
        });

        if (!response.ok) {
          throw new Error('Failed to accept call');
        }

        await fetchCalls();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to accept call';
        setState((prev) => ({ ...prev, error: errorMessage }));
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [fetchCalls]
  );

  // Decline call
  const declineCall = useCallback(
    async (callId: string) => {
      try {
        await authedFetch(`/api/calls/${callId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'declined' })
        });

        setState((prev) => ({ ...prev, incomingCall: null }));
      } catch (err) {
        console.error('Error declining call:', err);
      }
    },
    []
  );

  // End call
  const endCall = useCallback(
    async (callId: string) => {
      try {
        await authedFetch(`/api/calls/${callId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ended' })
        });

        setState((prev) => ({ ...prev, activeCall: null }));
        await fetchCalls();
      } catch (err) {
        console.error('Error ending call:', err);
      }
    },
    [fetchCalls]
  );

  return {
    ...state,
    fetchCalls,
    initiateCall,
    acceptCall,
    declineCall,
    endCall
  };
}
