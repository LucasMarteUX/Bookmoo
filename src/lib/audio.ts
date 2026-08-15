export interface PlaybackResult {
  stop: () => void
  play?: () => Promise<void>
  pause?: () => void
  resume?: () => void
  /** Resolves when playback ends. */
  whenEnded?: Promise<void>
}

export const playBase64Audio = async (base64: string): Promise<PlaybackResult | null> => {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    let source: AudioBufferSourceNode;

    try {
      // First try to decode as WAV/MP3
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer.slice(0));
      source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (e) {
      // If it fails, assume it's raw 16-bit PCM (which is what Gemini TTS returns)
      const int16Array = new Int16Array(bytes.buffer);
      const audioBuffer = audioContext.createBuffer(1, int16Array.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }
      source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    }

    const whenEnded = new Promise<void>((resolve) => {
      source.onended = () => resolve();
    });

    return {
      stop: () => {
        try {
          source.stop();
        } catch (e) {
          // Ignore if already stopped
        }
      },
      whenEnded
    };
  } catch (err) {
    console.error("Error playing audio:", err);
    return null;
  }
}
