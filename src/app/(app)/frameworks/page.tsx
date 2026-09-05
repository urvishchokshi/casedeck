import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
import { PageTitle } from "@/components/PageTitle";

export const metadata: Metadata = {
  title: "Frameworks",
};

export default function FrameworksPage() {
  return (
    // Matches the shell <main>'s flex column (incl. flex-1 — ComingSoon
    // centers itself in the leftover height) so the wrapper is layout-neutral.
    <div className="cd-fade-up flex flex-1 flex-col gap-4">
      <PageTitle plain="Frame" accent="works" />
      <ComingSoon
        heading="A library of reusable structures"
        blurb="Profitability trees, market-entry structures and pricing frameworks — with worked examples you can pull straight into a live case."
        icon={
          <svg width="34" height="34" viewBox="0 0 20 20" fill="none">
            <rect x="2.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
            <rect x="11.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
            <rect x="2.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
            <rect x="11.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        }
      />
    </div>
  );
}
