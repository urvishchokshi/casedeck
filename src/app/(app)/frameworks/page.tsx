import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";

const frameworks: string[] = [
  "Profitability Framework",
  "Market Entry Framework",
  "Pricing Strategy",
  "Mergers & Acquisitions",
  "Growth Strategy",
  "Guesstimates & Market Sizing",
];

export default function FrameworksPage() {
  return (
    <div>
      <PageHeader
        title="Frameworks & Study Material"
        subtitle="Core structures for cracking case interviews"
      />

      <Card className="divide-y divide-[var(--color-border)] p-0">
        {frameworks.map((framework) => (
          <div
            key={framework}
            className="px-5 py-4 text-[length:var(--font-size-sm)] font-medium text-[var(--color-text)]"
          >
            {framework}
            <p className="mt-0.5 text-[length:var(--font-size-xs)] font-normal text-[var(--color-text-muted)]">
              Study notes coming soon
            </p>
          </div>
        ))}
      </Card>
    </div>
  );
}
