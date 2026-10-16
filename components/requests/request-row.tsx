import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusIcon } from "@/components/status-badge";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import type { RequestListItem } from "@/lib/requests/types";
import { formatDay, formatRelative } from "@/lib/time";
import { RequestStatusBadge, UrgencyBadge } from "./request-badges";

const nameOf = (person: RequestListItem["requester"]) => person.name ?? person.email ?? "Someone";

/** One request: status · title and who asked · urgency · (its task, or when to revisit) · optional actions. */
export function RequestRow({
  request,
  now,
  today,
  timeZone,
  actions,
}: {
  request: RequestListItem;
  now: Date;
  today: string;
  timeZone: string;
  actions?: ReactNode;
}) {
  const revisitDue = request.status === "deferred" && request.deferUntil !== null && request.deferUntil <= today;
  return (
    <li className="group relative flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-accent/60">
      <div className="flex items-start gap-3">
        <RequestStatusBadge status={request.status} className="mt-0.5 hidden sm:inline-flex" />
        <Link
          href={`/requests/${request.id}`}
          prefetch={false}
          className="min-w-0 flex-1 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          <span className="block truncate text-[13px] font-medium">{request.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            <RequestStatusBadge status={request.status} className="mr-1.5 h-5 px-1.5 text-[11px] sm:hidden" />
            {request.teamName} · {nameOf(request.requester)} · {formatRelative(new Date(request.createdAt), now, timeZone)}
          </span>
        </Link>
        <UrgencyBadge urgency={request.urgency} className="relative shrink-0 pt-0.5" />
        {request.task ? (
          <Link
            href={`/tasks/${request.task.id}`}
            className="relative z-10 hidden shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
            title={`Task: ${TASK_STATUS_LABELS[request.task.status]}`}
          >
            <StatusIcon status={request.task.status} className="size-3.5" />
            Task
          </Link>
        ) : request.status === "deferred" && request.deferUntil ? (
          <span className={cn("relative shrink-0 text-xs", revisitDue ? "font-medium text-priority-high" : "text-muted-foreground")}>
            {revisitDue ? "Revisit now" : `Revisit ${formatDay(request.deferUntil, today)}`}
          </span>
        ) : null}
      </div>
      {actions ? <div className="relative z-10 flex flex-wrap gap-2 pl-0 sm:pl-[7.5rem]">{actions}</div> : null}
    </li>
  );
}
