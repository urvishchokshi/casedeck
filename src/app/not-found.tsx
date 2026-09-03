import Link from "next/link";
import { Brand } from "@/components/Brand";
import { buttonBaseClasses, buttonVariantClasses } from "@/components/ui/Button";

// Root-level so it catches unmatched URLs and notFound() calls; renders
// without the (app) shell, so it carries its own Brand + canvas background.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 bg-[var(--canvas)] px-6">
      <Brand />
      <div className="text-center">
        <h1 className="text-[44px]">Page not found</h1>
        <p className="mt-2 max-w-[380px] text-[14px] text-[var(--muted)]">
          That page doesn&apos;t exist — it may have been moved, or the link is
          stale.
        </p>
      </div>
      <Link
        href="/cases"
        className={`${buttonBaseClasses} ${buttonVariantClasses.primary}`}
      >
        Back to the library
      </Link>
    </div>
  );
}
