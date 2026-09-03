// Shimmer placeholder block for loading.tsx files; styling lives in the
// .skeleton class in globals.css (tokens + reduced-motion handling).
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}
