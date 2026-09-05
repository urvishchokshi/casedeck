interface BrandProps {
  /** Width of the logo mark in px; height and crop offsets scale with it. */
  markWidth?: number;
  /** Tailwind classes for the wordmark text (size/weight). */
  wordmarkClassName?: string;
  /** Render only the mark (collapsed sidebar). */
  markOnly?: boolean;
}

/**
 * CaseDeck lockup: the logo asset (public/logo.png, a square image whose mark
 * sits in a sub-region) shown through a crop window — same technique as the
 * design mockups — plus the two-tone wordmark.
 */
export function Brand({
  markWidth = 30,
  wordmarkClassName = "text-[16px] font-bold tracking-[-0.02em]",
  markOnly = false,
}: BrandProps) {
  // Crop constants from the design: a 30×26 window over the image scaled to
  // 128px, offset (-10, -51). Everything scales linearly with markWidth.
  const s = markWidth / 30;
  return (
    <span className="flex items-center gap-[9px]">
      <span
        aria-hidden
        className="relative shrink-0 overflow-hidden"
        style={{ width: markWidth, height: 26 * s }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative crop; next/image buys nothing */}
        <img
          src="/logo.png"
          alt=""
          className="absolute max-w-none object-cover"
          style={{
            width: 128 * s,
            height: 128 * s,
            left: -10 * s,
            top: -51 * s,
          }}
        />
      </span>
      {!markOnly && (
        <span
          className={`whitespace-nowrap text-[var(--heading)] ${wordmarkClassName}`}
        >
          Case<span className="text-[var(--accent)]">Deck</span>
        </span>
      )}
    </span>
  );
}
