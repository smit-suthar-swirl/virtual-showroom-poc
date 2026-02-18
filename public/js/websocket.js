/**
 * WebSocket client — connects to backend, captures mic audio, relays to/from OpenAI.
 */
export class WebSocketManager {
  constructor({
    onAudioDelta,
    onTranscript,
    onStatus,
    onUICommand,
    onSpeechStarted,
    onError,
  }) {
    this.callbacks = {
      onAudioDelta,
      onTranscript,
      onStatus,
      onUICommand,
      onSpeechStarted,
      onError,
    };
    this.ws = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.processor = null;
    this.connected = false;
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    try {
      // Get microphone (keep it ready)
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 24000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      }

      // Connect WebSocket
      const proto = location.protocol === "https:" ? "wss" : "ws";
      this.ws = new WebSocket(`${proto}://${location.host}/ws`);

      this.ws.onopen = () => {
        this.connected = true;
        this.callbacks.onStatus("connected");
        this.setupAudioProcessor();

        // Send any pending text message
        if (this.pendingTextMessage) {
          this._sendTextInternal(this.pendingTextMessage);
          this.pendingTextMessage = null;
        }
      };

      this.ws.onmessage = (evt) => this.handleMessage(evt);

      this.ws.onclose = () => {
        this.connected = false;
        this.callbacks.onStatus("disconnected");
        this.stopAudioCapture();
      };

      this.ws.onerror = () => {
        this.callbacks.onError?.("WebSocket connection failed");
      };
    } catch (err) {
      this.callbacks.onError?.(`Microphone access denied: ${err.message}`);
    }
  }

  disconnect() {
    this.stopAudioCapture();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.callbacks.onStatus("disconnected");
  }

  sendText(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Store message and trigger connection
      this.pendingTextMessage = text;
      this.connect();
      return;
    }
    this._sendTextInternal(text);
  }

  _sendTextInternal(text) {
    this.ws.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: text }],
        },
      }),
    );
  }

  handleMessage(evt) {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "audio.delta":
        this.callbacks.onAudioDelta(msg.delta);
        break;

      case "transcript.delta":
        this.callbacks.onTranscript(msg.delta, msg.role, false);
        break;

      case "transcript.done":
        this.callbacks.onTranscript(msg.transcript, msg.role, true);
        break;

      case "ui.command":
        this.callbacks.onUICommand(msg.tool, msg.args);
        break;

      case "speech.started":
        this.callbacks.onSpeechStarted();
        break;

      case "status":
        this.callbacks.onStatus(msg.status);
        break;

      case "error":
        this.callbacks.onError?.(msg.message);
        break;
    }
  }

  // ── Audio Capture (mic → PCM16 base64 → WS) ──
  setupAudioProcessor() {
    if (!this.mediaStream || this.processor) return;

    this.audioContext = new AudioContext({ sampleRate: 24000 });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const float32 = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      const bytes = new Uint8Array(int16.buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      this.ws.send(
        JSON.stringify({
          type: "input_audio_buffer.append",
          audio: base64,
        }),
      );
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  setRecording(state) {
    this.isRecording = state;
    if (state) {
      this.connect();
      this.callbacks.onStatus("listening");
    } else {
      this.callbacks.onStatus("connected");
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "recording_stopped" }));
      }
    }
  }

  stopAudioCapture() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.isRecording = false;
  }
}
