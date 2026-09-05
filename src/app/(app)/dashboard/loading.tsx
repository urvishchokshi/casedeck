import { Skeleton } from "@/components/ui/Skeleton";

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-[22px] py-5 [box-shadow:var(--sh)]">
      {children}
    </div>
  );
}

function BarRows() {
  return (
    <div className="mt-4 flex flex-col gap-3.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5">
          <Skeleton className="h-3 w-24 flex-none" />
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-3 w-8 flex-none" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <>
      <div className="flex justify-center pb-1 pt-[18px]">
        <Skeleton className="h-12 w-72 max-w-full" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-3 w-28" />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardShell key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-11 w-16" />
            <Skeleton className="mt-2 h-3 w-14" />
          </CardShell>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-3.5 max-desk:grid-cols-1">
        <CardShell>
          <Skeleton className="h-5 w-32" />
          <BarRows />
        </CardShell>
        <CardShell>
          <Skeleton className="h-5 w-44" />
          <BarRows />
        </CardShell>
      </div>

      <CardShell>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-4 h-[62px] w-full rounded-[14px]" />
      </CardShell>
    </>
  );
}
