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

      <Card className="divide-y divide-[var(--line-soft)] overflow-hidden p-0">
        {frameworks.map((framework) => (
          <div key={framework} className="px-[18px] py-3.5">
            <p className="text-[15.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
              {framework}
            </p>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
              Study notes coming soon
            </p>
          </div>
        ))}
      </Card>
    </div>
  );
}
