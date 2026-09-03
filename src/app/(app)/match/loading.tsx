import { Skeleton } from "@/components/ui/Skeleton";

export default function MatchLoading() {
  return (
    <div>
      <div className="mb-[22px]">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <Skeleton className="h-20 w-full rounded-[var(--r)]" />

      <div className="mt-[18px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3.5 rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] p-[18px] [box-shadow:var(--sh)]"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-1.5 h-3 w-20" />
              </div>
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
