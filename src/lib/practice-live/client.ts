import {
  LIVE_CUES,
  LIVE_INPUT_MIME,
  LIVE_INPUT_SAMPLE_RATE,
  LIVE_OUTPUT_SAMPLE_RATE,
  liveSocketUrl,
  type LiveCue,
  type LiveServerContent,
  type LiveServerMessage,
  type PracticeSessionError,
  type PracticeSessionRequest,
  type PracticeSessionResponse,
} from "./protocol";

/**
 * Browser engine for the in-app voice interviewer. One instance = one
 * practice session: mic → 16 kHz PCM → Gemini Live WebSocket, model audio →
 * gapless Web Audio playback, live captions from the API's transcriptions,
 * and transparent reconnects (Live connections are recycled every ~10 min;
 * the session-resumption handle carries the conversation across). Framework-
 * free; `useLiveInterview` adapts it to React. Browser-only — construct it
 * from an event handler, never during render.
 */

export type LiveStatus =
  | "idle"
  | "preparing"
  | "connecting"
  | "live"
  | "reconnecting"
  | "ended"
  | "error";

export type CaptionRole = "interviewer" | "candidate" | "cue";

export interface Caption {
  id: number;
  role: CaptionRole;
  text: string;
}

export interface LiveInterviewEvents {
  onStatus: (status: LiveStatus, error: string | null) => void;
  onCaptions: (captions: Caption[]) => void;
  onInterviewerSpeaking: (speaking: boolean) => void;
  onMuted: (muted: boolean) => void;
  /** Once, when the interviewer first connects (epoch ms). */
  onStarted: (startedAt: number) => void;
  /** Every animation frame while running: 0–1 loudness of mic and model. */
  onLevels: (mic: number, interviewer: number) => void;
}

/** What the captions show when a button sends a cue. */
const CUE_CAPTIONS: Record<LiveCue, string> = {
  hint: "You asked for a hint",
  repeat: "You asked the interviewer to repeat that",
  end: "You ended the case. Feedback is coming up",
};

/** 40 ms of 16 kHz audio per WebSocket message. */
const CHUNK_SAMPLES = 640;
/** Hard stop so a forgotten tab doesn't keep billing. */
const MAX_SESSION_MS = 60 * 60 * 1000;
const MAX_RECONNECTS = 3;
/** Drop mic audio instead of queueing when the socket is backed up. */
const MAX_BUFFERED_BYTES = 512 * 1024;

const GENERIC_SETUP_ERROR = "Couldn't start the AI interviewer. Try again.";

/**
 * Averages the mic's native rate (44.1/48 kHz) down to 16 kHz — a box filter
 * is plenty for speech — and posts 16-bit PCM chunks to the main thread.
 * Loaded from a Blob URL so it ships inside this module.
 */
const CAPTURE_WORKLET = `
class CdPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / ${LIVE_INPUT_SAMPLE_RATE};
    this.chunk = new Int16Array(${CHUNK_SAMPLES});
    this.len = 0;
    this.acc = 0;
    this.n = 0;
    this.pos = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.acc += ch[i];
        this.n += 1;
        this.pos += 1;
        if (this.pos >= this.ratio) {
          this.pos -= this.ratio;
          let s = this.acc / this.n;
          s = s < -1 ? -1 : s > 1 ? 1 : s;
          this.chunk[this.len++] = s < 0 ? s * 32768 : s * 32767;
          this.acc = 0;
          this.n = 0;
          if (this.len === this.chunk.length) {
            this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
            this.chunk = new Int16Array(${CHUNK_SAMPLES});
            this.len = 0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor("cd-pcm-capture", CdPcmCapture);
`;

class LiveSetupError extends Error {}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Little-endian 16-bit PCM (base64) → Web Audio floats. */
function pcm16ToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const out = new Float32Array(binary.length >> 1);
  for (let i = 0; i < out.length; i++) {
    let v = binary.charCodeAt(2 * i) | (binary.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 32768;
  }
  return out;
}

function sampleRateOf(mimeType: string | undefined): number {
  const match = mimeType?.match(/rate=(\d+)/);
  const rate = match ? Number(match[1]) : NaN;
  return Number.isFinite(rate) && rate >= 8000 ? rate : LIVE_OUTPUT_SAMPLE_RATE;
}

function micErrorMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow it for this site from your browser's address bar, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone found. Plug one in or check your system settings, then try again.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "Your microphone is busy in another app. Close it there, then try again.";
  }
  return "Couldn't turn on your microphone. Try again.";
}

/** Asks CaseDeck's server for a locked, single-use Live token. */
async function requestSession(
  caseId: string,
  resumeHandle: string | null
): Promise<PracticeSessionResponse> {
  const payload: PracticeSessionRequest = resumeHandle
    ? { caseId, resumeHandle }
    : { caseId };
  let res: Response;
  try {
    res = await fetch("/api/practice/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    throw new LiveSetupError(
      "You seem to be offline. Check your connection and try again."
    );
  }
  // An expired login gets bounced to the HTML /login page by the proxy.
  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw new LiveSetupError(
      res.redirected
        ? "Your session has expired. Refresh the page to sign in again."
        : GENERIC_SETUP_ERROR
    );
  }
  const body = (await res.json()) as Partial<
    PracticeSessionResponse & PracticeSessionError
  >;
  if (
    !res.ok ||
    typeof body.token !== "string" ||
    typeof body.model !== "string" ||
    (body.apiVersion !== "v1beta" && body.apiVersion !== "v1alpha")
  ) {
    throw new LiveSetupError(
      typeof body.error === "string" ? body.error : GENERIC_SETUP_ERROR
    );
  }
  return { token: body.token, model: body.model, apiVersion: body.apiVersion };
}

async function loadCaptureWorklet(ctx: AudioContext): Promise<void> {
  if (!ctx.audioWorklet) {
    throw new LiveSetupError(
      "This browser can't run voice practice. Try the latest Chrome, Edge or Safari."
    );
  }
  const url = URL.createObjectURL(
    new Blob([CAPTURE_WORKLET], { type: "application/javascript" })
  );
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function rms(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  // Speech sits around 0.02–0.2 RMS; scale and soften into 0–1.
  return Math.min(1, Math.sqrt(Math.sqrt(sum / buf.length) * 6));
}

/** Mic audio held while switching connections (~4 s of 40 ms chunks). */
const MAX_PENDING_CHUNKS = 100;
/** A socket that hasn't finished setup by then counts as dropped. */
const SETUP_TIMEOUT_MS = 20_000;
/** On goAway, switch at the latest this long before the server's deadline. */
const RECYCLE_MARGIN_MS = 1500;
/** After the turn ends, how long to wait for its resumption handle. */
const HANDLE_WAIT_MS = 1500;

/** "12s" / "4.5s" (protobuf Duration JSON) → ms. */
function durationMs(value: string | undefined): number | null {
  const match = value?.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) * 1000 : null;
}

const DROPPED_ERROR =
  "The connection to the interviewer dropped. Start again to run the case from the top.";

type Timer = ReturnType<typeof setTimeout>;

export class LiveInterview {
  private readonly caseId: string;
  private readonly events: LiveInterviewEvents;

  private status: LiveStatus = "idle";
  /** Set once torn down; every async continuation checks it. */
  private stopped = false;
  /** Unmounted: tear down without reporting anything back. */
  private silent = false;

  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private outAnalyser: AnalyserNode | null = null;
  private outGain: GainNode | null = null;
  private levelBuf = new Float32Array(512);
  private raf = 0;

  /** The socket mic audio and cues go to. */
  private ws: WebSocket | null = null;
  /**
   * The previous socket during a hand-over: still played from (it may be
   * finishing the interviewer's sentence) until the new one is set up.
   */
  private retiring: WebSocket | null = null;
  private setupDone = false;
  private setupTimer: Timer | null = null;
  private greeted = false;
  private resumeHandle: string | null = null;
  private reconnecting = false;
  private reconnects = 0;
  /** goAway received; switch at the end of the interviewer's turn. */
  private recyclePending = false;
  /** Turn ended; switch as soon as the handle covering it arrives. */
  private awaitingHandle = false;
  private recycleTimer: Timer | null = null;
  private handleWaitTimer: Timer | null = null;
  private modelTurnActive = false;
  /** No turn has ended since the last resumption handle arrived. */
  private handleFresh = true;
  /** Base64 mic chunks captured while switching connections. */
  private pendingAudio: string[] = [];
  private maxTimer: Timer | null = null;

  private muted = false;
  private playHead = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private speaking = false;

  private captions: Caption[] = [];
  private nextCaptionId = 1;
  private openInterviewer: number | null = null;
  private openCandidate: number | null = null;

  constructor(caseId: string, events: LiveInterviewEvents) {
    this.caseId = caseId;
    this.events = events;
  }

  /**
   * Call synchronously from a click: the AudioContext must be created inside
   * the user gesture or Safari keeps it suspended (no sound).
   */
  start(): void {
    if (this.status !== "idle") return;
    this.setStatus("preparing");
    let ctx: AudioContext;
    try {
      ctx = new AudioContext({ latencyHint: "interactive" });
    } catch {
      this.fail(
        "This browser can't play audio here. Try the latest Chrome, Edge or Safari."
      );
      return;
    }
    this.ctx = ctx;
    ctx.resume().catch(() => undefined);
    // iOS suspends audio after a phone call or app switch; pick it back up.
    ctx.onstatechange = this.keepAudioRunning;
    document.addEventListener("visibilitychange", this.keepAudioRunning);
    void this.boot(ctx);
  }

  /** User hung up. Captions stay; everything else is released. */
  end(): void {
    if (this.stopped) return;
    this.teardown();
    this.setStatus("ended");
  }

  /** Component unmounted: release everything, report nothing. */
  dispose(): void {
    this.silent = true;
    if (!this.stopped) this.teardown();
  }

  setMuted(muted: boolean): void {
    if (this.stopped || muted === this.muted) return;
    this.keepAudioRunning();
    this.muted = muted;
    for (const track of this.stream?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
    if (muted) {
      this.pendingAudio = [];
      // Tell the server the user stopped talking so it doesn't wait on VAD.
      this.sendJson({ realtimeInput: { audioStreamEnd: true } });
    }
    this.emit((e) => e.onMuted(muted));
  }

  /** Hint / Repeat / End buttons. False when not connected right now. */
  sendCue(cue: LiveCue): boolean {
    if (!this.setupDone) return false;
    this.keepAudioRunning();
    // turnComplete interrupts the model's current answer server-side; cut
    // the queued audio locally too so it stops at once.
    this.stopPlayback();
    this.modelTurnActive = false;
    this.openInterviewer = null;
    this.openCandidate = null;
    this.pushCaption("cue", CUE_CAPTIONS[cue]);
    this.sendText(LIVE_CUES[cue]);
    return true;
  }

  // ---- Setup ---------------------------------------------------------------

  private async boot(ctx: AudioContext): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fail(
        "Voice practice needs a secure (https) page and a browser with microphone support."
      );
      return;
    }
    // Token (first one per case also transcribes the slides) and mic
    // permission run in parallel; the permission prompt shows immediately.
    const sessionPromise = requestSession(this.caseId, null);
    sessionPromise.catch(() => undefined);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      this.fail(micErrorMessage(e));
      return;
    }
    if (this.stopped) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    this.stream = stream;

    try {
      await loadCaptureWorklet(ctx);
      if (this.stopped) return;
      this.buildGraph(ctx, stream);
      const session = await sessionPromise;
      if (this.stopped) return;
      this.setStatus("connecting");
      this.openSocket(session);
    } catch (e) {
      this.fail(e instanceof LiveSetupError ? e.message : GENERIC_SETUP_ERROR);
    }
  }

  private buildGraph(ctx: AudioContext, stream: MediaStream): void {
    const source = ctx.createMediaStreamSource(stream);

    const micAnalyser = ctx.createAnalyser();
    micAnalyser.fftSize = 512;
    source.connect(micAnalyser);

    const capture = new AudioWorkletNode(ctx, "cd-pcm-capture", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    capture.port.onmessage = (e: MessageEvent<ArrayBuffer>) =>
      this.sendAudio(e.data);
    source.connect(capture);
    // Worklets only run while pulled by the destination; a muted gain keeps
    // it pulled without playing the mic back.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    capture.connect(sink).connect(ctx.destination);

    const outGain = ctx.createGain();
    const outAnalyser = ctx.createAnalyser();
    outAnalyser.fftSize = 512;
    outGain.connect(outAnalyser).connect(ctx.destination);

    this.micAnalyser = micAnalyser;
    this.outAnalyser = outAnalyser;
    this.outGain = outGain;
  }

  private openSocket(session: PracticeSessionResponse): void {
    const ws = new WebSocket(liveSocketUrl(session.apiVersion, session.token));
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    this.setupDone = false;
    this.clearSetupTimer();
    this.setupTimer = setTimeout(() => {
      if (ws !== this.ws || this.setupDone) return;
      ws.onclose = null;
      ws.onmessage = null;
      ws.close();
      this.socketLost(ws, "setup timed out");
    }, SETUP_TIMEOUT_MS);
    ws.onopen = () => {
      // Everything else (prompt, voice, VAD, transcription, resumption
      // handle) is locked into the token server-side.
      ws.send(JSON.stringify({ setup: { model: `models/${session.model}` } }));
    };
    ws.onmessage = (e: MessageEvent<ArrayBuffer | string>) => {
      if (ws === this.ws || ws === this.retiring) this.handleMessage(e.data, ws);
    };
    ws.onclose = (e: CloseEvent) => {
      if (ws === this.retiring) {
        this.retiring = null;
        return;
      }
      this.socketLost(ws, e.reason);
    };
  }

  // ---- Socket events -------------------------------------------------------

  private handleMessage(data: ArrayBuffer | string, from: WebSocket): void {
    let msg: LiveServerMessage;
    try {
      const text =
        typeof data === "string" ? data : new TextDecoder().decode(data);
      msg = JSON.parse(text) as LiveServerMessage;
    } catch {
      return;
    }
    // A retiring socket only finishes playing its last turn.
    const current = from === this.ws;

    if (current && msg.setupComplete) this.handleSetupComplete();
    const update = msg.sessionResumptionUpdate;
    if (current && update?.resumable && update.newHandle) {
      this.resumeHandle = update.newHandle;
      this.handleFresh = true;
      // The conversation is moving again on this connection.
      this.reconnects = 0;
      if (this.awaitingHandle) void this.reconnect();
    }
    if (msg.serverContent) this.handleServerContent(msg.serverContent, current);
    if (current && msg.goAway) this.handleGoAway(msg.goAway.timeLeft);
  }

  private handleSetupComplete(): void {
    this.setupDone = true;
    this.clearSetupTimer();
    this.reconnecting = false;
    this.handleFresh = true;
    if (!this.greeted) {
      this.greeted = true;
      const startedAt = Date.now();
      this.emit((e) => e.onStarted(startedAt));
      this.raf = requestAnimationFrame(this.tick);
      this.maxTimer = setTimeout(() => this.end(), MAX_SESSION_MS);
      // The model waits for this before greeting (see the system prompt).
      this.sendText(LIVE_CUES.join);
    } else {
      // Hand-over done: deliver what the candidate said during the switch,
      // then let the old connection go.
      const pending = this.pendingAudio;
      this.pendingAudio = [];
      for (const chunk of pending) this.sendAudioChunk(chunk);
      this.closeRetiring();
    }
    this.setStatus("live");
  }

  private handleServerContent(sc: LiveServerContent, current: boolean): void {
    if (current && sc.interrupted) {
      // The candidate talked over the interviewer. Their words keep landing
      // in their own (newest) caption; see appendCaption.
      this.stopPlayback();
      this.modelTurnActive = false;
      this.handleFresh = false;
      this.openInterviewer = null;
    }
    for (const part of sc.modelTurn?.parts ?? []) {
      const audio = part.inlineData;
      if (audio?.data && (audio.mimeType ?? "audio/").startsWith("audio/")) {
        if (current) this.modelTurnActive = true;
        this.play(audio.data, sampleRateOf(audio.mimeType));
      }
    }
    if (sc.inputTranscription?.text) {
      this.appendCaption("candidate", sc.inputTranscription.text);
    }
    if (sc.outputTranscription?.text) {
      if (current) this.modelTurnActive = true;
      this.appendCaption("interviewer", sc.outputTranscription.text);
    }
    if (sc.turnComplete) {
      this.openInterviewer = null;
      this.openCandidate = null;
      if (current) {
        this.modelTurnActive = false;
        this.handleFresh = false;
        // Natural pause: the right moment for a pending connection switch
        // (the interviewer's last words are already queued locally). Wait
        // for the resumption handle that includes this turn, briefly.
        if (this.recyclePending && !this.awaitingHandle) this.awaitHandleThenSwitch();
      }
    }
  }

  /**
   * The server will close this connection after `timeLeft`. Switch at the
   * end of the interviewer's current turn (now, if none is running) so they
   * aren't cut off mid-sentence, or just before the deadline at the latest.
   */
  private handleGoAway(timeLeft: string | undefined): void {
    if (!this.resumeHandle || this.reconnecting || this.recyclePending) return;
    this.recyclePending = true;
    if (!this.modelTurnActive) {
      if (this.handleFresh) void this.reconnect();
      else this.awaitHandleThenSwitch();
      return;
    }
    const left = durationMs(timeLeft) ?? 5000;
    this.recycleTimer = setTimeout(() => {
      this.recycleTimer = null;
      if (this.recyclePending) void this.reconnect();
    }, Math.max(0, left - RECYCLE_MARGIN_MS));
  }

  /** Switch once the handle covering the last turn arrives (or shortly). */
  private awaitHandleThenSwitch(): void {
    this.awaitingHandle = true;
    this.handleWaitTimer = setTimeout(() => {
      this.handleWaitTimer = null;
      if (this.awaitingHandle) void this.reconnect();
    }, HANDLE_WAIT_MS);
  }

  private socketLost(ws: WebSocket, reason: string): void {
    if (ws !== this.ws) return; // superseded by a reconnect
    this.ws = null;
    this.setupDone = false;
    this.clearSetupTimer();
    if (this.stopped) return;
    // Google's close reasons are for developers, not students.
    if (reason) console.warn(`Practice with AI: connection closed (${reason})`);
    if (!this.greeted) {
      // Never got going: bad model/config, quota, or a refused token.
      this.fail("Couldn't connect to the AI interviewer. Try again in a moment.");
      return;
    }
    this.reconnecting = false;
    if (this.resumeHandle && this.reconnects < MAX_RECONNECTS) {
      void this.reconnect();
      return;
    }
    this.fail(DROPPED_ERROR);
  }

  /**
   * Moves the conversation to a fresh connection with the latest resumption
   * handle. Mic audio is buffered meanwhile and replayed into the new
   * session; the old socket (if still open) keeps playing until then.
   */
  private async reconnect(): Promise<void> {
    if (this.stopped || this.reconnecting) return;
    this.reconnecting = true;
    this.clearRecycle();
    this.reconnects += 1;
    this.setStatus("reconnecting");

    const old = this.ws;
    this.ws = null;
    this.setupDone = false;
    this.clearSetupTimer();
    if (old && old.readyState <= WebSocket.OPEN) {
      this.closeRetiring();
      this.retiring = old;
    }

    try {
      const session = await requestSession(this.caseId, this.resumeHandle);
      if (this.stopped) return;
      this.openSocket(session);
    } catch (e) {
      if (this.stopped) return;
      this.reconnecting = false;
      if (this.reconnects < MAX_RECONNECTS) {
        await new Promise((r) => setTimeout(r, 1500 * this.reconnects));
        if (!this.stopped && this.ws === null) void this.reconnect();
        return;
      }
      this.fail(e instanceof LiveSetupError ? e.message : DROPPED_ERROR);
    }
  }

  private closeRetiring(): void {
    const old = this.retiring;
    this.retiring = null;
    if (!old) return;
    old.onclose = null;
    old.onmessage = null;
    if (old.readyState <= WebSocket.OPEN) old.close(1000);
  }

  // ---- Audio ---------------------------------------------------------------

  private sendAudio(chunk: ArrayBuffer): void {
    if (this.muted || this.stopped) return;
    const base64 = bytesToBase64(new Uint8Array(chunk));
    if (this.setupDone) {
      this.sendAudioChunk(base64);
    } else if (this.greeted) {
      // Mid-switch: hold the candidate's words for the new session.
      this.pendingAudio.push(base64);
      if (this.pendingAudio.length > MAX_PENDING_CHUNKS) this.pendingAudio.shift();
    }
  }

  private sendAudioChunk(base64: string): void {
    const ws = this.ws;
    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      ws.bufferedAmount > MAX_BUFFERED_BYTES
    ) {
      return; // backed up: drop rather than pile up latency
    }
    ws.send(
      JSON.stringify({
        realtimeInput: { audio: { data: base64, mimeType: LIVE_INPUT_MIME } },
      })
    );
  }

  /** Queues a chunk right after the previous one, so playback is gapless. */
  private play(base64: string, rate: number): void {
    const ctx = this.ctx;
    const out = this.outGain;
    if (!ctx || !out || this.stopped) return;
    const samples = pcm16ToFloat32(base64);
    if (samples.length === 0) return;
    const buffer = ctx.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(out);
    // Queue ran dry: start a beat ahead to absorb network jitter.
    if (this.playHead < ctx.currentTime + 0.01) {
      this.playHead = ctx.currentTime + 0.06;
    }
    src.start(this.playHead);
    this.playHead += buffer.duration;
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0) this.setSpeaking(false);
    };
    this.setSpeaking(true);
  }

  private stopPlayback(): void {
    for (const src of this.sources) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        // Already stopped.
      }
    }
    this.sources.clear();
    this.playHead = 0;
    this.setSpeaking(false);
  }

  private keepAudioRunning = (): void => {
    const ctx = this.ctx;
    if (this.stopped || !ctx || document.visibilityState === "hidden") return;
    if (ctx.state !== "running" && ctx.state !== "closed") {
      ctx.resume().catch(() => undefined);
    }
  };

  private tick = (): void => {
    if (this.stopped) return;
    const mic =
      this.micAnalyser && !this.muted ? rms(this.micAnalyser, this.levelBuf) : 0;
    const out = this.outAnalyser ? rms(this.outAnalyser, this.levelBuf) : 0;
    this.emit((e) => e.onLevels(mic, out));
    this.raf = requestAnimationFrame(this.tick);
  };

  // ---- Captions --------------------------------------------------------------

  /**
   * Transcription arrives in fragments. A fragment extends the speaker's
   * open caption only while it's the newest one in the log; once the other
   * side has spoken since, a new caption starts, so the log stays in order
   * (e.g. when the candidate talks over the interviewer).
   */
  private appendCaption(role: "interviewer" | "candidate", text: string): void {
    const openId =
      role === "interviewer" ? this.openInterviewer : this.openCandidate;
    const last = this.captions[this.captions.length - 1];
    if (last && openId !== null && last.id === openId) {
      this.captions = [
        ...this.captions.slice(0, -1),
        { ...last, text: last.text + text },
      ];
      this.emit((e) => e.onCaptions(this.captions));
      return;
    }
    const id = this.pushCaption(role, text.trimStart());
    if (role === "interviewer") this.openInterviewer = id;
    else this.openCandidate = id;
  }

  private pushCaption(role: CaptionRole, text: string): number {
    const id = this.nextCaptionId++;
    this.captions = [...this.captions, { id, role, text }];
    this.emit((e) => e.onCaptions(this.captions));
    return id;
  }

  // ---- Plumbing ------------------------------------------------------------

  private sendText(text: string): void {
    this.sendJson({
      clientContent: {
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      },
    });
  }

  private sendJson(message: object): void {
    const ws = this.ws;
    if (this.setupDone && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private clearRecycle(): void {
    this.recyclePending = false;
    this.awaitingHandle = false;
    if (this.recycleTimer !== null) clearTimeout(this.recycleTimer);
    this.recycleTimer = null;
    if (this.handleWaitTimer !== null) clearTimeout(this.handleWaitTimer);
    this.handleWaitTimer = null;
  }

  private clearSetupTimer(): void {
    if (this.setupTimer !== null) clearTimeout(this.setupTimer);
    this.setupTimer = null;
  }

  private setSpeaking(speaking: boolean): void {
    if (speaking === this.speaking) return;
    this.speaking = speaking;
    this.emit((e) => e.onInterviewerSpeaking(speaking));
  }

  private setStatus(status: LiveStatus, error: string | null = null): void {
    this.status = status;
    this.emit((e) => e.onStatus(status, error));
  }

  private fail(message: string): void {
    // A late failure (e.g. the token request settling after the user hung
    // up) must not overwrite "ended".
    if (this.stopped) return;
    this.teardown();
    this.setStatus("error", message);
  }

  private emit(fn: (events: LiveInterviewEvents) => void): void {
    if (!this.silent) fn(this.events);
  }

  private teardown(): void {
    this.stopped = true;
    const ws = this.ws;
    this.ws = null;
    this.setupDone = false;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      if (ws.readyState <= WebSocket.OPEN) ws.close(1000, "session ended");
    }
    this.closeRetiring();
    this.clearSetupTimer();
    this.clearRecycle();
    if (this.maxTimer !== null) clearTimeout(this.maxTimer);
    this.maxTimer = null;
    this.pendingAudio = [];
    this.stopPlayback();
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.keepAudioRunning);
    const ctx = this.ctx;
    this.ctx = null;
    this.micAnalyser = null;
    this.outAnalyser = null;
    this.outGain = null;
    if (ctx) {
      ctx.onstatechange = null;
      if (ctx.state !== "closed") ctx.close().catch(() => undefined);
    }
    this.emit((e) => e.onLevels(0, 0));
  }
}
