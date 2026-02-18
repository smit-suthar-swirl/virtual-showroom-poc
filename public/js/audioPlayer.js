/**
 * PCM16 audio queue player for OpenAI Realtime API responses.
 * Decodes base64 PCM16 → Float32 and plays sequentially.
 */
export class AudioPlayer {
  constructor() {
    this.audioCtx = new AudioContext({ sampleRate: 24000 });
    this.queue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
  }

  enqueue(base64) {
    // Decode base64 → raw bytes
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    // Convert PCM16 → Float32
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

    // Create audio buffer
    const audioBuf = this.audioCtx.createBuffer(1, float32.length, 24000);
    audioBuf.copyToChannel(float32, 0);
    this.queue.push(audioBuf);

    if (!this.isPlaying) this.playNext();
  }

  playNext() {
    if (!this.queue.length) {
      this.isPlaying = false;
      return;
    }
    this.isPlaying = true;

    const buf = this.queue.shift();
    const src = this.audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(this.audioCtx.destination);
    src.onended = () => this.playNext();

    // Schedule seamlessly
    const now = this.audioCtx.currentTime;
    const startAt = Math.max(now, this.nextStartTime);
    src.start(startAt);
    this.nextStartTime = startAt + buf.duration;
  }

  flush() {
    this.queue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;

    // Recreate context to stop all playing audio
    if (this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }
    this.audioCtx = new AudioContext({ sampleRate: 24000 });
  }

  resume() {
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }
}
