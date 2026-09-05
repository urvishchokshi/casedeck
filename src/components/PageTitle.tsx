/**
 * Centered page heading in the design's split-color style:
 * `<plain><accent-blue>` — e.g. "Case " + "Library", "Frame" + "works".
 */
export function PageTitle({
  plain,
  accent,
}: {
  plain: string;
  accent: string;
}) {
  return (
    <div className="pb-1 pt-[18px] text-center">
      <h1 className="text-[clamp(30px,7vw,52px)] leading-[1.04] tracking-[-0.03em]">
        {plain}
        <span className="text-[var(--accent)]">{accent}</span>
      </h1>
    </div>
  );
}
