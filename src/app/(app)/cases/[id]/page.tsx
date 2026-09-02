import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Transcript, type TranscriptRow } from "./Transcript";

const loremShort =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

const loremLong = `${loremShort} Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;

const transcriptRows: TranscriptRow[] = [
  { heading: "Clarifying questions", content: loremShort },
  { heading: "Structure", content: loremLong },
  { heading: "Analysis", content: loremLong },
  { heading: "Recommendation", content: loremShort },
];

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-[820px]">
      <Link
        href="/cases"
        className="mb-4 inline-block text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
      >
        ← Case library
      </Link>

      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="mb-2 font-[family-name:var(--font-mono)] text-[12px] font-medium text-[var(--muted)]">
            isb-2025 · case-00{id}.pdf
          </p>
          <h1 className="mb-3 text-[44px] text-[var(--ink)]">
            Placeholder Case #{id}
          </h1>
          <div className="flex flex-wrap gap-[7px]">
            <Pill tone="accent">Profitability</Pill>
            <Pill>Aviation</Pill>
            <Pill>Medium</Pill>
            <Pill tone="amber">★ 4.0</Pill>
          </div>
        </div>
        <div className="flex flex-none gap-2">
          <Button variant="secondary" disabled>
            Mark for later
          </Button>
          <Button disabled>Mark done</Button>
        </div>
      </div>

      <div className="flex flex-col gap-[22px]">
        <section className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-[22px] [box-shadow:var(--sh)]">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.07em] text-[var(--accent)]">
            Prompt
          </p>
          <p className="text-[17px] leading-[1.6]">{loremShort}</p>
        </section>

        <Transcript rows={transcriptRows} />

        <section>
          <h2 className="mb-2.5 text-[24px] text-[var(--ink)]">Solution</h2>
          <div className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-[22px] [box-shadow:var(--sh)]">
            <div className="grid h-64 place-items-center rounded-[var(--rs)] border border-[var(--line)] [background:var(--ph)]">
              <span className="text-[12px] font-semibold text-[var(--muted)]">
                Solution image placeholder
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
