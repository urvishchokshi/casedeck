import { Skeleton } from "@/components/ui/Skeleton";

export default function MatchLoading() {
  return (
    <>
      <div className="flex justify-center pb-1 pt-[18px]">
        <Skeleton className="h-12 w-80 max-w-full" />
      </div>

      <Skeleton className="h-[76px] w-full rounded-[20px]" />

      <div className="flex flex-col rounded-[20px] bg-[var(--card)] p-1.5 [box-shadow:var(--sh)]">
        <div className="flex justify-center px-4 pb-4 pt-[18px]">
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-4 px-3 pb-4 max-desk:grid-cols-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-[18px] rounded-[var(--r)] border border-[var(--line-card)] bg-[var(--card)] p-[22px] [box-shadow:var(--sh)]"
            >
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-6 w-20 rounded-[9px]" />
              </div>
              <div className="flex flex-col gap-2.5 border-t border-[var(--line-inner)] pt-3.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <Skeleton className="h-[38px] w-full rounded-[var(--rs)]" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
