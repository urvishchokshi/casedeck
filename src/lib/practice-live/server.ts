import "server-only";

import { unstable_cache } from "next/cache";
import type { LiveApiVersion } from "./protocol";

/**
 * Server side of the in-app voice interviewer: Gemini config from env,
 * the cached "casebook notes" (exhibit + solution images transcribed by a
 * multimodal Gemini model so the voice model knows what's on the slides),
 * and ephemeral Live API tokens. The API key never leaves this module — the
 * browser only ever sees a single-use token whose model and system
 * instruction are locked server-side. Talks to the REST API with fetch; no
 * SDK dependency. See docs/practice-with-ai-voice.md.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";

const DEFAULT_LIVE_MODEL = "gemini-3.8-live";
const DEFAULT_NOTES_MODEL = "gemini-3.8-flash";
const DEFAULT_VOICE = "Charon";

/** Bump to invalidate every cached transcription (e.g. after a prompt edit). */
const NOTES_VERSION = "v1";
const NOTES_REVALIDATE_SECONDS = 60 * 60 * 24 * 30;
/** After a failed transcription, don't retry it (and make students wait) for this long. */
const NOTES_FAILURE_BACKOFF_MS = 10 * 60 * 1000;
/** Inline request cap is 20MB including base64 inflation (~4/3). */
const MAX_INLINE_IMAGE_BYTES = 14 * 1024 * 1024;
// Worst case image fetch + generateContent + token mint stays under the
// route's 60s maxDuration.
const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const NOTES_TIMEOUT_MS = 35_000;
const TOKEN_TIMEOUT_MS = 10_000;

const TOKEN_TTL_MS = 30 * 60 * 1000;
/** Covers a slow mic-permission prompt between minting and connecting. */
const TOKEN_START_WINDOW_MS = 5 * 60 * 1000;

/** Per-user token mints (starts + reconnects) allowed in the window. */
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export interface GeminiConfig {
  apiKey: string;
  liveModel: string;
  notesModel: string;
  voice: string;
}

/** Null when GEMINI_API_KEY is unset — the route answers 503. */
export function getGeminiConfig(): GeminiConfig | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    liveModel: process.env.GEMINI_LIVE_MODEL?.trim() || DEFAULT_LIVE_MODEL,
    notesModel: process.env.GEMINI_NOTES_MODEL?.trim() || DEFAULT_NOTES_MODEL,
    voice: process.env.GEMINI_LIVE_VOICE?.trim() || DEFAULT_VOICE,
  };
}

/** A Gemini call failed; `message` is safe to log, never shown verbatim. */
export class GeminiError extends Error {}

const recentRequests = new Map<string, number[]>();

/**
 * Speed bump against a signed-in user scripting the token route on our key:
 * a normal 40-minute case is one start plus ~4 reconnects. In-memory, so per
 * server instance — real spend limits belong on the key (GCP quotas/budget).
 */
export function allowSessionRequest(userId: string): boolean {
  const now = Date.now();
  const recent = (recentRequests.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT_MAX) {
    recentRequests.set(userId, recent);
    return false;
  }
  recent.push(now);
  recentRequests.set(userId, recent);
  if (recentRequests.size > 5000) {
    // Drop users with no request in the window so the map can't grow forever.
    for (const [id, times] of recentRequests) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        recentRequests.delete(id);
      }
    }
  }
  return true;
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}

// ---- Casebook notes (image → text) ------------------------------------------

export interface CasebookNotesInput {
  caseId: string;
  title: string;
  problemStatement: string | null;
  /** Storage paths in `case-images`, in page order. */
  exhibitPaths: string[];
  solutionPaths: string[];
  /** Signed URLs for those paths, minted by the caller's RLS-scoped client. */
  signedUrls: ReadonlyMap<string, string>;
}

interface GeneratePart {
  text?: string;
  thought?: boolean;
}

interface GenerateContentResponse {
  candidates?: {
    content?: { parts?: GeneratePart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

const NOTES_INSTRUCTIONS = `You are preparing confidential notes for an AI interviewer who will run a spoken mock consulting case interview. The interviewer cannot see images, so your notes are its only view of these casebook pages.

Write plain-text notes in this order:

EXHIBITS
For each exhibit page, start a line with "Exhibit N:" and give its title and every piece of data on it: each table row, each chart series with its values, axis labels, units, time periods and footnotes. Keep every number exactly as printed, with its unit.

SOLUTION
The structure or framework the solution uses; each branch it explores and what it rules in or out; every calculation with its inputs and result; the root cause or answer; the final recommendation; and any notes or tips for the interviewer printed on the pages.

Rules: plain text only, with no markdown, tables, bold or headings beyond the two section names. Do not add analysis, opinions or facts that are not on the pages. Write [illegible] for anything you cannot read. Leave out a section that has no pages.`;

async function fetchImagePart(
  url: string,
  path: string
): Promise<{ mimeType: string; data: Buffer }> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new GeminiError(`image ${path}: HTTP ${res.status}`);
  }
  const header = res.headers.get("content-type")?.split(";")[0]?.trim();
  const mimeType =
    header && header.startsWith("image/")
      ? header
      : path.toLowerCase().endsWith(".jpg") ||
          path.toLowerCase().endsWith(".jpeg")
        ? "image/jpeg"
        : "image/png";
  return { mimeType, data: Buffer.from(await res.arrayBuffer()) };
}

async function transcribeCasebookPages(
  input: CasebookNotesInput,
  config: GeminiConfig
): Promise<string> {
  const unique = [...new Set([...input.exhibitPaths, ...input.solutionPaths])];
  const images = new Map<string, { mimeType: string; data: Buffer }>();
  await Promise.all(
    unique.map(async (path) => {
      const url = input.signedUrls.get(path);
      if (!url) throw new GeminiError(`no signed URL for ${path}`);
      images.set(path, await fetchImagePart(url, path));
    })
  );

  type RequestPart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } };
  const parts: RequestPart[] = [
    { text: NOTES_INSTRUCTIONS },
    {
      text: `Case: ${input.title}\nProblem statement: ${input.problemStatement ?? "Not specified"}`,
    },
  ];

  let budget = MAX_INLINE_IMAGE_BYTES;
  let skipped = 0;
  const addPages = (label: string, paths: string[]) => {
    paths.forEach((path, i) => {
      const image = images.get(path);
      if (!image) return;
      if (image.data.byteLength > budget) {
        skipped += 1;
        return;
      }
      budget -= image.data.byteLength;
      parts.push({ text: `${label} page ${i + 1}:` });
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data.toString("base64"),
        },
      });
    });
  };
  addPages("Exhibit", input.exhibitPaths);
  addPages("Solution", input.solutionPaths);
  if (skipped > 0) {
    console.warn(
      `practice notes for case ${input.caseId}: ${skipped} page(s) over the inline size budget were left out`
    );
  }

  const deadline = AbortSignal.timeout(NOTES_TIMEOUT_MS);
  const generate = (withThinkingLevel: boolean) =>
    fetch(
      `${GEMINI_API_BASE}/v1beta/models/${encodeURIComponent(config.notesModel)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.apiKey,
        },
        // Transcription needs little reasoning; low thinking keeps the first
        // session on a case fast. No maxOutputTokens: on thinking models it
        // also caps thought tokens and can truncate the notes.
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          ...(withThinkingLevel
            ? { generationConfig: { thinkingConfig: { thinkingLevel: "low" } } }
            : {}),
        }),
        cache: "no-store",
        signal: deadline,
      }
    );

  let res = await generate(true);
  if (res.status === 400) {
    // A notes model that doesn't take thinkingLevel (override via
    // GEMINI_NOTES_MODEL) rejects it; retry once on its defaults.
    const detail = await readErrorBody(res);
    if (!/thinking/i.test(detail)) {
      throw new GeminiError(
        `generateContent ${config.notesModel}: HTTP 400 ${detail}`
      );
    }
    res = await generate(false);
  }
  if (!res.ok) {
    throw new GeminiError(
      `generateContent ${config.notesModel}: HTTP ${res.status} ${await readErrorBody(res)}`
    );
  }
  const json = (await res.json()) as GenerateContentResponse;
  const candidate = json.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) {
    // Thrown, not returned, so unstable_cache doesn't remember the miss.
    throw new GeminiError(
      `generateContent ${config.notesModel}: empty notes (finish ${candidate?.finishReason ?? "none"}, block ${json.promptFeedback?.blockReason ?? "none"})`
    );
  }
  return text;
}

/** Thrown inside the cache scope on a cache-only lookup that missed. */
class NotesNotCached extends Error {}

/** Concurrent first requests for one case share a single transcription. */
const inflightNotes = new Map<string, Promise<string>>();
/** Recent transcription failures (per instance), keyed like inflightNotes. */
const failedNotesAt = new Map<string, number>();

/**
 * Exhibit + solution pages as text, cached across requests and deploys in
 * Next's data cache (30 days, keyed by case, page paths and model). Returns
 * null when the case has no images or transcription fails — the interviewer
 * then runs from the transcript alone, as the copy prompt does.
 *
 * `mayTranscribe: false` is a cache-only lookup (used when resuming a
 * session, which must never sit waiting on a slow transcription). A failure
 * also turns later calls cache-only for NOTES_FAILURE_BACKOFF_MS.
 */
export async function getCasebookNotes(
  input: CasebookNotesInput,
  config: GeminiConfig,
  { mayTranscribe }: { mayTranscribe: boolean }
): Promise<string | null> {
  if (input.exhibitPaths.length === 0 && input.solutionPaths.length === 0) {
    return null;
  }
  const key = `${input.caseId}:${config.notesModel}`;
  const failedAt = failedNotesAt.get(key);
  const allowTranscription =
    mayTranscribe &&
    (failedAt === undefined || Date.now() - failedAt > NOTES_FAILURE_BACKOFF_MS);

  // Paths and model are arguments, so they're part of the cache key; the
  // signed URLs (fresh every request) and the transcribe flag ride in the
  // closure and aren't. A throw is never cached. `missed` (rather than
  // instanceof) identifies a cache-only miss even if the cache layer wraps
  // the error.
  let missed = false;
  const cached = unstable_cache(
    async (
      caseId: string,
      notesModel: string,
      exhibitPaths: string[],
      solutionPaths: string[]
    ) => {
      if (!allowTranscription) {
        missed = true;
        throw new NotesNotCached();
      }
      return transcribeCasebookPages(
        { ...input, caseId, exhibitPaths, solutionPaths },
        { ...config, notesModel }
      );
    },
    ["practice-casebook-notes", NOTES_VERSION],
    { revalidate: NOTES_REVALIDATE_SECONDS }
  );
  const lookup = () =>
    cached(
      input.caseId,
      config.notesModel,
      input.exhibitPaths,
      input.solutionPaths
    );

  // Join a transcription already running on this instance; otherwise only
  // a transcribing lookup registers itself for others to join.
  let pending = inflightNotes.get(key);
  if (!pending) {
    pending = lookup();
    if (allowTranscription) {
      const registered = pending.finally(() => inflightNotes.delete(key));
      inflightNotes.set(key, registered);
      pending = registered;
    }
  }
  try {
    const notes = await pending;
    failedNotesAt.delete(key);
    return notes;
  } catch (e) {
    if (missed) return null;
    failedNotesAt.set(key, Date.now());
    console.error(
      `practice notes for case ${input.caseId} failed: ${e instanceof Error ? e.message.slice(0, 400) : "unknown error"}`
    );
    return null;
  }
}

// ---- Ephemeral Live token -------------------------------------------------

/**
 * The SDK's field-mask rule (js-genai tokens.ts getFieldMasks): top-level
 * keys, one level deep for non-empty objects. Sending a mask locks exactly
 * these fields; the browser can't override any of them.
 */
function fieldMask(setup: Record<string, unknown>): string {
  const fields: string[] = [];
  for (const [key, value] of Object.entries(setup)) {
    if (
      typeof value === "object" &&
      value !== null &&
      Object.keys(value).length > 0
    ) {
      for (const sub of Object.keys(value)) fields.push(`${key}.${sub}`);
    } else {
      fields.push(key);
    }
  }
  return fields.join(",");
}

/**
 * Ephemeral tokens graduated from v1alpha (where the SDK first shipped them)
 * to v1beta (current docs). Try v1beta, fall back to v1alpha on a 400/404,
 * and remember whichever worked for the life of the server instance.
 */
const TOKEN_API_VERSIONS: readonly LiveApiVersion[] = ["v1beta", "v1alpha"];
let preferredTokenVersion: LiveApiVersion | null = null;

/**
 * Mints a single-use Live API token with the model, voice, system
 * instruction and session options locked in. `resumeHandle` (from a previous
 * connection's sessionResumptionUpdate) is locked in too, so a reconnect
 * picks the conversation up where it left off. Request shape mirrors the
 * official js-genai SDK's authTokens.create (setup under
 * `bidiGenerateContentSetup`, locked fields in `fieldMask`).
 */
export async function createLiveToken(
  config: GeminiConfig,
  systemInstruction: string,
  resumeHandle: string | null
): Promise<{ token: string; apiVersion: LiveApiVersion }> {
  const setup: Record<string, unknown> = {
    model: `models/${config.liveModel}`,
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice } },
      },
    },
    systemInstruction: { parts: [{ text: systemInstruction }] },
    realtimeInputConfig: {
      // Candidates pause mid-thought; a low end-of-speech sensitivity and a
      // longer silence window keep the interviewer from jumping in.
      automaticActivityDetection: {
        endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
        silenceDurationMs: 800,
      },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // Lifts the 15-minute audio-session cap; a case runs 20–40 minutes.
    contextWindowCompression: { slidingWindow: {} },
    sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
  };

  const now = Date.now();
  const body = JSON.stringify({
    uses: 1,
    expireTime: new Date(now + TOKEN_TTL_MS).toISOString(),
    newSessionExpireTime: new Date(now + TOKEN_START_WINDOW_MS).toISOString(),
    bidiGenerateContentSetup: setup,
    fieldMask: fieldMask(setup),
  });

  const versions = preferredTokenVersion
    ? [preferredTokenVersion]
    : TOKEN_API_VERSIONS;
  const errors: string[] = [];
  for (const apiVersion of versions) {
    const res = await fetch(`${GEMINI_API_BASE}/${apiVersion}/auth_tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
    if (!res.ok) {
      errors.push(
        `auth_tokens ${apiVersion}: HTTP ${res.status} ${await readErrorBody(res)}`
      );
      // Auth, quota and server errors won't differ by version.
      if (res.status === 400 || res.status === 404) continue;
      break;
    }
    const json = (await res.json()) as { name?: unknown };
    if (typeof json.name !== "string" || !json.name.startsWith("auth_tokens/")) {
      throw new GeminiError(`auth_tokens ${apiVersion}: response had no token name`);
    }
    preferredTokenVersion = apiVersion;
    return { token: json.name, apiVersion };
  }
  throw new GeminiError(errors.join(" | "));
}
