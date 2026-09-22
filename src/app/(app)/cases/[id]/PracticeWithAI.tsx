"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";

/** How long the copied state (button label + pill) stays up. */
const COPIED_VISIBLE_MS = 2000;

type CopyStatus = "idle" | "copied" | "failed";

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

const copyIcon = (
  <svg
    width="14"
    height="14"
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

const checkIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden
    className="shrink-0"
  >
    <path
      d="M4 10.5l4 4 8-9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
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

/**
 * "Practice with AI" card on /cases/[id]: a single copy button for the prompt
 * built server-side by buildPracticePrompt (docs/practice-with-ai-prompt.md).
 * The prompt exists only in this prop — it is never rendered, hidden or
 * logged. Copied/failed states show in a persistent polite live region so
 * screen readers announce them.
 */
export function PracticeWithAI({ prompt }: { prompt: string }) {
  const headingId = useId();
  const [status, setStatus] = useState<CopyStatus>("idle");
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
    setStatus(next);
    if (next === "copied") {
      resetTimer.current = setTimeout(() => {
        resetTimer.current = null;
        setStatus("idle");
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

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-[22px] py-5 [box-shadow:var(--sh)] max-desk:px-4"
    >
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
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--muted)] [text-wrap:pretty]">
              Copy the prompt, paste it into ChatGPT or Claude, switch to voice
              mode and run this case with an AI interviewer. Keep this page open
              for exhibits, and say &quot;end the case&quot; for feedback.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center desk:w-[240px] desk:shrink-0">
          <Button
            type="button"
            onClick={copy}
            className="max-desk:h-11 max-desk:w-full"
          >
            {/* Both labels share one grid cell so the button keeps its width
                through the swap. */}
            <span className="grid">
              <span
                className={`col-start-1 row-start-1 flex items-center justify-center gap-2 ${
                  status === "copied" ? "invisible" : ""
                }`}
              >
                {copyIcon}
                Copy prompt
              </span>
              <span
                className={`col-start-1 row-start-1 flex items-center justify-center gap-2 ${
                  status === "copied" ? "" : "invisible"
                }`}
              >
                {checkIcon}
                Prompt copied
              </span>
            </span>
          </Button>
          {/* Sized to the caption (one line stacked, two in the desk column)
              so swapping in the pill never shifts the card. */}
          <div className="flex min-h-[30px] items-center justify-center desk:min-h-[36px]">
            {status === "idle" && (
              <p className="text-[12px] leading-[1.5] text-[var(--muted-2)] [text-wrap:pretty]">
                Works best in ChatGPT&apos;s or Claude&apos;s voice mode on your
                phone.
              </p>
            )}
            {/* Always mounted (empty when idle) so the announcement is
                reliable — live regions inserted with content are often
                skipped. */}
            <div aria-live="polite">
              {status === "copied" && (
                <Pill tone="done" className="cd-pop-in">
                  <span
                    aria-hidden
                    className="h-[6px] w-[6px] rounded-full bg-[var(--done-dot)]"
                  />
                  Prompt copied
                </Pill>
              )}
              {status === "failed" && (
                <p className="text-[12px] font-semibold text-[var(--muted)]">
                  Couldn&apos;t copy — try again.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

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
    </section>
  );
}
