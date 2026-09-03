/**
 * Day-granularity relative date for server-rendered copy ("today",
 * "yesterday", "5 days ago", "3 weeks ago"). Compares calendar days rather
 * than raw milliseconds so 11:59pm yesterday still reads "yesterday" —
 * in the server's timezone (UTC on Vercel), so IST users see the day
 * boundary shifted by 5.5h; acceptable at day granularity.
 * Future or unparsable dates clamp to "today".
 */
export function relativeDate(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "today";

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);

  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.min(12, Math.floor(days / 30))} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}
