import type { NextConfig } from "next";

// HSTS is not set here — Vercel serves Strict-Transport-Security on all HTTPS
// domains automatically. CSP is deliberately deferred (Next's inline scripts
// need nonce plumbing to avoid unsafe-inline).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // microphone=(self): the in-app voice interviewer on /cases/[id] needs
    // getUserMedia on our own origin; still denied to any embedded frame.
    value:
      "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
