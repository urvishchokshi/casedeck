"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  buildCasesSearchString,
  countActiveFilters,
  type CaseFilterState,
  type FilterOption,
  type StatusFilter,
} from "@/lib/case-filters";

export type FilterParam =
  | "type"
  | "difficulty"
  | "industry"
  | "company"
  | "casebook";

const stateKeyByParam = {
  type: "types",
  difficulty: "difficulties",
  industry: "industries",
  company: "companies",
  casebook: "casebooks",
} as const;

export interface ChipGroup {
  label: string;
  param: FilterParam;
  options: FilterOption[];
  selected: string[];
}

function navigate(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  next: CaseFilterState
) {
  router.replace(pathname + buildCasesSearchString(next), { scroll: false });
}

const chipBase = "rounded-full px-[11px] py-1 text-[12px] font-semibold";
const chipSelected = `${chipBase} bg-[var(--accent)] text-[var(--on-accent)]`;
const chipUnselected = `${chipBase} border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] transition-colors hover:bg-[var(--thead)]`;

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={selected ? chipSelected : chipUnselected}
    >
      {children}
    </button>
  );
}

export function CaseSearchControls({ filters }: { filters: CaseFilterState }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The debounced push reads the latest props through this ref, so a chip
  // toggled in the sibling component during the 300ms window isn't undone.
  // Updated in an effect (post-commit) — always ahead of the ≥300ms timer.
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  // Tracks the last q this component pushed, so the resync effect below only
  // overwrites the input on external changes (back/forward, shared URL).
  const lastPushed = useRef(filters.q);

  useEffect(() => {
    if (filters.q !== lastPushed.current) {
      // External q change: the pending push (if any) predates it — drop it.
      clearTimeout(timer.current);
      lastPushed.current = filters.q;
      setValue(filters.q);
    }
  }, [filters.q]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const hasActiveFilters = countActiveFilters(filters) > 0;

  return (
    <div className="flex items-center gap-2">
      <input
        type="search"
        aria-label="Search cases"
        placeholder="Search case or company…"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            const q = v.trim().slice(0, 100);
            lastPushed.current = q;
            navigate(router, pathname, { ...filtersRef.current, q });
          }, 300);
        }}
        className="h-[38px] w-[290px] max-w-full rounded-full border border-[var(--line)] bg-[var(--card)] px-[13px] text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)]"
      />
      <button
        type="button"
        disabled={!hasActiveFilters}
        onClick={() => {
          clearTimeout(timer.current);
          lastPushed.current = "";
          setValue("");
          router.replace(pathname, { scroll: false });
        }}
        className="h-[38px] whitespace-nowrap rounded-full border border-[var(--line)] bg-[var(--card)] px-[15px] text-[13.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--thead)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[var(--card)]"
      >
        Reset
      </button>
    </div>
  );
}

const rowClasses =
  "grid grid-cols-1 items-center gap-2 sm:grid-cols-[96px_1fr] sm:gap-3.5";
const labelClasses = "text-[11.5px] font-semibold text-[var(--muted)]";

const ratingOptions: { label: string; value: 3 | 4 | null }[] = [
  { label: "4★ & up", value: 4 },
  { label: "3★ & up", value: 3 },
  { label: "Any", value: null },
];

// One visual Status group over two URL params: status (single-select
// done|not_done) and marked (flag). Selected chips OR together server-side.
const statusOptions: { label: string; value: StatusFilter }[] = [
  { label: "Not done", value: "not_done" },
  { label: "Done", value: "done" },
];

export function CaseFilterGroups({
  groups,
  filters,
}: {
  groups: ChipGroup[];
  filters: CaseFilterState;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const toggle = (param: FilterParam, value: string) => {
    const key = stateKeyByParam[param];
    const current = filters[key] as string[];
    const nextValues = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    navigate(router, pathname, { ...filters, [key]: nextValues });
  };

  return (
    <>
      {groups.map((group) => (
        <div key={group.param} className={rowClasses}>
          <div className={labelClasses}>{group.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((option) => (
              <FilterChip
                key={option.value}
                selected={group.selected.includes(option.value)}
                onClick={() => toggle(group.param, option.value)}
              >
                {option.label}
              </FilterChip>
            ))}
          </div>
        </div>
      ))}
      <div className={rowClasses}>
        <div className={labelClasses}>Rating</div>
        <div className="flex flex-wrap gap-1.5">
          {ratingOptions.map((option) => (
            <FilterChip
              key={option.label}
              selected={filters.rating === option.value}
              onClick={() =>
                navigate(router, pathname, { ...filters, rating: option.value })
              }
            >
              {option.label}
            </FilterChip>
          ))}
        </div>
      </div>
      <div className={rowClasses}>
        <div className={labelClasses}>Status</div>
        <div className="flex flex-wrap gap-1.5">
          {statusOptions.map((option) => (
            <FilterChip
              key={option.value}
              selected={filters.status === option.value}
              onClick={() =>
                navigate(router, pathname, {
                  ...filters,
                  status: filters.status === option.value ? null : option.value,
                })
              }
            >
              {option.label}
            </FilterChip>
          ))}
          <FilterChip
            selected={filters.marked}
            onClick={() =>
              navigate(router, pathname, { ...filters, marked: !filters.marked })
            }
          >
            Marked for later
          </FilterChip>
        </div>
      </div>
    </>
  );
}
