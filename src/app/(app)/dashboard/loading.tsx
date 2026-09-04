import { Skeleton } from "@/components/ui/Skeleton";

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] p-[18px] [box-shadow:var(--sh)]">
      {children}
    </div>
  );
}

function BarRows() {
  return (
    <div className="mt-4 flex flex-col gap-3.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[112px_1fr_auto] items-center gap-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-[9px] rounded-full" />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-[22px]">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-[18px] py-4 [box-shadow:var(--sh)]"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-10 w-16" />
          </div>
        ))}
      </div>

      <div className="mt-[18px] grid grid-cols-1 gap-[18px] xl:grid-cols-2">
        <CardShell>
          <Skeleton className="h-6 w-36" />
          <BarRows />
        </CardShell>
        <CardShell>
          <Skeleton className="h-6 w-48" />
          <BarRows />
        </CardShell>
      </div>

      <div className="mt-[18px]">
        <CardShell>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-4 h-12 w-full" />
        </CardShell>
      </div>
    </div>
  );
}
