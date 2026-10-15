import { cn } from "cn";

/** The wordmark: a small solid tile with a clock-like mark, and the name. */
export function Logo({ className, withName = true }: { className?: string; withName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span aria-hidden className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
        <svg
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="8" cy="8" r="5" />
          <path d="M8 5v3h2.5" />
        </svg>
      </span>
      {withName ? <span>Clarity</span> : <span className="sr-only">Clarity</span>}
    </span>
  );
}
