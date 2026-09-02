import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";

interface Stat {
  label: string;
  value: string;
}

const stats: Stat[] = [
  { label: "Cases Done", value: "—" },
  { label: "Avg Self-Score", value: "—" },
  { label: "Marked for Later", value: "—" },
  { label: "Cases Rated", value: "—" },
];

const chartPlaceholders = [
  "Cases completed over time",
  "Self-scores by case type",
] as const;

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Your numbers"
        subtitle="Your practice activity at a glance"
      />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="px-[18px] py-4">
            <p className="text-[11.5px] font-semibold text-[var(--muted)]">
              {stat.label}
            </p>
            <p className="mt-1.5 font-[family-name:var(--font-display)] text-[42px] leading-none text-[var(--ink)]">
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-[18px] grid grid-cols-1 gap-[18px] xl:grid-cols-2">
        {chartPlaceholders.map((label) => (
          <Card key={label} className="px-5 py-[18px]">
            <h2 className="text-[22px] text-[var(--ink)]">{label}</h2>
            <div className="mt-3.5 grid h-56 place-items-center rounded-[var(--rs)] border border-[var(--line)] [background:var(--ph)]">
              <span className="text-[12px] font-semibold text-[var(--muted)]">
                Chart coming soon
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
