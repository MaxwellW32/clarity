import { cn } from "cn";
import { CheckCircle2, Flag, Hash, XCircle } from "lucide-react";
import Link from "next/link";
import type { ExpectationItem } from "@/lib/dal/goals";
import { formatDay } from "@/lib/time";
import { ExpectationActions } from "./expectation-dialog";

/** Progress on one expectation: for a count, done vs target; for a milestone, whether its linked work is done. */
export function expectationProgress(item: ExpectationItem): { done: number; target: number; complete: boolean; label: string } {
  if (item.kind === "count") {
    const target = item.targetCount ?? 0;
    return { done: item.completed, target, complete: target > 0 && item.completed >= target, label: `${item.completed} of ${target} delivered` };
  }
  const complete = item.linked > 0 && item.completed === item.linked;
  return { done: item.completed, target: Math.max(item.linked, 1), complete, label: item.linked === 0 ? "No work linked yet" : complete ? "Delivered" : `${item.completed} of ${item.linked} linked tasks done` };
}

/** The team's agreed outcomes for a period, as facts: what was promised, how much is delivered, what's at risk. */
export function OutcomesList({ items, today, canManage, teamId }: { items: ExpectationItem[]; today: string; canManage: boolean; teamId?: string }) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-4 text-sm text-muted-foreground">
        {canManage ? "No agreed outcomes for this team yet. Add what you've committed to for the month or quarter." : "No agreed outcomes recorded for this team."}
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {items.map((item) => {
        const progress = expectationProgress(item);
        const overdue = item.status === "open" && item.periodEnd < today && !progress.complete;
        const Icon = item.kind === "count" ? Hash : Flag;
        return (
          <li key={item.id} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", item.status === "missed" && "text-muted-foreground")}>{item.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>
                    {formatDay(item.periodStart, today)} – {formatDay(item.periodEnd, today)}
                  </span>
                  {item.goal ? (
                    <>
                      <span>·</span>
                      <Link href={`/goals/${item.goal.id}`} className="underline-offset-4 hover:underline">
                        {item.goal.title}
                      </Link>
                    </>
                  ) : null}
                  {teamId === undefined ? (
                    <>
                      <span>·</span>
                      <span>{item.teamName}</span>
                    </>
                  ) : null}
                </p>
                {item.description ? <p className="mt-1 text-xs text-muted-foreground">{item.description}</p> : null}
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div
                      className={cn("h-full rounded-full", item.status === "met" || progress.complete ? "bg-status-completed-dot" : item.status === "missed" ? "bg-status-rejected-dot" : overdue ? "bg-priority-urgent" : "bg-foreground/60")}
                      style={{ width: `${Math.min(100, Math.round((progress.done / progress.target) * 100))}%` }}
                    />
                  </div>
                  <span className={cn("shrink-0 text-xs tabular-nums", overdue ? "font-medium text-priority-urgent" : "text-muted-foreground")}>{progress.label}</span>
                </div>
              </div>
              {item.status === "met" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-status-completed-bg px-2 py-0.5 text-xs font-medium text-status-completed-fg">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Met
                </span>
              ) : item.status === "missed" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-status-rejected-bg px-2 py-0.5 text-xs font-medium text-status-rejected-fg">
                  <XCircle className="size-3.5" aria-hidden />
                  Missed
                </span>
              ) : overdue ? (
                <span className="shrink-0 rounded-md bg-status-blocked-bg px-2 py-0.5 text-xs font-medium text-status-blocked-fg">At risk</span>
              ) : null}
            </div>
            {canManage ? (
              <div className="mt-2 pl-7">
                <ExpectationActions expectationId={item.id} status={item.status} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
