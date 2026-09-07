"use client";

import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/Button";

/**
 * "How CaseDeck works" onboarding guide (design: Case Library page). Six
 * paged steps in a centered modal on desktop and a bottom sheet below
 * `desk:`. AppShell owns the open state (auto-opens once per browser, and
 * the sidebar "How it works" item reopens it) — this component only renders
 * the dialog and pages through the steps.
 */

/** Once-per-browser marker — remove the key to replay the auto-open. */
export const GUIDE_KEY = "cd-guide-v1";
/** Fired when the guide closes; CaseTour waits on it (guide-before-tour). */
export const GUIDE_DONE_EVENT = "cd-guide-done";

interface GuideItem {
  n: string;
  lead: string;
  text: string;
}

interface GuideStep {
  title: string;
  paras: readonly string[];
  items?: readonly GuideItem[];
  contact?: boolean;
}

const STEPS: readonly GuideStep[] = [
  {
    title: "Every casebook, one shelf.",
    paras: [
      "CaseDeck puts every casebook in one searchable place so you spend your prep time practising, not hunting for PDFs. Two minutes on how it's meant to be used.",
    ],
  },
  {
    title: "This is a two-person tool",
    paras: [
      "Every case here is an interview transcript, not a reading exercise. Pick a case with your case partner and decide who's interviewing.",
      "The interviewer reads the full transcript and the solution first — they need to know where the case goes before they can steer it. Then they open with the prompt, exactly as written, and the interviewee takes it from there. The transcript is the interviewer's script for what to reveal and when, not something the interviewee should see beforehand.",
    ],
  },
  {
    title: "Three things when the case ends",
    paras: ["The interviewer gives feedback first. Then the interviewee logs the case:"],
    items: [
      {
        n: "1",
        lead: "Outcome.",
        text: "Done, or Revisit before placement — so you can pull the right cases back up later.",
      },
      {
        n: "2",
        lead: "Rate the case, 1–5.",
        text: "This is you giving back. If a case was thin or the transcript wasn't useful, rate it low and save the next person the hour. Ratings show once three people have weighed in.",
      },
      {
        n: "3",
        lead: "Score yourself, 1–10.",
        text: "Private — nobody else sees it. It feeds only your dashboard, so be honest rather than kind.",
      },
    ],
  },
  {
    title: "One partner runs out of feedback",
    paras: [
      "Do most of your cases with your regular partner. But after ten or fifteen cases they'll have told you everything they can see, and the gaps they can't see are the ones that matter in the room.",
      "That's what Find a partner is for. Look for someone from a different background — a different function, industry, or campus — and run a few cases with them. They'll catch what your partner has stopped noticing.",
    ],
  },
  {
    title: "Know where you're weak before the interviewer does",
    paras: [
      "Your dashboard groups your self-scores by case type and industry and surfaces the areas where you're consistently lower. It only gets useful after a handful of logged cases, so log everything, including the ones that went badly. The “Practice →” links take you straight to a filtered list for that weak spot.",
    ],
  },
  {
    title: "Coming soon, and a number to ping",
    paras: [
      "Frameworks and Guesstimates are being added over the next few weeks.",
      "Found a broken case, a wrong page, or something that doesn't work? Message Urvish on WhatsApp — +91 91069 78191. Feedback on what would make this more useful is just as welcome.",
    ],
    contact: true,
  },
];

export function HowItWorksGuide({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reopening always restarts from step 1, and the panel takes focus so
  // Escape works immediately (same pattern as the mobile drawer).
  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setStep(0);
    panelRef.current?.focus();
    // Hand focus back to whatever opened the guide (no-op for auto-open).
    return () => opener?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      className="cd-fade-in fixed inset-0 z-[90] flex bg-[var(--overlay-guide)] max-desk:items-end desk:items-center desk:justify-center desk:p-[clamp(16px,4vw,40px)]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="How CaseDeck works"
        onClick={(e) => e.stopPropagation()}
        className="cd-scale-in flex w-full flex-col overflow-hidden bg-[var(--shell)] outline-none [box-shadow:var(--sh-guide)] max-desk:h-[92dvh] max-desk:max-h-[92dvh] max-desk:rounded-t-[var(--r-sheet)] desk:max-w-[720px] desk:rounded-[var(--r-shell)] desk:max-h-[min(660px,88dvh)]"
      >
        <div className="flex-none border-b border-[var(--line-inner)] bg-[var(--card)] p-[14px_20px_18px] desk:p-[24px_32px_22px]">
          <div className="mx-auto mb-3.5 h-1 w-11 rounded-[3px] bg-[var(--line-ctl)] desk:hidden" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-[9px]">
              <Brand markOnly markWidth={24} />
              <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">
                How CaseDeck works
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="whitespace-nowrap text-[12.5px] text-[var(--muted-2)] transition-colors hover:text-[var(--accent)]"
            >
              Skip
            </button>
          </div>
          <div className="mt-4 flex gap-[5px]">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={`h-[3px] flex-1 rounded-[2px] transition-colors ${
                  i <= step ? "bg-[var(--accent)]" : "bg-[var(--line-ctl)]"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-[22px_20px_26px] desk:p-[30px_32px_34px]">
          <div className="text-[11.5px] font-bold tracking-[0.09em] text-[var(--accent)]">
            Step {step + 1}
          </div>
          <h2 className="mt-2.5 text-[24px] leading-[1.1] tracking-[-0.03em] [text-wrap:pretty] desk:text-[32px]">
            {current.title}
          </h2>

          <div className="mt-4 flex flex-col gap-3.5">
            {current.paras.map((text) => (
              <p
                key={text}
                className="text-[14.5px] leading-[1.62] text-[var(--muted)] [text-wrap:pretty] desk:text-[15.5px]"
              >
                {text}
              </p>
            ))}
          </div>

          {current.items && (
            <div className="mt-[18px] flex flex-col gap-2.5">
              {current.items.map((it) => (
                <div
                  key={it.n}
                  className="flex items-start gap-[13px] rounded-2xl bg-[var(--card)] p-[15px_16px] [box-shadow:var(--sh)]"
                >
                  <span className="grid h-[25px] w-[25px] shrink-0 place-items-center rounded-lg bg-[var(--accent-tint)] text-[12.5px] font-bold text-[var(--accent)]">
                    {it.n}
                  </span>
                  <p className="text-[14.5px] leading-[1.58] text-[var(--muted)] [text-wrap:pretty] desk:text-[15.5px]">
                    <span className="font-bold text-[var(--heading)]">{it.lead}</span>{" "}
                    {it.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {current.contact && (
            <div className="mt-[18px] flex flex-wrap items-center justify-between gap-3.5 rounded-2xl bg-[var(--heading)] p-[16px_18px]">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--guide-contact-label)]">
                  Urvish on WhatsApp
                </div>
                <div className="mt-1 whitespace-nowrap text-[17px] font-bold tracking-[-0.02em] text-[var(--on-accent)]">
                  +91 91069 78191
                </div>
              </div>
              <a
                href="https://wa.me/919106978191"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 items-center whitespace-nowrap rounded-[var(--rs)] bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--on-accent)] transition-[color,background-color,transform] active:scale-[0.97] hover:bg-[var(--landing-cta-hover)]"
              >
                Message
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-none items-center justify-between gap-3.5 border-t border-[var(--line-inner)] bg-[var(--card)] p-[14px_20px_18px] desk:p-[18px_26px]">
          <span className="whitespace-nowrap text-[12px] text-[var(--faint)]">
            Step {step + 1} of {STEPS.length}
          </span>
          <div className="flex items-center gap-[9px]">
            {step > 0 && (
              <Button
                variant="secondary"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                Back
              </Button>
            )}
            <Button
              onClick={() => (last ? onClose() : setStep((s) => s + 1))}
              className="[box-shadow:var(--sh-accent)]"
            >
              {last ? "Start practising" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
