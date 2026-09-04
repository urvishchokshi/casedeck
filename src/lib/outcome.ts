import type { CaseOutcome } from "@/lib/types";

/**
 * Single source of truth for how the two outcomes render: pill label +
 * Pill tone (case detail, library table, mobile cards) and the long option
 * label used by the log dialog's segmented control.
 */
export const OUTCOME_META: Record<
  CaseOutcome,
  { pill: string; tone: "accent" | "chip"; option: string }
> = {
  done: { pill: "Done", tone: "accent", option: "Done" },
  revisit: { pill: "Revisit", tone: "chip", option: "Revisit before placement" },
};

export const OUTCOME_ORDER: CaseOutcome[] = ["done", "revisit"];
