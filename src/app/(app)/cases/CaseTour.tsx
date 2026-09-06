"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * First-visit spotlight walkthrough (design: Case Library page, "Onboarding").
 * Four steps highlight the sidebar nav, the status segments, the filter
 * dropdowns and the case rows via `[data-tour=…]` anchors. The spotlight is a
 * fixed div whose giant box-shadow dims everything around the target; both it
 * and the step card glide between targets (`.cd-tour-move`). Runs once —
 * remembered in localStorage — and only after a short delay so the page's
 * mount animations have settled. Clear the key to replay:
 * `localStorage.removeItem("cd-tour-v1")`.
 */

const STORAGE_KEY = "cd-tour-v1";
const SPOT_PAD = 8;
const CARD_W = 300;
const CARD_H = 215; // estimate for placement math only (matches the design)
const CARD_GAP = 20;
const EDGE = 16;

/** Candidate anchors per step; first visible wins (the nav step falls back to
 *  the mobile Brand + hamburger header below `desk:`). */
const STEP_TARGETS: readonly string[][] = [
  ["nav", "nav-mobile"],
  ["status"],
  ["filters"],
  ["rows"],
];

const buildSteps = (totalCases: number): { title: string; body: string }[] => [
  {
    title: "Everything in one place",
    body: "Cases, casebooks, partners and your dashboard all live in this sidebar. Frameworks and guesstimates are on the way.",
  },
  {
    title: "Track where you are",
    body: "Flip between cases you haven't started, ones worth revisiting, and the ones you've finished.",
  },
  {
    title: "Narrow it down",
    body: `Filter ${
      totalCases > 1 ? `${totalCases} cases` : "cases"
    } by type, industry, difficulty, company, casebook or rating to find exactly what you want to practise.`,
  },
  {
    title: "Open any case",
    body: "Each row opens the full case with the prompt, exhibits and a suggested structure. Ratings show what other users thought.",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTarget(targets: readonly string[]): HTMLElement | null {
  for (const name of targets) {
    for (const el of document.querySelectorAll<HTMLElement>(
      `[data-tour="${name}"]`
    )) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

export function CaseTour({ totalCases }: { totalCases: number }) {
  const [step, setStep] = useState(-1);
  const [rect, setRect] = useState<Rect | null>(null);
  const steps = buildSteps(totalCases);
  const stepRef = useRef(step);
  stepRef.current = step;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const measure = useCallback(() => {
    const i = stepRef.current;
    if (i < 0) return;
    const el = findTarget(STEP_TARGETS[i]);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  const goStep = useCallback(
    (i: number) => {
      setStep(i);
      stepRef.current = i;
      const el = findTarget(STEP_TARGETS[i]);
      // Long targets (the case rows) may start off-screen.
      el?.scrollIntoView({ block: "nearest" });
      measure();
      requestAnimationFrame(measure);
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(measure, 360);
    },
    [measure]
  );

  const end = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Private mode etc. — the tour just repeats next visit.
    }
    setStep(-1);
    setRect(null);
  }, []);

  // First visit only, after the page's mount animations settle.
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      seen = true;
    }
    if (seen) return;
    const t = setTimeout(() => goStep(0), 650);
    return () => clearTimeout(t);
  }, [goStep]);

  // Rects are viewport-relative, so both resize and any scroll invalidate them.
  useEffect(() => {
    if (step < 0) return;
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer.current);
    };
  }, [step, measure, end]);

  if (step < 0 || !rect) return null;

  // Card placement: below the target, else above, else beside, else pinned to
  // the bottom edge — always clamped 16px inside the viewport (design logic).
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(CARD_W, vw - EDGE * 2);
  const clampT = (t: number) =>
    Math.min(Math.max(EDGE, t), Math.max(EDGE, vh - CARD_H - EDGE));
  const clampL = (l: number) =>
    Math.min(Math.max(EDGE, l), Math.max(EDGE, vw - cardW - EDGE));
  const centeredL = clampL(rect.left + rect.width / 2 - cardW / 2);
  const below = rect.top + rect.height + SPOT_PAD + CARD_GAP;
  const above = rect.top - SPOT_PAD - CARD_GAP - CARD_H;
  let cardTop: number;
  let cardLeft: number;
  if (below + CARD_H <= vh - EDGE) {
    cardTop = below;
    cardLeft = centeredL;
  } else if (above >= EDGE) {
    cardTop = above;
    cardLeft = centeredL;
  } else if (rect.left + rect.width + CARD_GAP + cardW <= vw - EDGE) {
    cardLeft = rect.left + rect.width + CARD_GAP;
    cardTop = clampT(rect.top + rect.height / 2 - CARD_H / 2);
  } else if (rect.left - CARD_GAP - cardW >= EDGE) {
    cardLeft = rect.left - CARD_GAP - cardW;
    cardTop = clampT(rect.top + rect.height / 2 - CARD_H / 2);
  } else {
    cardLeft = centeredL;
    cardTop = clampT(vh - CARD_H - EDGE);
  }

  const current = steps[step];
  const last = step === steps.length - 1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
      className="cd-fade-in fixed inset-0 z-[80]"
      onClick={end}
    >
      <div
        aria-hidden
        className="cd-spotlight cd-tour-move absolute rounded-[var(--r-spot)]"
        style={{
          top: rect.top - SPOT_PAD,
          left: rect.left - SPOT_PAD,
          width: rect.width + SPOT_PAD * 2,
          height: rect.height + SPOT_PAD * 2,
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="cd-tour-move absolute rounded-[var(--r-modal)] bg-[var(--card)] p-[18px] [box-shadow:var(--sh-tour-card)]"
        style={{ top: cardTop, left: cardLeft, width: cardW }}
      >
        <div className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">
          Step {step + 1} of {steps.length}
        </div>
        <div className="mt-[7px] text-[17px] font-bold tracking-[-0.02em] text-[var(--heading)]">
          {current.title}
        </div>
        <div className="mt-1.5 text-[13.5px] leading-[1.5] text-[var(--muted)]">
          {current.body}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-[5px]">
            {steps.map((s, i) => (
              <span
                key={s.title}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === step ? "bg-[var(--accent)]" : "bg-[var(--line-ctl)]"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={end}
              className="text-[12.5px] text-[var(--muted-2)] transition-colors hover:text-[var(--ink)]"
            >
              Skip
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => (last ? end() : goStep(step + 1))}
              className="h-[34px] min-w-[76px] whitespace-nowrap rounded-[var(--rs)] bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--on-accent)] transition-[color,background-color,transform] enabled:active:scale-[0.97] hover:bg-[var(--accent-hover)]"
            >
              {last ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
