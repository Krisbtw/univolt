import { cn } from "@/lib/utils";

export function UnivoltMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      aria-hidden="true"
      fill="none"
    >
      <rect width="32" height="32" rx="8" className="fill-pine" />
      <path
        d="M6 17h3.2l2.1-6.4 2.8 12.2 3-8.6 1.7 4.2H26"
        className="stroke-pine-fg"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const UniCareMark = UnivoltMark;
