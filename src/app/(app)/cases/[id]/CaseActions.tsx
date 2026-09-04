"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { clearOutcome, logCase } from "@/app/actions/progress";
import { OUTCOME_META, OUTCOME_ORDER } from "@/lib/outcome";
import type { CaseOutcome } from "@/lib/types";

export interface CaseProgressState {
  outcome: CaseOutcome | null;
  self_score: number | null;
  quality_rating: number | null;
}

const TEXT_ACTION_CLASSES =
  "text-[13px] font-semibold text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50";

export function CaseActions({
  caseId,
  progress,
}: {
  caseId: string;
  progress: CaseProgressState | null;
}) {
  const outcome = progress?.outcome ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const [unmarkPending, startUnmarkTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex flex-none flex-col items-end gap-1.5">
      <div className="flex gap-2">
        {outcome === null ? (
          <Button onClick={() => setDialogOpen(true)}>Log this case</Button>
        ) : (
          <span className="flex items-center gap-2.5">
            <Pill tone={OUTCOME_META[outcome].tone}>
              {OUTCOME_META[outcome].pill}
            </Pill>
            <button
              type="button"
              className={TEXT_ACTION_CLASSES}
              disabled={unmarkPending}
              onClick={() => setDialogOpen(true)}
            >
              Edit
            </button>
            <button
              type="button"
              className={TEXT_ACTION_CLASSES}
              disabled={unmarkPending}
              onClick={() =>
                startUnmarkTransition(async () => {
                  setActionError(null);
                  const result = await clearOutcome(caseId);
                  if (!result.ok) setActionError(result.error);
                })
              }
            >
              Unmark
            </button>
          </span>
        )}
      </div>
      {actionError && (
        <p className="text-[12.5px] font-semibold text-[var(--amber)]">
          {actionError}
        </p>
      )}
      {dialogOpen && (
        <LogCaseDialog
          caseId={caseId}
          initialOutcome={outcome}
          initialQuality={progress?.quality_rating ?? null}
          initialScore={progress?.self_score ?? null}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}

const QUALITY_VALUES = [1, 2, 3, 4, 5];
const SCORE_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

function LogCaseDialog({
  caseId,
  initialOutcome,
  initialQuality,
  initialScore,
  onClose,
}: {
  caseId: string;
  initialOutcome: CaseOutcome | null;
  initialQuality: number | null;
  initialScore: number | null;
  onClose: () => void;
}) {
  // Defaulting to "done" keeps the required control always satisfied.
  const [outcome, setOutcome] = useState<CaseOutcome>(initialOutcome ?? "done");
  const [quality, setQuality] = useState(initialQuality);
  const [score, setScore] = useState(initialScore);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape/backdrop must not close mid-save — the discarded error would leave
  // the user unsure whether anything was written.
  const closeUnlessPending = () => {
    if (!pending) onClose();
  };

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] p-6 backdrop-blur-[2px]"
      onClick={closeUnlessPending}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Log this case"
        onClick={(e) => e.stopPropagation()}
        className="flex w-[440px] max-w-full flex-col gap-5 rounded-[var(--r-modal)] bg-[var(--card)] p-[26px] outline-none [box-shadow:var(--sh-modal)]"
      >
        <div>
          <h3 className="mb-1 text-[28px] text-[var(--ink)]">Log this case</h3>
          <p className="text-[13.5px] text-[var(--muted)]">
            Your rating helps the next student pick well.
          </p>
        </div>

        <div>
          <p className="mb-[7px] text-[12px] font-semibold text-[var(--muted)]">
            Outcome
          </p>
          <div role="group" aria-label="Outcome" className="flex flex-wrap gap-1.5">
            {OUTCOME_ORDER.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={outcome === o}
                onClick={() => setOutcome(o)}
                className={`whitespace-nowrap rounded-[var(--rs)] border px-2.5 py-1.5 text-[13px] font-semibold ${
                  outcome === o
                    ? "border-[var(--accent)] bg-[var(--accent-50)] text-[var(--accent)]"
                    : "border-[var(--line)] bg-[var(--card)] text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
                }`}
              >
                {OUTCOME_META[o].option}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-[7px] text-[12px] font-semibold text-[var(--muted)]">
            Case quality
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUALITY_VALUES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={quality === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={() => setQuality(n)}
                className={`whitespace-nowrap rounded-[var(--rs)] border px-2.5 py-1.5 text-[13px] ${
                  quality === n
                    ? "border-[var(--amber)] bg-[var(--amber-50)] text-[var(--amber)]"
                    : "border-[var(--line)] bg-[var(--card)] text-[var(--status-idle)] transition-colors hover:text-[var(--amber)]"
                }`}
              >
                {"★".repeat(n)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-[7px] text-[12px] font-semibold text-[var(--muted)]">
            How did you perform? (1–10)
          </p>
          <div className="flex flex-wrap gap-[5px]">
            {SCORE_VALUES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={score === n}
                onClick={() => setScore(n)}
                className={`h-[33px] w-[33px] rounded-[var(--rs)] border text-[13px] font-semibold ${
                  score === n
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                    : "border-[var(--line)] bg-[var(--card)] text-[var(--ink)] transition-colors hover:bg-[var(--thead)]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-[12.5px] font-semibold text-[var(--amber)]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={quality === null || score === null || pending}
            onClick={() => {
              if (quality === null || score === null) return;
              run(() => logCase(caseId, outcome, quality, score));
            }}
          >
            {initialOutcome !== null ? "Save changes" : "Save log"}
          </Button>
        </div>
      </div>
    </div>
  );
}
