import { Skeleton } from "@/components/ui/Skeleton";

export default function CaseDetailLoading() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-32 rounded-[var(--rs)]" />
        <div className="flex gap-2">
          <Skeleton className="h-[38px] w-28 rounded-[11px]" />
          <Skeleton className="h-[38px] w-28 rounded-[11px]" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 pt-1.5">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-12 w-[min(480px,90%)]" />
        <div className="flex flex-wrap justify-center gap-[7px]">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-[9px]" />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-[22px] [box-shadow:var(--sh)]">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-4 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-2/3" />
        </div>

        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-8 w-20 rounded-[9px]" />
          </div>
          <div className="flex flex-col gap-1.5 rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-[22px] py-5 [box-shadow:var(--sh)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-[14px]" />
            ))}
          </div>
        </div>

        <Skeleton className="h-64 w-full rounded-[var(--r)]" />
      </div>
    </>
  );
}
