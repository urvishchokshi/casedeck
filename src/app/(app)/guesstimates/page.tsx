import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
import { PageTitle } from "@/components/PageTitle";

export const metadata: Metadata = {
  title: "Guesstimates",
};

export default function GuesstimatesPage() {
  return (
    // Matches the shell <main>'s flex column (incl. flex-1 — ComingSoon
    // centers itself in the leftover height) so the wrapper is layout-neutral.
    <div className="cd-fade-up flex flex-1 flex-col gap-4">
      <PageTitle plain="Guess" accent="timates" />
      <ComingSoon
        heading="Market sizing, one estimate at a time"
        blurb="Timed guesstimate drills with the assumptions laid bare — so you can check your logic, not just your final number."
        icon={
          <svg width="34" height="34" viewBox="0 0 20 20" fill="none">
            <rect x="3.5" y="2.5" width="13" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M6.5 6.5h7M7 10h.01M10 10h.01M13 10h.01M7 13.5h.01M10 13.5h.01M13 13.5h.01"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        }
      />
    </div>
  );
}
