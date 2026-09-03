// Uptime-check endpoint; listed in PUBLIC_PATHS in src/proxy.ts so it is
// reachable without a session.
export function GET() {
  return Response.json({ ok: true });
}
