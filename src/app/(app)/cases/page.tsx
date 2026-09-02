import Link from "next/link";
import { Pill } from "@/components/ui/Pill";

interface FilterGroup {
  label: string;
  options: string[];
}

const filterGroups: FilterGroup[] = [
  { label: "Difficulty", options: ["Easy", "Medium", "Hard"] },
  { label: "Industry", options: ["Aviation", "FMCG", "Pharma", "Auto", "E-commerce", "BFSI"] },
  { label: "Type", options: ["Profitability", "Market Entry", "Pricing", "Growth", "Operations"] },
  { label: "Rating", options: ["4★ & up", "3★ & up", "Any"] },
  { label: "Casebook", options: ["ISB 2025", "IIM A", "IIM B", "IIM C"] },
  { label: "Status", options: ["Not started", "Done", "Marked for later"] },
];

type CaseStatus = "Done" | "Marked" | "Not started";

interface PlaceholderCase {
  id: string;
  title: string;
  casebook: string;
  source: string;
  type: string;
  industry: string;
  difficulty: string;
  rating: string;
  status: CaseStatus;
}

const placeholderCases: PlaceholderCase[] = [
  { id: "1", title: "Airline Profitability Decline", casebook: "ISB 2025", source: "case-001 · p. 12", type: "Profitability", industry: "Aviation", difficulty: "Medium", rating: "4.0", status: "Done" },
  { id: "2", title: "FMCG Market Entry in Tier-2 Cities", casebook: "IIM A", source: "case-014 · p. 48", type: "Market Entry", industry: "FMCG", difficulty: "Hard", rating: "4.3", status: "Not started" },
  { id: "3", title: "Pharma Pricing Strategy", casebook: "IIM B", source: "case-007 · p. 63", type: "Pricing", industry: "Pharma", difficulty: "Medium", rating: "3.8", status: "Not started" },
  { id: "4", title: "EV Charging Network Expansion", casebook: "ISB 2025", source: "case-019 · p. 91", type: "Growth", industry: "Auto", difficulty: "Hard", rating: "4.6", status: "Marked" },
  { id: "5", title: "Quick-Commerce Unit Economics", casebook: "IIM C", source: "case-003 · p. 34", type: "Profitability", industry: "E-commerce", difficulty: "Easy", rating: "4.7", status: "Done" },
  { id: "6", title: "Bank Digital Transformation", casebook: "IIM A", source: "case-022 · p. 118", type: "Operations", industry: "BFSI", difficulty: "Medium", rating: "4.1", status: "Not started" },
];

const thClasses =
  "border-b border-[var(--line)] px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] first:pl-4 last:pr-4";
const tdClasses =
  "border-b border-[var(--line-soft)] px-3 py-2.5 text-[13px] first:pl-4 last:pr-4";

function StatusPill({ status }: { status: CaseStatus }) {
  return status === "Done" ? (
    <Pill tone="accent">Done</Pill>
  ) : status === "Marked" ? (
    <Pill tone="amber">Marked</Pill>
  ) : (
    <Pill className="text-[var(--muted)]">Not started</Pill>
  );
}

export default function CasesPage() {
  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[40px] text-[var(--ink)]">Case library</h1>
          <p className="mt-1 text-[14px] text-[var(--muted)]">
            {placeholderCases.length} cases · placeholder data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            disabled
            aria-label="Search cases"
            placeholder="Search case, company, casebook…"
            className="h-[38px] w-[290px] max-w-full rounded-full border border-[var(--line)] bg-[var(--card)] px-[13px] text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            disabled
            className="h-[38px] whitespace-nowrap rounded-full border border-[var(--line)] bg-[var(--card)] px-[15px] text-[13.5px] font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mb-[18px] flex flex-col gap-[11px] rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-[18px] py-4 [box-shadow:var(--sh)]">
        {filterGroups.map((group) => (
          <div
            key={group.label}
            className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[96px_1fr] sm:gap-3.5"
          >
            <div className="text-[11.5px] font-semibold text-[var(--muted)]">
              {group.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.options.map((option, i) => (
                <button
                  key={option}
                  type="button"
                  disabled
                  className={`rounded-full px-[11px] py-1 text-[12px] font-semibold disabled:cursor-not-allowed ${
                    i === 0 && group.label === "Rating"
                      ? "bg-[var(--accent)] text-[var(--on-accent)]"
                      : "border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] [box-shadow:var(--sh)] md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--thead)]">
              <th className={`${thClasses} w-[34%]`}>Case</th>
              <th className={thClasses}>Casebook</th>
              <th className={thClasses}>Type</th>
              <th className={thClasses}>Difficulty</th>
              <th className={thClasses}>Rating</th>
              <th className={thClasses}>Status</th>
            </tr>
          </thead>
          <tbody>
            {placeholderCases.map((c) => (
              <tr
                key={c.id}
                className="relative transition-colors hover:bg-[var(--thead)]"
              >
                <td className={tdClasses}>
                  <Link
                    href={`/cases/${c.id}`}
                    className="after:absolute after:inset-0"
                  >
                    <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[var(--ink)]">
                      {c.title}
                    </span>
                    <span className="block font-[family-name:var(--font-mono)] text-[12px] text-[var(--muted)]">
                      {c.casebook.toLowerCase().replace(/ /g, "-")} · {c.source}
                    </span>
                  </Link>
                </td>
                <td className={`${tdClasses} text-[var(--muted)]`}>{c.casebook}</td>
                <td className={tdClasses}>{c.type}</td>
                <td className={tdClasses}>{c.difficulty}</td>
                <td className={`${tdClasses} font-semibold text-[var(--amber)]`}>
                  ★ {c.rating}
                </td>
                <td className={tdClasses}>
                  <StatusPill status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {placeholderCases.map((c) => (
          <Link
            key={c.id}
            href={`/cases/${c.id}`}
            className="block rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] p-4 [box-shadow:var(--sh)]"
          >
            <div className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[var(--ink)]">
              {c.title}
            </div>
            <div className="mt-0.5 font-[family-name:var(--font-mono)] text-[12px] text-[var(--muted)]">
              {c.casebook.toLowerCase().replace(/ /g, "-")} · {c.source}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Pill tone="accent">{c.type}</Pill>
              <Pill>{c.industry}</Pill>
              <Pill>{c.difficulty}</Pill>
              <Pill tone="amber">★ {c.rating}</Pill>
              <StatusPill status={c.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
