"use client";

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/Button";
import {
  markDone,
  toggleMarkedForLater,
  unmarkDone,
} from "@/app/actions/progress";

export interface CaseProgressState {
  completed: boolean;
  marked_for_later: boolean;
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
  const completed = progress?.completed ?? false;
  const [optimisticMarked, setOptimisticMarked] = useOptimistic(
    progress?.marked_for_later ?? false
  );
  const [markPending, startMarkTransition] = useTransition();
  const [markError, setMarkError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex flex-none flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          aria-pressed={optimisticMarked}
          // Disabled while in flight: a second click before the server settles
          // would re-toggle from a stale read and desync UI and DB.
          disabled={markPending}
          className={
            optimisticMarked
              ? "border-[var(--amber-50)]! bg-[var(--amber-50)]! text-[var(--amber)]! hover:bg-[var(--amber-50)]!"
              : ""
          }
          onClick={() =>
            startMarkTransition(async () => {
              setMarkError(null);
              setOptimisticMarked(!optimisticMarked);
              const result = await toggleMarkedForLater(caseId);
              if (!result.ok) setMarkError(result.error);
            })
          }
        >
          {optimisticMarked ? "Marked ★" : "Mark for later"}
        </Button>
        <Button
          className={
            completed
              ? "bg-[var(--accent-50)]! text-[var(--accent)]! hover:bg-[var(--accent-100)]!"
              : ""
          }
          onClick={() => setDialogOpen(true)}
        >
          {completed ? "Done ✓" : "Mark done"}
        </Button>
      </div>
      {markError && (
        <p className="text-[12.5px] font-semibold text-[var(--amber)]">
          {markError}
        </p>
      )}
      {dialogOpen && (
        <LogCaseDialog
          caseId={caseId}
          completed={completed}
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
  completed,
  initialQuality,
  initialScore,
  onClose,
}: {
  caseId: string;
  completed: boolean;
  initialQuality: number | null;
  initialScore: number | null;
  onClose: () => void;
}) {
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
          {completed && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => unmarkDone(caseId))}
              className="mr-auto text-[13px] font-semibold text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Unmark done
            </button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={quality === null || score === null || pending}
            onClick={() => {
              if (quality === null || score === null) return;
              run(() => markDone(caseId, quality, score));
            }}
          >
            {completed ? "Save changes" : "Save & mark done"}
          </Button>
        </div>
      </div>
    </div>
  );
}
