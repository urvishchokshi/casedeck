export function ImageCard({
  signedUrl,
  alt,
}: {
  signedUrl: string | undefined;
  alt: string;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] [box-shadow:var(--sh)]">
      {signedUrl ? (
        <a href={signedUrl} target="_blank" rel="noopener noreferrer">
          {/* Full-page 2x renders from the private bucket; plain img keeps them unresized and sharp. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signedUrl} alt={alt} className="block h-auto w-full" />
        </a>
      ) : (
        <div className="grid h-48 place-items-center [background:var(--ph)]">
          <span className="text-[12px] font-semibold text-[var(--muted)]">
            Image unavailable
          </span>
        </div>
      )}
    </div>
  );
}
