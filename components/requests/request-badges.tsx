import { cn } from "cn";
import { ArrowRight, CheckCircle2, ChevronsUp, ChevronUp, Clock, Inbox, Pause, XCircle, type LucideIcon } from "lucide-react";
import { REQUEST_STATUS_LABELS, REQUEST_URGENCY_LABELS, type RequestStatus, type RequestUrgency } from "@/lib/constants";

const STATUS: Record<RequestStatus, { icon: LucideIcon; className: string }> = {
  new: { icon: Inbox, className: "bg-status-in-progress-bg text-status-in-progress-fg" },
  under_review: { icon: Clock, className: "bg-status-awaiting-bg text-status-awaiting-fg" },
  approved: { icon: CheckCircle2, className: "bg-status-completed-bg text-status-completed-fg" },
  deferred: { icon: Pause, className: "bg-status-not-started-bg text-status-not-started-fg" },
  rejected: { icon: XCircle, className: "bg-status-rejected-bg text-status-rejected-fg" },
  converted: { icon: ArrowRight, className: "bg-status-completed-bg text-status-completed-fg" },
};

export function RequestStatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const { icon: Icon, className: tone } = STATUS[status];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap", tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {REQUEST_STATUS_LABELS[status]}
    </span>
  );
}

/** Urgency is the requester's suggestion, so it stays quiet: a glyph and a word, no fill. */
export function UrgencyBadge({ urgency, className }: { urgency: RequestUrgency; className?: string }) {
  const label = `${REQUEST_URGENCY_LABELS[urgency]} urgency`;
  if (urgency === "critical") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-priority-urgent", className)} aria-label={label}>
        <ChevronsUp className="size-3.5" aria-hidden />
        Critical
      </span>
    );
  }
  if (urgency === "high") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-priority-high", className)} aria-label={label}>
        <ChevronUp className="size-3.5" aria-hidden />
        High
      </span>
    );
  }
  return (
    <span className={cn("text-xs text-muted-foreground", className)} aria-label={label}>
      {REQUEST_URGENCY_LABELS[urgency]}
    </span>
  );
}
