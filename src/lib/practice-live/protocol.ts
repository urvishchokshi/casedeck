/**
 * Wire types for the Gemini Live API (BidiGenerateContent over WebSocket) and
 * for CaseDeck's own /api/practice/session route. Hand-written from the API
 * reference because the app talks to Gemini without the SDK: only the fields
 * the voice interviewer sends or reads are modelled. Plain types, safe on
 * both sides of the client boundary.
 */

/** Input the Live API expects: 16-bit little-endian PCM, mono, 16 kHz. */
export const LIVE_INPUT_SAMPLE_RATE = 16000;
export const LIVE_INPUT_MIME = `audio/pcm;rate=${LIVE_INPUT_SAMPLE_RATE}`;
/** Output arrives as 16-bit PCM at 24 kHz unless its mimeType says otherwise. */
export const LIVE_OUTPUT_SAMPLE_RATE = 24000;

/**
 * Ephemeral tokens moved from v1alpha to v1beta; the server tries v1beta
 * first and reports which version minted the token, and the socket must use
 * the same one.
 */
export type LiveApiVersion = "v1beta" | "v1alpha";

/**
 * The constrained (ephemeral-token) Live endpoint. The token travels as the
 * access_token query parameter, unencoded, exactly as the official SDK does.
 */
export function liveSocketUrl(apiVersion: LiveApiVersion, token: string): string {
  return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContentConstrained?access_token=${token}`;
}

/**
 * Window event fired when a voice session starts on /cases/[id]; the
 * Transcript listens and collapses itself so the answer key isn't sitting
 * open under the live captions.
 */
export const PRACTICE_START_EVENT = "cd-practice-start";

/**
 * Bracketed cues the session panel sends as candidate turns: `join` once the
 * socket is set up (the model waits for it before greeting), the rest from
 * the Hint / Repeat / End buttons. LIVE_INTERVIEWER_PROMPT tells the model
 * that bracketed messages come from buttons.
 */
export const LIVE_CUES = {
  join: "[The candidate has joined the call.]",
  hint: "[Hint button] I'm stuck. Could I have a hint?",
  repeat: "[Repeat button] Could you repeat what you just said?",
  end: "[End the case button] Let's end the case here. Please give me your feedback and a score.",
} as const;

export type LiveCue = Exclude<keyof typeof LIVE_CUES, "join">;

// ---- Server → client messages -------------------------------------------

interface InlineData {
  mimeType?: string;
  data?: string;
}

interface Part {
  text?: string;
  thought?: boolean;
  inlineData?: InlineData;
}

interface Transcription {
  text?: string;
}

export interface LiveServerContent {
  modelTurn?: { parts?: Part[] };
  turnComplete?: boolean;
  generationComplete?: boolean;
  interrupted?: boolean;
  inputTranscription?: Transcription;
  outputTranscription?: Transcription;
}

export interface LiveServerMessage {
  setupComplete?: Record<string, never>;
  serverContent?: LiveServerContent;
  /** e.g. "12s" — the connection closes soon; resume on a fresh one. */
  goAway?: { timeLeft?: string };
  sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean };
}

// ---- CaseDeck /api/practice/session ---------------------------------------

export interface PracticeSessionRequest {
  caseId: string;
  /** Present when resuming a dropped or recycled connection. */
  resumeHandle?: string;
}

export interface PracticeSessionResponse {
  /** Ephemeral token name, `auth_tokens/…`. Single use, short-lived. */
  token: string;
  /** Bare model id, e.g. `gemini-3.8-live`. */
  model: string;
  /** API version that minted the token; the socket must match it. */
  apiVersion: LiveApiVersion;
}

export interface PracticeSessionError {
  error: string;
}
