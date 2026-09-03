import { Skeleton } from "@/components/ui/Skeleton";

export default function CaseDetailLoading() {
  return (
    <div className="mx-auto max-w-[820px]">
      <Skeleton className="h-4 w-28" />

      <div className="mb-[22px] mt-5 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="mt-3 h-11 w-3/4" />
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16 rounded-full" />
            ))}
          </div>
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="flex flex-col gap-[22px]">
        <div className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-[22px] [box-shadow:var(--sh)]">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-4 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-2/3" />
        </div>

        <div>
          <Skeleton className="h-8 w-40" />
          <div className="mt-3.5 flex flex-col gap-3.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-[var(--r)]" />
            ))}
          </div>
        </div>

        <Skeleton className="h-64 w-full rounded-[var(--r)]" />
      </div>
    </div>
  );
}
