"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { clearOutcome, logCase } from "@/app/actions/progress";
import { OUTCOME_META, OUTCOME_ORDER } from "@/lib/outcome";
import type { CaseOutcome } from "@/lib/types";

export interface CaseProgressState {
  outcome: CaseOutcome | null;
  self_score: number | null;
  quality_rating: number | null;
}

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
  // Which outcome the dialog opens preselected to; null = closed.
  const [dialogOutcome, setDialogOutcome] = useState<CaseOutcome | null>(null);

  const unmark = () =>
    startUnmarkTransition(async () => {
      setActionError(null);
      const result = await clearOutcome(caseId);
      if (!result.ok) setActionError(result.error);
    });

  return (
    <div className="flex min-w-0 flex-col items-end gap-1.5 max-desk:w-full max-desk:items-stretch">
      <div className="flex flex-wrap items-center gap-2">
        {/* Mark done: opens the log dialog preselected to "done"; when
            already done, clicking unmarks. */}
        <button
          type="button"
          disabled={unmarkPending}
          aria-pressed={outcome === "done"}
          aria-label={outcome === "done" ? "Unmark done" : "Mark done"}
          title={outcome === "done" ? "Unmark done" : undefined}
          onClick={() =>
            outcome === "done" ? unmark() : setDialogOutcome("done")
          }
          className={`flex h-[38px] items-center gap-2 whitespace-nowrap rounded-[11px] px-4 text-[12.5px] font-semibold transition-[opacity,transform] enabled:active:scale-[0.97] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
            outcome === "done"
              ? "bg-[var(--done-bg)] text-[var(--done-fg)]"
              : "bg-[var(--accent)] text-[var(--on-accent)] [box-shadow:var(--sh-accent)]"
          }`}
        >
          <span
            aria-hidden
            className={`h-[7px] w-[7px] rounded-full ${
              outcome === "done"
                ? "bg-[var(--done-dot)]"
                : "bg-[var(--on-accent)] opacity-85"
            }`}
          />
          {outcome === "done" ? "Done" : "Mark done"}
        </button>

        <button
          type="button"
          disabled={unmarkPending}
          aria-pressed={outcome === "revisit"}
          onClick={() =>
            outcome === "revisit" ? unmark() : setDialogOutcome("revisit")
          }
          className={`h-[38px] whitespace-nowrap rounded-[11px] border px-4 text-[12.5px] font-semibold transition-[color,background-color,border-color,opacity,transform] enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
            outcome === "revisit"
              ? "border-[var(--revisit-border)] bg-[var(--revisit-bg)] text-[var(--revisit-fg)] hover:border-[var(--revisit-dot)]"
              : "border-[var(--line-ctl)] bg-[var(--card)] text-[var(--slate)] hover:border-[var(--revisit-dot)]"
          }`}
        >
          {outcome === "revisit" ? "Unmark revisit" : "Mark revisit"}
        </button>

        {outcome !== null && (
          <button
            type="button"
            disabled={unmarkPending}
            onClick={() => setDialogOutcome(outcome)}
            className="h-[38px] whitespace-nowrap rounded-[11px] border border-[var(--line-ctl)] bg-[var(--card)] px-4 text-[12.5px] font-semibold text-[var(--slate)] transition-[color,background-color,border-color,opacity,transform] enabled:active:scale-[0.97] hover:border-[var(--line-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit
          </button>
        )}
      </div>
      {actionError && (
        <p className="text-[12.5px] font-semibold text-[var(--weak)]">
          {actionError}
        </p>
      )}
      {dialogOutcome !== null && (
        <LogCaseDialog
          caseId={caseId}
          hadOutcome={outcome !== null}
          initialOutcome={dialogOutcome}
          initialQuality={progress?.quality_rating ?? null}
          initialScore={progress?.self_score ?? null}
          onClose={() => setDialogOutcome(null)}
        />
      )}
    </div>
  );
}

const QUALITY_VALUES = [1, 2, 3, 4, 5];
const SCORE_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

function LogCaseDialog({
  caseId,
  hadOutcome,
  initialOutcome,
  initialQuality,
  initialScore,
  onClose,
}: {
  caseId: string;
  hadOutcome: boolean;
  initialOutcome: CaseOutcome;
  initialQuality: number | null;
  initialScore: number | null;
  onClose: () => void;
}) {
  const [outcome, setOutcome] = useState<CaseOutcome>(initialOutcome);
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
      className="cd-fade-in fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[var(--overlay)] p-6 backdrop-blur-[2px]"
      onClick={closeUnlessPending}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Log this case"
        onClick={(e) => e.stopPropagation()}
        className="cd-scale-in flex max-h-[calc(100dvh-48px)] w-[440px] max-w-full flex-col gap-5 overflow-y-auto rounded-[var(--r-modal)] bg-[var(--card)] p-[26px] outline-none [box-shadow:var(--sh-modal)]"
      >
        <div>
          <h3 className="mb-1 text-[24px] tracking-[-0.02em]">
            Log this case
          </h3>
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
                className={`whitespace-nowrap rounded-[9px] border px-3 py-[7px] text-[12.5px] font-semibold transition-colors ${
                  outcome === o
                    ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]"
                    : "border-[var(--line-ctl)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--ink)]"
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
                className={`whitespace-nowrap rounded-[9px] border px-2.5 py-[7px] text-[13px] transition-colors ${
                  quality === n
                    ? "border-[var(--revisit-border)] bg-[var(--revisit-bg)] text-[var(--revisit-fg)]"
                    : "border-[var(--line-ctl)] bg-[var(--card)] text-[var(--dash)] hover:text-[var(--revisit-fg)]"
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
                className={`h-[33px] w-[33px] rounded-[9px] border text-[13px] font-semibold transition-colors ${
                  score === n
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                    : "border-[var(--line-ctl)] bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--thead)]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-[12.5px] font-semibold text-[var(--weak)]">
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
            {hadOutcome ? "Save changes" : "Save log"}
          </Button>
        </div>
      </div>
    </div>
  );
}
