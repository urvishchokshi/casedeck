"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  buildCasesSearchString,
  countDisplayFilters,
  type CaseFilterState,
  type FilterOption,
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

export interface FilterGroup {
  label: string;
  param: FilterParam;
  options: FilterOption[];
  selected: string[];
}

/** Dimensions with more options than this get a search input in their popover. */
const SEARCHABLE_THRESHOLD = 8;

const ratingOptions: { label: string; value: 3 | 4 | null }[] = [
  { label: "Any", value: null },
  { label: "3★ & up", value: 3 },
  { label: "4★ & up", value: 4 },
];

// The segmented control is single-select over the status param.
type StatusSegment = "all" | "not_done" | "done" | "revisit";

const statusSegments: { label: string; value: StatusSegment }[] = [
  { label: "All", value: "all" },
  { label: "Not done", value: "not_done" },
  { label: "Done", value: "done" },
  { label: "Revisit", value: "revisit" },
];

const segmentState: Record<StatusSegment, Pick<CaseFilterState, "status">> = {
  all: { status: null },
  not_done: { status: "not_done" },
  done: { status: "done" },
  revisit: { status: "revisit" },
};

export function CaseFilterBar({
  groups,
  filters,
  resultCount,
}: {
  groups: FilterGroup[];
  filters: CaseFilterState;
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(filters.q);
  const [openDropdown, setOpenDropdown] = useState<FilterParam | "rating" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The debounced push reads the latest props through this ref, so it never
  // resurrects state a faster interaction already replaced. Updated in an
  // effect (post-commit) — always ahead of the ≥300ms timer.
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
      setSearchValue(filters.q);
    }
  }, [filters.q]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Every non-search interaction navigates through here, folding the current
  // input value in so a pending debounced search is never lost or reordered.
  // The merged state is written back to filtersRef eagerly, so a second click
  // landing before the server round-trip builds on this one instead of the
  // last committed props (the ref sync effect above only fires on a new
  // server payload — state-only re-renders keep the same props object).
  const push = (next: Partial<CaseFilterState>) => {
    clearTimeout(timer.current);
    const q = searchValue.trim().slice(0, 100);
    lastPushed.current = q;
    const merged = { ...filtersRef.current, q, ...next };
    filtersRef.current = merged;
    router.replace(pathname + buildCasesSearchString(merged), { scroll: false });
  };

  const clearAll = () => {
    clearTimeout(timer.current);
    lastPushed.current = "";
    setSearchValue("");
    setOpenDropdown(null);
    router.replace(pathname, { scroll: false });
  };

  const toggleValue = (param: FilterParam, value: string) => {
    const key = stateKeyByParam[param];
    // Read through the ref, not props: rapid consecutive toggles must build
    // on each other, not on the last committed server render.
    const current = filtersRef.current[key] as string[];
    const nextValues = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    push({ [key]: nextValues });
  };

  const segment: StatusSegment = filters.status ?? "all";
  const displayCount = countDisplayFilters(filters);

  return (
    <>
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            type="search"
            aria-label="Search cases"
            placeholder="Search a case or company…"
            value={searchValue}
            onChange={(e) => {
              const v = e.target.value;
              setSearchValue(v);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => {
                const q = v.trim().slice(0, 100);
                lastPushed.current = q;
                router.replace(
                  pathname + buildCasesSearchString({ ...filtersRef.current, q }),
                  { scroll: false }
                );
              }, 300);
            }}
            className="h-[38px] w-full rounded-full border border-[var(--line)] bg-[var(--card)] pl-9 pr-[13px] text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)]"
          />
        </div>
        <div
          role="group"
          aria-label="Status"
          className="inline-flex shrink-0 self-start rounded-full border border-[var(--line)] bg-[var(--chip)] p-[3px] md:self-auto"
        >
          {statusSegments.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={segment === s.value}
              onClick={() => push(segmentState[s.value])}
              className={`h-[30px] whitespace-nowrap rounded-full px-3 text-[12.5px] font-semibold transition-colors ${
                segment === s.value
                  ? "bg-[var(--card)] text-[var(--ink)] [box-shadow:var(--sh)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {groups.map((group) => (
          <FilterDropdown
            key={group.param}
            label={group.label}
            open={openDropdown === group.param}
            onOpenChange={(open) => setOpenDropdown(open ? group.param : null)}
            kind="multi"
            options={group.options}
            selected={group.selected}
            onToggle={(value) => toggleValue(group.param, value)}
          />
        ))}
        <FilterDropdown
          label="Rating"
          open={openDropdown === "rating"}
          onOpenChange={(open) => setOpenDropdown(open ? "rating" : null)}
          kind="rating"
          rating={filters.rating}
          onSelect={(rating) => push({ rating })}
        />
        <span className="ml-auto whitespace-nowrap font-[family-name:var(--font-mono)] text-[12px] text-[var(--muted)]">
          {displayCount > 0 &&
            `${displayCount} ${displayCount === 1 ? "filter" : "filters"} · `}
          {`${resultCount} ${resultCount === 1 ? "result" : "results"}`}
        </span>
      </div>

      {displayCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--line-soft)] pt-[11px]">
          <ActivePills groups={groups} filters={filters} push={push} />
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 text-[12.5px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            Clear all
          </button>
        </div>
      )}
    </>
  );
}

type FilterDropdownProps = {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & (
  | {
      kind: "multi";
      options: FilterOption[];
      selected: string[];
      onToggle: (value: string) => void;
    }
  | {
      kind: "rating";
      rating: 3 | 4 | null;
      onSelect: (rating: 3 | 4 | null) => void;
    }
);

function FilterDropdown(props: FilterDropdownProps) {
  const { label, open, onOpenChange } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [optionQuery, setOptionQuery] = useState("");
  // Options snapshotted at open (order and entries) so immediate-apply
  // toggles neither re-sort the list under the cursor nor drop a
  // stale-URL value's row when it's unchecked; re-derived on next open.
  const [snapshot, setSnapshot] = useState<FilterOption[]>([]);
  const [wasOpen, setWasOpen] = useState(false);

  const searchable = props.kind === "multi" && props.options.length > SEARCHABLE_THRESHOLD;
  const selectedCount =
    props.kind === "multi" ? props.selected.length : props.rating !== null ? 1 : 0;

  // Derived-state-during-render on the open transition: the very first
  // committed frame of the panel already has its rows, so the focus effect
  // below finds option 0 and no "No matches" flash can paint.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOptionQuery("");
      if (props.kind === "multi") {
        const { options, selected } = props;
        setSnapshot(
          [...options].sort(
            (a, b) =>
              Number(selected.includes(b.value)) - Number(selected.includes(a.value))
          )
        );
      }
    }
  }

  useEffect(() => {
    if (!open) return;
    // Focus the popover search when present, else the first option.
    const target = searchable ? searchRef.current : optionRefs.current[0];
    target?.focus();
    // Runs once per open; `searchable` can't change while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc in a non-empty popover search clears it first (matching the
      // native type="search" behavior cross-browser); second Esc closes.
      if (
        searchRef.current &&
        document.activeElement === searchRef.current &&
        searchRef.current.value !== ""
      ) {
        setOptionQuery("");
        return;
      }
      onOpenChange(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  const visibleOptions: FilterOption[] =
    props.kind === "rating"
      ? []
      : snapshot.filter((o) =>
          o.label.toLowerCase().includes(optionQuery.trim().toLowerCase())
        );

  const rowCount = props.kind === "rating" ? ratingOptions.length : visibleOptions.length;
  optionRefs.current.length = rowCount;

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      // Tab exits. Focus the trigger before the close unmounts the panel
      // (which would drop focus to <body>), so the browser's default Tab
      // proceeds deterministically from the trigger to its neighbor.
      triggerRef.current?.focus();
      onOpenChange(false);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const active = document.activeElement;
    const index = optionRefs.current.findIndex((el) => el === active);
    if (e.key === "ArrowDown") {
      const next = index === -1 ? 0 : Math.min(index + 1, rowCount - 1);
      optionRefs.current[next]?.focus();
    } else if (index === 0 && searchable) {
      searchRef.current?.focus();
    } else if (index > 0) {
      optionRefs.current[index - 1]?.focus();
    }
  };

  const close = (restoreFocus: boolean) => {
    onOpenChange(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const optionRowClasses =
    "flex w-full items-center gap-2.5 rounded-[var(--rs)] px-2.5 py-[7px] text-left text-[13px] text-[var(--ink)] transition-colors hover:bg-[var(--thead)]";

  return (
    <div ref={containerRef} className="relative max-md:contents">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            onOpenChange(true);
          } else if (e.key === "Tab" && open) {
            // Tabbing off the trigger while its popover is open: close it and
            // let focus move on naturally.
            onOpenChange(false);
          }
        }}
        className={`inline-flex h-[34px] items-center gap-1.5 rounded-full border px-[13px] text-[13px] font-semibold transition-colors ${
          selectedCount > 0
            ? "border-[var(--accent)] bg-[var(--accent-50)] text-[var(--accent)]"
            : "border-[var(--line)] bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--thead)]"
        }`}
      >
        {label}
        {selectedCount > 0 && (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 text-[10.5px] font-bold leading-none text-[var(--on-accent)]">
            {selectedCount}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          onKeyDown={onPanelKeyDown}
          className="absolute left-0 top-[calc(100%+6px)] z-30 flex max-h-[320px] w-[280px] flex-col rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] p-1.5 [box-shadow:var(--sh-modal)] max-md:static max-md:order-last max-md:w-full"
        >
          {searchable && (
            <input
              ref={searchRef}
              type="search"
              aria-label={`Filter ${label} options`}
              placeholder="Search…"
              value={optionQuery}
              onChange={(e) => setOptionQuery(e.target.value)}
              className="mb-1 h-8 w-full shrink-0 rounded-[var(--rs)] border border-[var(--line)] bg-[var(--card)] px-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)]"
            />
          )}
          <div
            role="listbox"
            aria-label={label}
            aria-multiselectable={props.kind === "multi" || undefined}
            className="flex min-h-0 flex-col overflow-y-auto"
          >
            {props.kind === "rating"
              ? ratingOptions.map((option, i) => {
                  const isSelected = props.rating === option.value;
                  return (
                    <button
                      key={option.label}
                      ref={(el) => {
                        optionRefs.current[i] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={-1}
                      onClick={() => {
                        props.onSelect(option.value);
                        close(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                          props.onSelect(option.value);
                          close(true);
                        }
                      }}
                      className={optionRowClasses}
                    >
                      <span
                        aria-hidden
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                          isSelected
                            ? "border-[var(--accent)] bg-[var(--accent)]"
                            : "border-[var(--line)] bg-[var(--card)]"
                        }`}
                      >
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--on-accent)]" />
                        )}
                      </span>
                      {option.label}
                    </button>
                  );
                })
              : visibleOptions.map((option, i) => {
                  const isSelected = props.selected.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      ref={(el) => {
                        optionRefs.current[i] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={-1}
                      onClick={() => props.onToggle(option.value)}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                          props.onToggle(option.value);
                        }
                      }}
                      className={optionRowClasses}
                    >
                      <span
                        aria-hidden
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-[calc(var(--rs)/2)] border ${
                          isSelected
                            ? "border-[var(--accent)] bg-[var(--accent)]"
                            : "border-[var(--line)] bg-[var(--card)]"
                        }`}
                      >
                        {isSelected && (
                          <Check size={11} className="text-[var(--on-accent)]" />
                        )}
                      </span>
                      {option.label}
                    </button>
                  );
                })}
            {props.kind === "multi" && visibleOptions.length === 0 && (
              <p className="px-2.5 py-2 text-[13px] text-[var(--muted)]">
                No matches
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivePills({
  groups,
  filters,
  push,
}: {
  groups: FilterGroup[];
  filters: CaseFilterState;
  push: (next: Partial<CaseFilterState>) => void;
}) {
  const pills: { key: string; dim: string; value: string; remove: () => void }[] = [];

  for (const group of groups) {
    for (const value of group.selected) {
      pills.push({
        key: `${group.param}:${value}`,
        dim: group.label,
        value: group.options.find((o) => o.value === value)?.label ?? value,
        remove: () =>
          push({
            [stateKeyByParam[group.param]]: group.selected.filter((v) => v !== value),
          }),
      });
    }
  }

  if (filters.rating !== null) {
    pills.push({
      key: "rating",
      dim: "Rating",
      value: `${filters.rating}★ & up`,
      remove: () => push({ rating: null }),
    });
  }

  return (
    <>
      {pills.map((pill) => (
        <button
          key={pill.key}
          type="button"
          aria-label={`Remove ${pill.dim} filter ${pill.value}`}
          onClick={pill.remove}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-200)] bg-[var(--accent-50)] py-[3px] pl-2.5 pr-[7px] text-[12px] transition-colors hover:border-[var(--accent)]"
        >
          <span className="text-[var(--muted)]">{pill.dim}</span>
          <span className="font-semibold text-[var(--ink)]">{pill.value}</span>
          <X size={12} className="text-[var(--muted)]" />
        </button>
      ))}
    </>
  );
}
