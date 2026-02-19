export class WebSocketManager {
  constructor({ onAudioDelta, onTranscript, onStatus, onUICommand, onSpeechStarted, onError }) {
    this.callbacks = { onAudioDelta, onTranscript, onStatus, onUICommand, onSpeechStarted, onError };
    this.ws = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.processor = null;
    this.connected = false;
    this.audioSent = false;
    this.responseActive = false;
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    try {
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 24000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
      }
      const proto = location.protocol === "https:" ? "wss" : "ws";
      this.ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws.onopen = () => {
        this.connected = true;
        this.callbacks.onStatus("connected");
        this.setupAudioProcessor();
        if (this.pendingTextMessage) {
          this._sendTextInternal(this.pendingTextMessage);
          this.pendingTextMessage = null;
        }
      };
      this.ws.onmessage = (evt) => this.handleMessage(evt);
      this.ws.onclose = () => { this.connected = false; this.callbacks.onStatus("disconnected"); this.stopAudioCapture(); };
      this.ws.onerror = () => this.callbacks.onError?.("WebSocket connection failed");
    } catch (err) {
      this.callbacks.onError?.(`Microphone access denied: ${err.message}`);
    }
  }

  disconnect() {
    this.stopAudioCapture();
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected = false;
    this.callbacks.onStatus("disconnected");
  }

  sendText(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingTextMessage = text;
      this.connect();
      return;
    }
    this._sendTextInternal(text);
  }

  _sendTextInternal(text) {
    this.ws.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } }));
  }

  handleMessage(evt) {
    let msg; try { msg = JSON.parse(evt.data); } catch { return; }
    const cb = this.callbacks;
    const dispatch = {
      "audio.delta":      m => cb.onAudioDelta(m.delta),
      "transcript.delta": m => cb.onTranscript(m.delta, m.role, false),
      "transcript.done":  m => cb.onTranscript(m.transcript, m.role, true),
      "ui.command":       m => cb.onUICommand(m.tool, m.args),
      "speech.started":   () => cb.onSpeechStarted(),
      "status":           m => { if (m.status === "speaking") this.responseActive = true; else if (m.status === "connected") this.responseActive = false; cb.onStatus(m.status); },
      "error":            m => cb.onError?.(m.message),
    };
    dispatch[msg.type]?.(msg);
  }

  setupAudioProcessor() {
    if (!this.mediaStream || this.processor) return;
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const float32 = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const bytes = new Uint8Array(int16.buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      this.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: btoa(binary) }));
      this.audioSent = true;
    };
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  setRecording(state) {
    this.isRecording = state;
    if (state) {
      this.audioSent = false;
      this.connect();
      this.callbacks.onStatus("listening");
    } else {
      this.callbacks.onStatus("connected");
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.audioSent) {
        if (this.responseActive) this.ws.send(JSON.stringify({ type: "response.cancel" }));
        this.ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        this.ws.send(JSON.stringify({ type: "response.create" }));
      }
      this.audioSent = false;
    }
  }

  stopAudioCapture() {
    if (this.processor) { this.processor.disconnect(); this.processor = null; }
    if (this.audioContext) { this.audioContext.close().catch(() => {}); this.audioContext = null; }
    this.isRecording = false;
  }
}

export class AudioPlayer {
  constructor() {
    this.audioCtx = new AudioContext({ sampleRate: 24000 });
    this.queue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
  }

  enqueue(base64) {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
    const buf = this.audioCtx.createBuffer(1, float32.length, 24000);
    buf.copyToChannel(float32, 0);
    this.queue.push(buf);
    if (!this.isPlaying) this.playNext();
  }

  playNext() {
    if (!this.queue.length) { this.isPlaying = false; return; }
    this.isPlaying = true;
    const buf = this.queue.shift();
    const src = this.audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(this.audioCtx.destination);
    src.onended = () => this.playNext();
    const startAt = Math.max(this.audioCtx.currentTime, this.nextStartTime);
    src.start(startAt);
    this.nextStartTime = startAt + buf.duration;
  }

  flush() {
    this.queue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
    if (this.audioCtx.state !== "closed") this.audioCtx.close().catch(() => {});
    this.audioCtx = new AudioContext({ sampleRate: 24000 });
  }

  resume() {
    if (this.audioCtx.state === "suspended") this.audioCtx.resume();
  }
}
