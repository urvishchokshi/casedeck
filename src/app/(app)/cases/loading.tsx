import { Skeleton } from "@/components/ui/Skeleton";

export default function CasesLoading() {
  return (
    <div>
      <div className="mb-[22px]">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>

      <div className="mb-[18px] flex flex-col gap-[11px] rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-[18px] py-4 [box-shadow:var(--sh)]">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-3">
          <Skeleton className="h-[38px] flex-1 rounded-full" />
          <Skeleton className="h-9 w-[264px] max-w-full rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {["w-[72px]", "w-[92px]", "w-[96px]", "w-[94px]", "w-[98px]", "w-[80px]"].map(
            (w, i) => (
              <Skeleton key={i} className={`h-[34px] ${w} rounded-full`} />
            )
          )}
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] [box-shadow:var(--sh)] md:block">
        <div className="h-9 border-b border-[var(--line)] bg-[var(--thead)]" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-[var(--line-soft)] px-4 py-2.5 last:border-b-0"
          >
            <Skeleton className="h-5 w-[30%]" />
            <Skeleton className="h-5 w-[14%]" />
            <Skeleton className="h-5 w-[10%]" />
            <Skeleton className="h-5 w-[12%]" />
            <Skeleton className="h-5 w-[12%] rounded-full" />
            <Skeleton className="h-5 w-[8%] rounded-full" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] p-[18px] [box-shadow:var(--sh)]"
          >
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-2 h-3 w-24" />
            <div className="mt-3 flex gap-1.5">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
