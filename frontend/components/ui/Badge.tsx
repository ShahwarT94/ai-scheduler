import type { ReactNode } from "react";

type Variant = "green" | "blue" | "red" | "gray" | "yellow";

const styles: Record<Variant, string> = {
  green:  "bg-green-100 text-green-700 ring-green-200",
  blue:   "bg-blue-100 text-blue-700 ring-blue-200",
  red:    "bg-red-100 text-red-700 ring-red-200",
  gray:   "bg-gray-100 text-gray-600 ring-gray-200",
  yellow: "bg-yellow-100 text-yellow-700 ring-yellow-200",
};

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "gray", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
