import type { CaseOutcome } from "@/lib/types";

/**
 * Single source of truth for how the three outcomes render: pill label +
 * Pill tone (case detail, library table, mobile cards) and the long option
 * label used by the log dialog's segmented control.
 */
export const OUTCOME_META: Record<
  CaseOutcome,
  { pill: string; tone: "accent" | "amber" | "chip"; option: string }
> = {
  done: { pill: "Done", tone: "accent", option: "Done" },
  retry: { pill: "Retry", tone: "amber", option: "Need to retry" },
  revisit: { pill: "Revisit", tone: "chip", option: "Revisit before placement" },
};

export const OUTCOME_ORDER: CaseOutcome[] = ["done", "retry", "revisit"];
