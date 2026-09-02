import Link from "next/link";
import { Search, Star } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

const filterChips = [
  "Difficulty",
  "Industry",
  "Case Type",
  "Rating",
  "Casebook",
  "Status",
] as const;

interface PlaceholderCase {
  id: string;
  title: string;
  tags: [string, string, string];
}

const placeholderCases: PlaceholderCase[] = [
  { id: "1", title: "Airline Profitability Decline", tags: ["Profitability", "Aviation", "Medium"] },
  { id: "2", title: "FMCG Market Entry in Tier-2 Cities", tags: ["Market Entry", "FMCG", "Hard"] },
  { id: "3", title: "Pharma Pricing Strategy", tags: ["Pricing", "Pharma", "Medium"] },
  { id: "4", title: "EV Charging Network Expansion", tags: ["Growth", "Auto", "Hard"] },
  { id: "5", title: "Quick-Commerce Unit Economics", tags: ["Profitability", "E-commerce", "Easy"] },
  { id: "6", title: "Bank Digital Transformation", tags: ["Operations", "BFSI", "Medium"] },
];

function StarRating() {
  return (
    <div className="flex items-center gap-0.5 text-[var(--color-text-muted)]">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={14}
          className={i < 4 ? "fill-current" : ""}
        />
      ))}
      <span className="ml-1.5 text-[length:var(--font-size-xs)]">4.0</span>
    </div>
  );
}

export default function CasesPage() {
  return (
    <div>
      <PageHeader
        title="Case Library"
        subtitle="Browse and practice cases from ISB casebooks"
      />

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="search"
          disabled
          placeholder="Search cases…"
          className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-[length:var(--font-size-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {filterChips.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled
            className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[length:var(--font-size-xs)] font-medium text-[var(--color-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {chip} ▾
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {placeholderCases.map((c) => (
          <Link key={c.id} href={`/cases/${c.id}`}>
            <Card className="h-full transition-colors hover:border-[var(--color-accent)]">
              <h2 className="text-[length:var(--font-size-base)] font-semibold text-[var(--color-text)]">
                {c.title}
              </h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.tags.map((tag) => (
                  <Pill key={tag}>{tag}</Pill>
                ))}
              </div>
              <div className="mt-4">
                <StarRating />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
