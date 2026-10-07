"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import type { Caption, LiveStatus } from "@/lib/practice-live/client";
import { useLiveInterview } from "./useLiveInterview";

/** How long the copied state (link label + pill) stays up. */
const COPIED_VISIBLE_MS = 2000;

type CopyStatus = "idle" | "copied" | "failed";

const ACTIVE_STATUSES: readonly LiveStatus[] = [
  "preparing",
  "connecting",
  "live",
  "reconnecting",
];

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const sparkleIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M8.5 3.5Q8.5 10.5 15.5 10.5Q8.5 10.5 8.5 17.5Q8.5 10.5 1.5 10.5Q8.5 10.5 8.5 3.5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M15.5 1.5Q15.5 4.5 18.5 4.5Q15.5 4.5 15.5 7.5Q15.5 4.5 12.5 4.5Q15.5 4.5 15.5 1.5Z"
      fill="currentColor"
    />
  </svg>
);

function MicIcon({ size = 16, off = false }: { size?: number; off?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <rect
        x="7"
        y="2.5"
        width="6"
        height="10"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M4.5 9.5a5.5 5.5 0 0011 0M10 15v2.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {off && (
        <path
          d="M3.5 3l13 14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

const copyIcon = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden
    className="shrink-0"
  >
    <rect
      x="7"
      y="7"
      width="10"
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path
      d="M13 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

const infoIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden
    className="mt-[2px] shrink-0 text-[var(--slate)]"
  >
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M10 9.2v4.3"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    <circle cx="10" cy="6.5" r="1" fill="currentColor" />
  </svg>
);

/** Three bars that follow the interviewer's loudness (`--cd-ai`). */
function SpeakingBars({
  meterRef,
}: {
  meterRef: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <span
      ref={meterRef}
      aria-hidden
      className="flex h-3 items-center gap-[2px]"
    >
      {[0.55, 1, 0.75].map((weight, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-[var(--accent)]"
          style={{ height: `calc(3px + var(--cd-ai, 0) * ${9 * weight}px)` }}
        />
      ))}
    </span>
  );
}

function CaptionRow({ caption }: { caption: Caption }) {
  if (caption.role === "cue") {
    return (
      <p className="cd-fade-in px-4 py-1 text-center text-[12px] font-semibold text-[var(--muted-2)]">
        {caption.text}
      </p>
    );
  }
  const interviewer = caption.role === "interviewer";
  return (
    <div
      className={`cd-fade-in ${interviewer ? "rounded-[14px] bg-[var(--turn)] px-4 py-3" : "px-4 py-2"}`}
    >
      <div
        className={`mb-[5px] text-[10.5px] font-bold uppercase tracking-[0.1em] ${interviewer ? "text-[var(--accent)]" : "text-[var(--muted-2)]"}`}
      >
        {interviewer ? "Interviewer" : "You"}
      </div>
      <p className="whitespace-pre-line text-[14.5px] leading-[1.6] text-[var(--ink)] [text-wrap:pretty]">
        {caption.text}
      </p>
    </div>
  );
}

/**
 * "Practice with AI" card on /cases/[id], directly above the transcript.
 * Primary action: a live voice interview with Gemini inside CaseDeck — the
 * server locks the case, transcript and transcribed solution/exhibit pages
 * into a single-use token (src/lib/practice-live/), the browser streams the
 * mic and plays the interviewer back, with live captions, mute, Hint /
 * Repeat / End-the-case cues. Secondary: the original copy-only prompt for
 * ChatGPT or Claude, which is never rendered — it only lives in the `prompt`
 * prop.
 */
export function PracticeWithAI({
  caseId,
  prompt,
  hasSolution,
  voiceAvailable,
}: {
  caseId: string;
  prompt: string;
  hasSolution: boolean;
  /** False when the server has no Gemini key: voice is shown, disabled. */
  voiceAvailable: boolean;
}) {
  const headingId = useId();
  const live = useLiveInterview(caseId);
  const {
    status,
    error,
    captions,
    muted,
    interviewerSpeaking,
    elapsedMs,
    micMeterRef,
    aiMeterRef,
  } = live;
  const active = ACTIVE_STATUSES.includes(status);
  const idle = status === "idle";

  // ---- Copy-prompt fallback (unchanged behaviour, smaller footprint) ----
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  // A reset scheduled inside the 2s window must not fire after unmount, and
  // a clipboard promise settling after navigation must not schedule one.
  // (Reset on mount: StrictMode runs the cleanup once before the real mount.)
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    };
  }, []);

  const settle = (next: CopyStatus) => {
    if (unmounted.current) return;
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    resetTimer.current = null;
    setCopyStatus(next);
    if (next === "copied") {
      resetTimer.current = setTimeout(() => {
        resetTimer.current = null;
        setCopyStatus("idle");
      }, COPIED_VISIBLE_MS);
    }
  };

  const copy = () => {
    // writeText must run synchronously inside the click: Safari rejects it
    // once the user-gesture window has passed (i.e. after any await). Outside
    // a secure context navigator.clipboard is undefined and the TypeError
    // lands in the same catch — either way the prompt is never shown instead.
    try {
      navigator.clipboard.writeText(prompt).then(
        () => settle("copied"),
        () => settle("failed")
      );
    } catch {
      settle("failed");
    }
  };

  // ---- Captions auto-scroll (only while the reader is at the bottom) ----
  const logRef = useRef<HTMLDivElement | null>(null);
  const pinnedToBottom = useRef(true);
  useEffect(() => {
    // A fresh session starts pinned, even if the last one was scrolled up.
    if (captions.length === 0) pinnedToBottom.current = true;
    const el = logRef.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [captions]);

  const statusLine = (() => {
    switch (status) {
      case "preparing":
        return "Getting your interviewer ready. The first session on a case reads its slides, so this can take up to half a minute.";
      case "connecting":
        return "Connecting to your interviewer…";
      case "reconnecting":
        return `Reconnecting… · ${formatClock(elapsedMs)}`;
      case "ended":
        return `Session ended · ${formatClock(elapsedMs)}`;
      case "error":
        return "Session stopped";
      default:
        return null;
    }
  })();

  /** Announced once per state change (no ticking clock) for screen readers. */
  const announcement = (() => {
    switch (status) {
      case "preparing":
        return "Getting your interviewer ready.";
      case "connecting":
        return "Connecting to your interviewer.";
      case "live":
        return "Connected. The interviewer can hear you.";
      case "reconnecting":
        return "Reconnecting to your interviewer.";
      case "ended":
        return "Session ended.";
      default:
        return "";
    }
  })();

  const listeningLabel = interviewerSpeaking
    ? "Interviewer speaking"
    : muted
      ? "Muted"
      : "Listening";

  const cueButtonClasses =
    "h-8 whitespace-nowrap rounded-[9px] border px-3 max-desk:h-10 text-[12.5px] font-semibold transition-[color,background-color,border-color,opacity,transform] enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-[22px] py-5 [box-shadow:var(--sh)] max-desk:px-4"
    >
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="flex items-center justify-between gap-6 max-desk:flex-col max-desk:items-stretch max-desk:gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-tint)] text-[var(--accent)]"
          >
            {sparkleIcon}
          </span>
          <div className="min-w-0">
            {/* h2 like the page's other section headings (Transcript,
                Exhibits) so the outline doesn't skip a level; sized as a
                card title. */}
            <h2 id={headingId} className="text-[17px]">
              Practice with AI
            </h2>
            {idle ? (
              <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--muted)] [text-wrap:pretty]">
                Run this case out loud with an AI interviewer that knows the
                case, its exhibits and the casebook solution. Ask for a hint
                when you&apos;re stuck, and end the case for feedback and a
                score out of ten.
              </p>
            ) : status === "live" ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] leading-[1.55] text-[var(--muted)]">
                <span className="flex items-center gap-1.5 font-semibold text-[var(--done-fg)]">
                  <span
                    aria-hidden
                    className="cd-pulse h-[7px] w-[7px] rounded-full bg-[var(--done-dot)]"
                  />
                  Live · {formatClock(elapsedMs)}
                </span>
                <span aria-hidden className="text-[var(--dash)]">
                  ·
                </span>
                <span className="flex items-center gap-1.5">
                  {interviewerSpeaking && <SpeakingBars meterRef={aiMeterRef} />}
                  {listeningLabel}
                </span>
              </p>
            ) : (
              <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--muted)] [text-wrap:pretty]">
                {statusLine}
              </p>
            )}
          </div>
        </div>

        {idle ? (
          <div className="flex flex-col items-center gap-1.5 text-center desk:w-[264px] desk:shrink-0">
            <Button
              type="button"
              onClick={live.start}
              disabled={!voiceAvailable}
              className="max-desk:h-11 max-desk:w-full"
            >
              <MicIcon size={15} />
              Start voice interview
            </Button>
            <p className="text-[12px] leading-[1.5] text-[var(--muted-2)]">
              {voiceAvailable
                ? "Uses your mic. Headphones work best."
                : "Voice practice isn't set up yet."}
            </p>
            {/* Sized for one line so swapping in the pill never shifts the
                card. Always mounted so the announcement is reliable. */}
            <div
              aria-live="polite"
              className="flex min-h-[30px] items-center justify-center"
            >
              {copyStatus === "copied" ? (
                <Pill tone="done" className="cd-pop-in">
                  <span
                    aria-hidden
                    className="h-[6px] w-[6px] rounded-full bg-[var(--done-dot)]"
                  />
                  Prompt copied
                </Pill>
              ) : copyStatus === "failed" ? (
                <button
                  type="button"
                  onClick={copy}
                  className="text-[12px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                >
                  Couldn&apos;t copy — try again.
                </button>
              ) : (
                <button
                  type="button"
                  onClick={copy}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
                >
                  {copyIcon}
                  Copy prompt for ChatGPT or Claude
                </button>
              )}
            </div>
          </div>
        ) : active ? (
          <Button
            type="button"
            variant="secondary"
            onClick={live.end}
            className="shrink-0 max-desk:h-11 max-desk:w-full"
          >
            End session
          </Button>
        ) : (
          <div className="flex shrink-0 gap-2 max-desk:[&>*]:h-11 max-desk:[&>*]:flex-1">
            <Button type="button" variant="secondary" onClick={live.reset}>
              Close
            </Button>
            <Button type="button" onClick={live.start}>
              <MicIcon size={15} />
              Start again
            </Button>
          </div>
        )}
      </div>

      {!idle && (
        <div className="cd-fade-in mt-[18px] flex flex-col gap-3">
          {status === "error" && error && (
            <p
              role="alert"
              className="rounded-[var(--rs)] border border-[var(--revisit-border)] bg-[var(--revisit-bg)] px-3.5 py-3 text-[13px] leading-[1.55] text-[var(--revisit-fg)] [text-wrap:pretty]"
            >
              {error}
            </p>
          )}

          {(active || captions.length > 0) && (
            <div
              ref={logRef}
              role="log"
              aria-label="Live captions"
              // The interviewer is heard, not read: announcing every caption
              // fragment would talk over it.
              aria-live="off"
              onScroll={(e) => {
                const el = e.currentTarget;
                pinnedToBottom.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 40;
              }}
              className="flex max-h-[340px] min-h-[132px] flex-col gap-1.5 overflow-y-auto rounded-[14px] border border-[var(--line-inner)] bg-[var(--card)] p-2"
            >
              {captions.length === 0 ? (
                <p className="m-auto px-4 text-center text-[13px] text-[var(--muted-2)]">
                  {status === "live"
                    ? "Your interviewer is about to greet you."
                    : "Your interviewer will greet you in a moment."}
                </p>
              ) : (
                captions.map((c) => <CaptionRow key={c.id} caption={c} />)
              )}
            </div>
          )}

          {active && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={live.toggleMute}
                  disabled={status !== "live"}
                  aria-pressed={muted}
                  aria-label="Mute microphone"
                  className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full transition-[color,background-color,border-color,opacity,transform] enabled:active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-50 ${
                    muted
                      ? "border border-[var(--line-ctl)] bg-[var(--card)] text-[var(--slate)] hover:border-[var(--line-hover)]"
                      : "bg-[var(--accent)] text-[var(--on-accent)] [box-shadow:var(--sh-accent)] hover:bg-[var(--accent-hover)]"
                  }`}
                >
                  {/* Halo that swells with the candidate's voice. */}
                  {!muted && (
                    <span
                      ref={micMeterRef}
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-full bg-[var(--accent)] opacity-25"
                      style={{
                        transform: "scale(calc(1 + var(--cd-mic, 0) * 0.35))",
                      }}
                    />
                  )}
                  <span className="relative">
                    <MicIcon size={20} off={muted} />
                  </span>
                </button>
                <div className="text-[12.5px] leading-[1.45]">
                  <p className="font-semibold text-[var(--heading)]">
                    {status === "live"
                      ? muted
                        ? "Mic off"
                        : "Mic on"
                      : "Mic"}
                  </p>
                  <p className="text-[var(--muted-2)]">
                    {status === "live"
                      ? muted
                        ? "Tap to talk again"
                        : "Tap to mute while you think"
                      : "Starts when you're connected"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 max-desk:w-full max-desk:[&>*]:flex-1">
                <button
                  type="button"
                  onClick={() => live.sendCue("hint")}
                  disabled={status !== "live"}
                  className={`${cueButtonClasses} border-[var(--line-ctl)] bg-[var(--card)] text-[var(--slate)] hover:border-[var(--line-hover)]`}
                >
                  Hint
                </button>
                <button
                  type="button"
                  onClick={() => live.sendCue("repeat")}
                  disabled={status !== "live"}
                  className={`${cueButtonClasses} border-[var(--line-ctl)] bg-[var(--card)] text-[var(--slate)] hover:border-[var(--line-hover)]`}
                >
                  Repeat
                </button>
                <button
                  type="button"
                  onClick={() => live.sendCue("end")}
                  disabled={status !== "live"}
                  className={`${cueButtonClasses} border-transparent bg-[var(--accent-tint)] text-[var(--accent)] hover:border-[var(--accent)]`}
                >
                  End case &amp; get feedback
                </button>
              </div>
            </div>
          )}

          {status === "ended" && (
            <p className="rounded-[var(--rs)] border border-[var(--tint-border)] bg-[var(--tint)] px-3.5 py-3 text-[13px] leading-[1.55] text-[var(--slate)] [text-wrap:pretty]">
              <span className="font-bold text-[var(--heading)]">
                Log your run.
              </span>{" "}
              Use Mark done or Mark revisit at the top of the page to record
              the score your interviewer gave you.
              {hasSolution &&
                " The casebook's full approach is in the Solution section below."}
            </p>
          )}
        </div>
      )}

      {idle && (
        <div className="mt-[18px] flex items-start gap-2.5 rounded-[var(--rs)] border border-[var(--tint-border)] bg-[var(--tint)] px-3.5 py-3 text-[13px] leading-[1.55] text-[var(--slate)]">
          {infoIcon}
          <p className="[text-wrap:pretty]">
            <span className="font-bold text-[var(--heading)]">
              Built for practising with peers.
            </span>{" "}
            CaseDeck is designed around practising live with other students —
            that&apos;s what we believe gives the best results. Use the AI
            interviewer when you can&apos;t find a partner, not instead of one.{" "}
            <Link
              href="/match"
              className="whitespace-nowrap font-semibold text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
            >
              Find a partner →
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
