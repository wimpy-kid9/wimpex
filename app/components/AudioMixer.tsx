'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface AudioMixerProps {
  videoFile: File;
  audioTrackUrl?: string;
  audioTrackName?: string;
  // eslint-disable-next-line no-unused-vars
  onMixed?: (mixedFile: Blob) => void;
  // eslint-disable-next-line no-unused-vars
  onError?: (error: string) => void;
}

/**
 * AudioMixer component for mixing audio tracks into video files
 * Uses Web Audio API to combine video audio with track audio
 */
export default function AudioMixer({
  videoFile,
  audioTrackUrl,
  audioTrackName,
  onMixed,
  onError
}: AudioMixerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [mixing, setMixing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Ready to mix');

  useEffect(() => {
    // Initialize AudioContext on first render
    if (!audioContextRef.current) {
      try {
        const audioContext =
          new (window.AudioContext ||
            (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
      } catch (err) {
        onError?.('Web Audio API not supported in this browser');
      }
    }
  }, [onError]);

  const mixAudio = useCallback(async () => {
    if (!audioContextRef.current || !audioTrackUrl) {
      onError?.('Audio context or track URL not available');
      return;
    }

    setMixing(true);
    setProgress(0);
    setStatus('Starting audio mix...');

    try {
      const audioContext = audioContextRef.current;

      // Step 1: Fetch and decode video file as audio
      setStatus('Loading video...');
      setProgress(20);
      const videoBuffer = await videoFile.arrayBuffer();
      let videoAudioBuffer: AudioBuffer | null = null;

      try {
        // Try to decode video audio
        videoAudioBuffer = await audioContext.decodeAudioData(
          videoBuffer
        );
      } catch {
        // Video audio decode might fail if not supported
        setStatus(
          'Note: Video audio format not decodable, using track only'
        );
      }

      // Step 2: Fetch and decode audio track
      setStatus('Loading audio track...');
      setProgress(40);
      const trackResponse = await fetch(audioTrackUrl);
      const trackBuffer = await trackResponse.arrayBuffer();
      const trackAudioBuffer =
        await audioContext.decodeAudioData(trackBuffer);

      // Step 3: Mix audio buffers
      setStatus('Mixing audio...');
      setProgress(60);

      const offlineContext = new OfflineAudioContext(
        2,
        Math.max(
          videoAudioBuffer?.length || 0,
          trackAudioBuffer.length
        ),
        audioContext.sampleRate
      );

      const videoSource = offlineContext.createBufferSource();
      const trackSource = offlineContext.createBufferSource();
      const gainVideo = offlineContext.createGain();
      const gainTrack = offlineContext.createGain();

      // Set mix levels (70% video, 30% track for natural blend)
      gainVideo.gain.value = 0.7;
      gainTrack.gain.value = 0.3;

      if (videoAudioBuffer) {
        videoSource.buffer = videoAudioBuffer;
        videoSource.connect(gainVideo);
        gainVideo.connect(offlineContext.destination);
        videoSource.start(0);
      }

      trackSource.buffer = trackAudioBuffer;
      trackSource.connect(gainTrack);
      gainTrack.connect(offlineContext.destination);
      trackSource.start(0);

      // Step 4: Render mixed audio
      setStatus('Rendering mixed audio...');
      setProgress(80);
      const mixedAudioBuffer =
        await offlineContext.startRendering();

      // Step 5: Create blob from mixed audio
      setStatus('Creating audio file...');
      setProgress(90);
      const audioBlob = bufferToWave(mixedAudioBuffer);

      // Step 6: Mux audio back into video container
      // Note: Full muxing would require ffmpeg.wasm or server-side processing
      // For now, we'll create the mixed audio file
      setProgress(100);
      setStatus('Audio mixed successfully!');

      onMixed?.(audioBlob);
      setMixing(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error during mixing';
      onError?.(message);
      setStatus(`Error: ${message}`);
      setMixing(false);
    }
  }, [videoFile, audioTrackUrl, onMixed, onError]);

  return (
    <div className="rounded-3xl border border-hairline bg-panel-2/50 p-6">
      <h3 className="text-lg font-semibold text-ivory">Audio Mixing</h3>
      {audioTrackName && (
        <p className="mt-2 text-sm text-slate">
          Track: <span className="font-medium text-ivory">{audioTrackName}</span>
        </p>
      )}

      <div className="mt-4">
        <p className="text-xs text-slate">{status}</p>
        {mixing && (
          <div className="mt-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-panel">
              <div
                className="h-full bg-gold transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate">{progress}%</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={mixAudio}
        disabled={mixing || !audioTrackUrl}
        className="mt-4 rounded-2xl bg-gold/20 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/30 disabled:opacity-50"
      >
        {mixing ? 'Mixing...' : 'Mix Audio'}
      </button>
    </div>
  );
}

/**
 * Convert AudioBuffer to WAV blob
 * Useful for creating audio files from mixed buffers
 */
function bufferToWave(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const channelData: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channelData.push(audioBuffer.getChannelData(i));
  }

  const interleaved = interleaveChannels(channelData);
  const dataLength = interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (
    offset: number,
    string: string
  ) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  floatTo16BitPCM(view, 44, interleaved);

  return new Blob([buffer], { type: 'audio/wav' });
}

function interleaveChannels(
  channelData: Float32Array[]
): Float32Array {
  const numChannels = channelData.length;
  const numSamples = channelData[0].length;
  const interleaved = new Float32Array(
    numSamples * numChannels
  );

  let index = 0;
  for (let i = 0; i < numSamples; i++) {
    for (let j = 0; j < numChannels; j++) {
      interleaved[index++] = channelData[j][i];
    }
  }

  return interleaved;
}

function floatTo16BitPCM(
  view: DataView,
  offset: number,
  input: Float32Array
) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(
      offset,
      s < 0 ? s * 0x8000 : s * 0x7fff,
      true
    );
  }
}
