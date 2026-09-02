import { PageHeader } from "@/components/PageHeader";
import { Collapsible } from "@/components/ui/Collapsible";
import { Pill } from "@/components/ui/Pill";

const loremShort =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

const loremLong = `${loremShort} Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <PageHeader
        title={`Placeholder Case #${id}`}
        subtitle="Case detail — content pipeline coming in a later phase"
      />

      <div className="flex flex-wrap gap-1.5">
        <Pill>Profitability</Pill>
        <Pill>Aviation</Pill>
        <Pill>Medium</Pill>
        <Pill>ISB Casebook 2025</Pill>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        <Collapsible title="Case Prompt" defaultOpen>
          {loremLong}
        </Collapsible>
        <Collapsible title="Interviewer Guidance">{loremShort}</Collapsible>
      </div>

      <section className="mt-8 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-[length:var(--font-size-base)] font-semibold text-[var(--color-text)]">
          Solution
        </h2>
        <div className="mt-4 flex h-64 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-placeholder)]">
          <span className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Solution image placeholder
          </span>
        </div>
      </section>
    </div>
  );
}
