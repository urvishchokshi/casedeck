import { Pill } from "@/components/ui/Pill";
import { shownRating } from "@/lib/rating";

export function RatingPill({ avg, count }: { avg: number | null; count: number }) {
  const rating = shownRating(avg, count);
  return (
    <Pill tone="amber">{rating !== null ? `★ ${rating.toFixed(1)}` : "New"}</Pill>
  );
}
