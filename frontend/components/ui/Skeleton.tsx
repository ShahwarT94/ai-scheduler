interface SkeletonProps {
  className?: string;
}

/** Single pulsing placeholder block. Compose to match the shape of real content. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />
  );
}
