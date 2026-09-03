/**
 * A case's average rating is only meaningful once a few students have rated
 * it — below this threshold the UI shows "New" instead of the number.
 */
export const MIN_RATINGS_TO_SHOW = 3;

/** The average to display, or null when the UI should show "New". */
export function shownRating(
  avgRating: number | null,
  ratingCount: number
): number | null {
  return ratingCount >= MIN_RATINGS_TO_SHOW && avgRating !== null
    ? avgRating
    : null;
}
