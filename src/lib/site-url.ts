/**
 * Canonical site origin for redirects and metadata.
 *
 * Precedence: NEXT_PUBLIC_SITE_URL (set in Vercel for production) → the
 * actual request origin when the caller has one → VERCEL_URL (preview
 * deploys) → localhost for local dev.
 */
export function siteOrigin(requestOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) {
    // Normalize via URL so a malformed value falls through to the next
    // source instead of blowing up redirect/metadata construction.
    try {
      return new URL(configured).origin;
    } catch {
      console.error(`Invalid NEXT_PUBLIC_SITE_URL "${configured}" — ignoring`);
    }
  }
  if (requestOrigin) return requestOrigin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
