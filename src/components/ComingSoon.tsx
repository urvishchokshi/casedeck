import Link from "next/link";

/**
 * Centered "Coming soon" card used by /frameworks and /guesstimates —
 * pulsing chip, icon tile, blurb, and an escape hatch back to the library.
 */
export function ComingSoon({
  icon,
  heading,
  blurb,
}: {
  icon: React.ReactNode;
  heading: string;
  blurb: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center pb-12 pt-7">
      <div className="relative w-full max-w-[620px] overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--card)] px-10 pb-10 pt-11 text-center [box-shadow:var(--sh-soon)] max-desk:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-120px] h-[340px] w-[340px] -translate-x-1/2 rounded-full [background:var(--soon-glow)]"
        />

        <div className="relative inline-flex h-7 items-center gap-2 rounded-[9px] bg-[var(--accent-tint)] px-3 text-[11.5px] font-bold tracking-[0.06em] text-[var(--accent)]">
          <span
            aria-hidden
            className="cd-pulse h-[6px] w-[6px] rounded-full bg-[var(--accent)]"
          />
          COMING SOON
        </div>

        <div className="relative mx-auto mt-[26px] flex h-[78px] w-[78px] items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--thead)] text-[var(--accent)]">
          {icon}
        </div>

        <h2 className="relative mt-[22px] text-[26px] tracking-[-0.02em]">
          {heading}
        </h2>
        <p className="relative mx-auto mt-2.5 max-w-[420px] text-[14px] leading-[1.55] text-[var(--muted)] [text-wrap:pretty]">
          {blurb}
        </p>

        <div className="relative mt-[26px] flex flex-wrap justify-center gap-2.5">
          <Link
            href="/cases"
            className="flex h-[42px] items-center whitespace-nowrap rounded-[11px] border border-[var(--line-ctl)] bg-[var(--card)] px-5 text-[13px] font-semibold text-[var(--slate)] transition-colors hover:border-[var(--line-hover)]"
          >
            Browse cases instead
          </Link>
        </div>
      </div>
    </div>
  );
}
