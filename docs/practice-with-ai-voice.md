# Practice with AI — in-app voice interviewer

The "Practice with AI" card on `/cases/[id]` runs the case as a live voice interview inside CaseDeck, powered by the Gemini Live API. The student clicks **Start voice interview**, allows the microphone, and an AI interviewer greets them and runs the case out loud, with live captions on screen. The original copy-only prompt for ChatGPT/Claude (`docs/practice-with-ai-prompt.md`) stays as a small secondary link on the same card.

## What the interviewer knows

Everything is assembled **server-side** and locked into the session; none of it is sent to the browser.

1. **Voice system prompt.** `LIVE_INTERVIEWER_PROMPT` in `src/lib/practice-live/prompt.ts`. It is the copy prompt (§1 of the other doc) adapted for an in-app call:
   - it waits for a `[The candidate has joined the call.]` cue before greeting;
   - bracketed messages come from on-screen buttons;
   - exhibits are on the page, and their contents are in the notes;
   - it must stay in English, because native-audio models otherwise follow an Indian accent into Hindi;
   - it asks the candidate to repeat on unclear audio, and doesn't fill thinking silences.
2. **Case block.** The same §2 block the copy prompt uses (`buildCaseBlock` in `src/lib/practice-prompt.ts`): title, tags, problem statement, and the full reference transcript.
3. **Casebook notes.** These come from the solution and exhibit **images**, which are stored as PNGs in the private `case-images` bucket. A multimodal Gemini model (`gemini-3.8-flash` by default) transcribes them into plain text: every exhibit number and table row, plus the solution's framework, branches, calculations, answer and recommendation. The notes are appended as a `CASEBOOK NOTES` section of the case block. They're cached in Next's data cache for 30 days, keyed by case id, page paths and model, so only the first session on a case pays the roughly 10–30 second transcription cost. If transcription fails, the interviewer runs from the transcript alone.

## Flow

```text
click "Start voice interview"
  ├─ AudioContext created inside the click (Safari gesture rule)
  ├─ getUserMedia (mic permission prompt)        ┐ in parallel
  └─ POST /api/practice/session {caseId}         ┘
        server: auth (cookie + @isb.edu) → load case under RLS
                → casebook notes (cache hit, or Gemini transcription)
                → system instruction
                → POST v1beta/auth_tokens (falls back to v1alpha)
                  single-use token; model, voice, prompt, VAD,
                  transcription and resumption all locked in
        ← { token, model, apiVersion }
  → WebSocket wss://…{apiVersion}…BidiGenerateContentConstrained?access_token=…
  → {setup:{model}} → setupComplete → join cue → interviewer greets
  mic → AudioWorklet (downsample to 16 kHz PCM16, 40 ms chunks) → realtimeInput.audio
  serverContent.modelTurn audio (24 kHz PCM16) → gapless AudioBufferSource queue
  input/outputTranscription → live captions
  interrupted → flush playback (barge-in)
  sessionResumptionUpdate → keep handle
  goAway → wait for the interviewer's turn to end + the fresh handle (or deadline − 1.5s)
         → new token with resumeHandle (cache-only notes) → new socket
         → old socket keeps playing until the new setupComplete; mic audio buffered (≤4s)
           and replayed into the new session; then the old socket closes
  unexpected close after start → same switch (up to 3 tries)
```

Google recycles Live connections roughly every 10 minutes, so this switch is what lets a 25–40 minute case run without a break. It waits for a natural pause so the interviewer isn't cut off, and for the resumption handle that covers the last turn so nothing is forgotten. Context-window compression (sliding window) lifts the 15-minute audio-session cap.

## Files

| File | Role |
|---|---|
| `src/lib/practice-live/prompt.ts` | Voice system prompt + `buildLiveInterviewerPrompt` (pure) |
| `src/lib/practice-live/protocol.ts` | Wire types, cue strings, socket URL, `PRACTICE_START_EVENT` (shared) |
| `src/lib/practice-live/server.ts` | `server-only`: Gemini config, cached casebook notes, ephemeral tokens (REST via `fetch`, no SDK) |
| `src/app/api/practice/session/route.ts` | `POST` → `{ token, model, apiVersion }` |
| `src/lib/practice-live/client.ts` | Browser engine `LiveInterview`: mic worklet, playback, socket, captions, reconnects |
| `src/app/(app)/cases/[id]/useLiveInterview.ts` | React hook around the engine; writes `--cd-mic` / `--cd-ai` CSS vars per frame |
| `src/app/(app)/cases/[id]/PracticeWithAI.tsx` | The card: idle → session panel (captions, mic, Hint / Repeat / End case) → ended |
| `src/app/(app)/cases/[id]/HideDuringPractice.tsx` | Folds the Solution section away when a session starts |

The Transcript and the Solution section both listen for `PRACTICE_START_EVENT` and fold away when a session starts, because they are the answer key. Exhibits stay visible, since the interviewer asks the candidate to read them. `next.config.ts` allows `microphone=(self)` in Permissions-Policy.

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `GEMINI_API_KEY` | — | **Required** for voice. Server-only. Without it the route answers 503 and the card shows "not set up". |
| `GEMINI_LIVE_MODEL` | `gemini-3.8-live` | Any Live native-audio model. |
| `GEMINI_NOTES_MODEL` | `gemini-3.8-flash` | Any multimodal `generateContent` model. |
| `GEMINI_LIVE_VOICE` | `Charon` | Any prebuilt voice (Kore, Puck, Orus, Schedar, …). |

To force fresh transcriptions after changing the notes prompt, bump `NOTES_VERSION` in `server.ts`.

## Guardrails and limits

- **The API key never reaches the browser.** The browser gets a single-use token that expires in 30 minutes and must start a session within 2 minutes. Its model and system instruction can't be changed by the client: every field the server sets is in the token's field mask.
- **Who can start a session.** Signed-in @isb.edu users only, checked by the proxy and again in the route.
- **Rate limit.** Each user can mint 30 tokens per 10 minutes; a normal case uses about 5. The count is kept in memory on each server instance, so it slows abuse rather than capping spend. Set GCP quotas and a budget alert on the key for a hard limit.
- **Reconnects stay fast.** A resume never waits on slide transcription: it uses cached notes or none. A failed transcription isn't retried for 10 minutes.
- **Session cap.** One hour, enforced client-side, in case a tab is forgotten.
- **What gets sent where.** The prompt and notes stay in Gemini's session. The browser receives only audio and the transcriptions of what was said.
- **Browser support.** Recent Chrome, Edge and Safari (AudioWorklet + getUserMedia), on https or localhost only. Headphones avoid echo; the browser's echo cancellation handles speakers reasonably well.
- **Cost.** Native-audio Live sessions are billed per audio token in and out, and the system prompt is re-read as context. Check current Gemini pricing; a 30-minute case is typically a few tens of cents. The one-off image transcription per case is a single Flash call.

## Testing done

- **Server module (30 checks).** Run against a mocked `fetch`. Covers:
  - the request bodies, the field mask, the v1beta→v1alpha fallback and the resume handle;
  - image ordering, the cache key, the empty-notes path and in-flight dedupe;
  - cache-only resumes, the failure backoff, the thinking-config fallback and the rate limit.
- **Browser engine (25 + 16 checks).** Run in headless Chromium with a fake microphone against a mock Live server. Covers:
  - setup, the join cue, 16 kHz chunking and playback;
  - captions, including the order when the candidate talks over the interviewer;
  - goAway handled both immediately and after a running turn, using the fresh handle;
  - the old socket retired only after the new one is set up, and buffered audio replayed;
  - mute, cues, a clean close, and a late failure after hang-up.
- **Copy prompt.** Output is byte-identical to the previous builder across four case shapes.
- **Still to do.** A live run against Gemini with a real key and a human voice.
