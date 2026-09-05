import { Pill } from "@/components/ui/Pill";
import { OUTCOME_META } from "@/lib/outcome";
import type { CaseOutcome } from "@/lib/types";

/** Dot-pill for a logged outcome — shared by the library table, mobile cards
 *  and the case detail header. */
export function OutcomePill({ outcome }: { outcome: CaseOutcome }) {
  const meta = OUTCOME_META[outcome];
  return (
    <Pill tone={meta.tone}>
      <span
        aria-hidden
        className="h-[6px] w-[6px] rounded-full"
        style={{ background: meta.dot }}
      />
      {meta.pill}
    </Pill>
  );
}
