import { useState, useCallback } from 'react';
import { mixAudioWithVideo } from '@/lib/audio-mixer';

export interface AudioMixingState {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  mixedBlob: Blob | null;
}

export function useAudioMixer() {
  const [state, setState] = useState<AudioMixingState>({
    isProcessing: false,
    progress: 0,
    error: null,
    success: false,
    mixedBlob: null
  });

  const mixAudio = useCallback(
    async (videoBlob: Blob, audioTrackUrl: string, audioVolume: number = 0.7) => {
      setState({
        isProcessing: true,
        progress: 20,
        error: null,
        success: false,
        mixedBlob: null
      });

      try {
        setState((prev) => ({ ...prev, progress: 40 }));

        // Perform client-side mixing
        const mixedAudioBlob = await mixAudioWithVideo(videoBlob, audioTrackUrl, audioVolume);

        setState((prev) => ({ ...prev, progress: 80 }));

        // Server-side remuxing via API endpoint
        const formData = new FormData();
        formData.append('video', videoBlob);
        formData.append('audioTrackUrl', audioTrackUrl);
        formData.append('audioVolume', audioVolume.toString());

        const response = await fetch('/api/audio/mix', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to process audio mixing');
        }

        await response.json();

        setState({
          isProcessing: false,
          progress: 100,
          error: null,
          success: true,
          mixedBlob: mixedAudioBlob // Client-side mixed audio blob
        });

        return mixedAudioBlob;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during audio mixing';

        setState({
          isProcessing: false,
          progress: 0,
          error: errorMessage,
          success: false,
          mixedBlob: null
        });

        throw err;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      progress: 0,
      error: null,
      success: false,
      mixedBlob: null
    });
  }, []);

  return {
    ...state,
    mixAudio,
    reset
  };
}
