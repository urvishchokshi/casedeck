import "server-only";

/**
 * Origin resolution for auth redirects and metadata.
 *
 * The problem this module fixes: behind Vercel's proxy the Node server is hit
 * on an internal socket, so `new URL(request.url).origin` inside a Route
 * Handler or the proxy can be `http://localhost:3000` — NOT the host the
 * browser is on. Building a redirect from it sends users to localhost after
 * login. The host the user actually reached travels in `x-forwarded-host`
 * (which Vercel sets and overwrites), so that header outranks everything.
 *
 * Two exports because redirects and metadata want different answers:
 * - `requestOrigin(request)` — strictly the host the browser is talking to;
 *   never consults configuration. For the proxy: a redirect built on a
 *   *configured* host could differ from the browser's host and strand the
 *   session cookies copied onto the redirect.
 * - `siteOrigin(request?)` — the same, with configured fallbacks for when the
 *   request can't say. For the auth callback and (argless) `metadataBase`.
 *
 * Trust: Vercel overwrites `x-forwarded-*`, so they can't be spoofed there.
 * Browsers never send them, so elsewhere an attacker can only forge them on
 * their own request — no victim-driven path — and neither the proxy nor the
 * cookie-reading callback response is CDN-cacheable, so no cache poisoning.
 * Behind an appending proxy the rightmost value is the one written by the hop
 * closest to us; the leftmost is client-supplied and never trusted.
 */

type RequestLike = { headers: Headers; url: string };

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Parse `value` into an `http(s)` origin, or null. Two traps handled here so
 * no caller has to: a non-special scheme (`foo://host`) parses fine but its
 * `.origin` is the literal string `"null"` — truthy, and it makes every
 * downstream `new URL(path, base)` throw — and non-http(s) protocols must
 * never end up in a Location header.
 */
function toHttpOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.origin === "null") return null;
  return url.origin;
}

/** Rightmost entry of a possibly comma-joined header — see trust note above. */
function trustedHeaderValue(headers: Headers, name: string): string | null {
  const joined = headers.get(name);
  if (!joined) return null;
  const value = joined.slice(joined.lastIndexOf(",") + 1).trim();
  return value.length > 0 ? value : null;
}

/** Origin declared by the proxy in front of us, if any. */
function forwardedOrigin(headers: Headers): string | null {
  const host = trustedHeaderValue(headers, "x-forwarded-host");
  if (!host) return null;
  const proto = trustedHeaderValue(headers, "x-forwarded-proto") ?? "https";
  // A malformed or exotic header yields null and the caller moves on.
  return toHttpOrigin(`${proto}://${host}`);
}

/**
 * True when `origin`'s host is a loopback address while running deployed
 * (`NODE_ENV !== "development"`) — i.e. the internal address behind a proxy
 * that didn't forward the real host, which must not leak into a redirect.
 */
function isInternalLoopback(origin: string): boolean {
  if (process.env.NODE_ENV === "development") return false;
  return LOOPBACK_HOSTNAMES.has(new URL(origin).hostname);
}

/**
 * The origin the browser is actually on: forwarded host if a proxy declared
 * one, else the request's own origin. Configuration is deliberately never
 * consulted — use this wherever the redirect must stay on the browser's host
 * (the proxy, whose redirects carry freshly-set session cookies).
 */
export function requestOrigin(request: RequestLike): string | null {
  return forwardedOrigin(request.headers) ?? toHttpOrigin(request.url);
}

/**
 * Canonical site origin, with fallbacks.
 *
 * With a request: forwarded host → the request's own origin *unless* it is
 * the internal loopback of a deployed environment (the localhost-redirect
 * bug) → NEXT_PUBLIC_SITE_URL → VERCEL_URL → the request origin anyway →
 * localhost. VERCEL_URL sits above the last-resort request origin because it
 * is a runtime var: it survives the build-time inlining that can leave
 * NEXT_PUBLIC_SITE_URL undefined in a deployed bundle.
 *
 * Argless (metadataBase): starts at NEXT_PUBLIC_SITE_URL, so metadata always
 * points at the configured canonical origin.
 */
export function siteOrigin(request?: RequestLike): string {
  const forwarded = request ? forwardedOrigin(request.headers) : null;
  if (forwarded) return forwarded;

  const own = request ? toHttpOrigin(request.url) : null;
  if (own && !isInternalLoopback(own)) return own;

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) {
    const origin = toHttpOrigin(configured);
    if (origin) return origin;
    // A malformed value must not poison metadataBase or a Location header.
    console.error(`Invalid NEXT_PUBLIC_SITE_URL "${configured}" — ignoring`);
  } else if (process.env.VERCEL) {
    // NEXT_PUBLIC_* is inlined at BUILD time: a value added in the dashboard
    // after the current build reads as undefined here. Redeploy to pick it up.
    console.warn(
      "siteOrigin: NEXT_PUBLIC_SITE_URL is not set in this build — " +
        "set it in Vercel and redeploy (NEXT_PUBLIC_* vars are inlined at build time)"
    );
  }

  if (process.env.VERCEL_URL) {
    const vercel = toHttpOrigin(`https://${process.env.VERCEL_URL}`);
    if (vercel) return vercel;
  }

  if (own) {
    console.warn(
      `siteOrigin: falling back to the request origin "${own}" — ` +
        "no x-forwarded-host, NEXT_PUBLIC_SITE_URL, or VERCEL_URL available"
    );
    return own;
  }

  return "http://localhost:3000";
}
