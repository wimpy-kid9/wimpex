/**
 * Audio Mixing Utilities
 * Provides Web Audio API functions to mix audio tracks with video audio
 */

/**
 * Mix audio track with video audio using Web Audio API
 * Returns a blob containing the mixed audio
 */
export async function mixAudioWithVideo(
  videoBlob: Blob,
  audioTrackUrl: string,
  audioVolume: number = 0.7
): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  try {
    // Load video audio
    const videoArrayBuffer = await videoBlob.arrayBuffer();
    const videoAudioBuffer = await audioContext.decodeAudioData(videoArrayBuffer);

    // Fetch and load audio track
    const response = await fetch(audioTrackUrl);
    const trackArrayBuffer = await response.arrayBuffer();
    const trackAudioBuffer = await audioContext.decodeAudioData(trackArrayBuffer);

    // Create mix buffer with same sample rate and length as video
    const sampleRate = audioContext.sampleRate;
    const videoChannels = videoAudioBuffer.numberOfChannels;
    const trackChannels = trackAudioBuffer.numberOfChannels;
    const channels = Math.max(videoChannels, trackChannels);
    const length = videoAudioBuffer.length;

    const mixBuffer = audioContext.createBuffer(channels, length, sampleRate);

    // Mix the audio
    for (let ch = 0; ch < channels; ch++) {
      const mixData = mixBuffer.getChannelData(ch);
      const videoData = videoAudioBuffer.getChannelData(ch) || new Float32Array(length);
      const trackData = trackAudioBuffer.getChannelData(Math.min(ch, trackChannels - 1)) || new Float32Array(length);

      for (let i = 0; i < length; i++) {
        // Mix: video at full volume + track at specified volume
        mixData[i] = videoData[i] + trackData[i] * audioVolume;

        // Soft clipping to prevent distortion
        if (mixData[i] > 1) mixData[i] = 1;
        if (mixData[i] < -1) mixData[i] = -1;
      }
    }

    // Convert mix buffer to WAV blob
    const wavBlob = await audioBufferToWav(mixBuffer);
    return wavBlob;
  } finally {
    // Cleanup
    audioContext.close();
  }
}

/**
 * Convert AudioBuffer to WAV format blob
 */
async function audioBufferToWav(audioBuffer: AudioBuffer): Promise<Blob> {
  const sampleRate = audioBuffer.sampleRate;
  const channels = [];

  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  // Create WAV file
  const wavData = encodeWAV(channels, sampleRate);
  return new Blob([wavData], { type: 'audio/wav' });
}

/**
 * Encode audio channels to WAV format
 */
function encodeWAV(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const frameLength = channels[0].length;
  const numberOfChannels = channels.length;
  const sampleBits = 16;
  const bytesPerSample = sampleBits / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  // Interleave channels
  const interleaved = new Float32Array(frameLength * numberOfChannels);
  for (let source = 0; source < numberOfChannels; source++) {
    let index = source;
    let inputIndex = 0;
    while (inputIndex < frameLength) {
      interleaved[index] = channels[source][inputIndex];
      index += numberOfChannels;
      inputIndex++;
    }
  }

  // Convert float to PCM
  const pcm = new Int16Array(interleaved.length);
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i])); // Clamp
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Write WAV file
  const audioLength = frameLength * numberOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + audioLength);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + audioLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, sampleBits, true);
  writeString(36, 'data');
  view.setUint32(40, audioLength, true);

  // Write PCM data
  let offset = 44;
  const volume = 1;
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(offset, pcm[i] * volume, true);
    offset += 2;
  }

  return buffer;
}

/**
 * Attach mixed audio to video file (via FFmpeg on server or through remuxing)
 * Client-side: returns blob with mixed audio
 * Server will need to remux with video using ffmpeg-wasm or similar
 */
export async function remuxVideoWithAudio(videoBlob: Blob, audioBlob: Blob): Promise<Blob> {
  // Note: Full video remuxing requires FFmpeg on client or server
  // For MVP, we return the audio blob and server handles remuxing
  // In production, use ffmpeg.wasm or handle server-side with ffmpeg
  return audioBlob;
}
