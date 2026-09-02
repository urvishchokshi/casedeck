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
        title="My Progress"
        subtitle="Your practice activity at a glance"
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <p className="text-[length:var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              {stat.label}
            </p>
            <p className="mt-2 text-[length:var(--font-size-2xl)] font-bold text-[var(--color-text)]">
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {chartPlaceholders.map((label) => (
          <Card key={label}>
            <p className="text-[length:var(--font-size-sm)] font-semibold text-[var(--color-text)]">
              {label}
            </p>
            <div className="mt-4 flex h-56 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-placeholder)]">
              <span className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
                Chart coming soon
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
