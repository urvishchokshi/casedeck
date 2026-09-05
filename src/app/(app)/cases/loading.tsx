import { Skeleton } from "@/components/ui/Skeleton";

export default function CasesLoading() {
  return (
    <>
      <div className="flex justify-center pb-1 pt-[18px]">
        <Skeleton className="h-12 w-72 max-w-full" />
      </div>

      <div className="flex justify-center">
        <Skeleton className="h-[46px] w-[340px] max-w-full rounded-[14px]" />
      </div>

      <div className="flex flex-col rounded-[20px] bg-[var(--card)] p-1.5 [box-shadow:var(--sh)]">
        <div className="flex flex-col items-center gap-3 px-4 pb-3.5 pt-4">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-[38px] w-full max-w-[420px]" />
          <div className="flex flex-wrap justify-center gap-[7px]">
            {["w-[64px]", "w-[84px]", "w-[88px]", "w-[86px]", "w-[90px]", "w-[72px]"].map(
              (w, i) => (
                <Skeleton key={i} className={`h-8 ${w} rounded-[9px]`} />
              )
            )}
          </div>
        </div>

        <div className="hidden desk:block">
          <div className="mx-0 h-10 rounded-[11px] bg-[var(--thead)]" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-[var(--line-row)] px-4 py-[13px]"
            >
              <Skeleton className="h-5 w-[26%]" />
              <Skeleton className="h-4 w-[12%]" />
              <Skeleton className="h-4 w-[12%]" />
              <Skeleton className="h-4 w-[12%]" />
              <Skeleton className="h-4 w-[10%]" />
              <Skeleton className="h-4 w-[6%]" />
              <Skeleton className="ml-auto h-6 w-[8%] rounded-[9px]" />
            </div>
          ))}
        </div>

        <div className="flex flex-col desk:hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border-b border-[var(--line-row)] px-4 py-[13px]"
            >
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-3 w-32" />
              <Skeleton className="mt-2 h-3 w-48" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 py-3.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[34px] w-24 rounded-[var(--rs)]" />
        </div>
      </div>
    </>
  );
}
