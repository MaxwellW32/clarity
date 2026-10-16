import { cn } from "cn";
import { Building2, CheckCircle2, Target, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import type { GoalStatus } from "@/lib/constants";
import type { GoalItem } from "@/lib/dal/goals";
import { formatDay } from "@/lib/time";

export function GoalStatusBadge({ status, className }: { status: GoalStatus; className?: string }) {
  if (status === "active") return null;
  const achieved = status === "achieved";
  const Icon = achieved ? CheckCircle2 : XCircle;
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium", achieved ? "bg-status-completed-bg text-status-completed-fg" : "bg-status-rejected-bg text-status-rejected-fg", className)}>
      <Icon className="size-3.5" aria-hidden />
      {achieved ? "Achieved" : "Dropped"}
    </span>
  );
}

/** "4 of 7 tasks done" with a thin bar. A fact about linked work, not a percentage of the goal. */
export function GoalProgress({ tasks, className }: { tasks: GoalItem["tasks"]; className?: string }) {
  if (tasks.total === 0) return <p className={cn("text-xs text-muted-foreground", className)}>No work linked yet.</p>;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground tabular-nums">{tasks.completed}</span> of {tasks.total} linked {tasks.total === 1 ? "task" : "tasks"} done
        </span>
        {tasks.open > 0 ? <span className="tabular-nums">{tasks.open} open</span> : null}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-status-completed-dot" style={{ width: `${Math.round((tasks.completed / tasks.total) * 100)}%` }} />
      </div>
    </div>
  );
}

export function GoalCard({ goal, today }: { goal: GoalItem; today: string }) {
  const late = goal.status === "active" && goal.targetDate !== null && goal.targetDate < today;
  return (
    <li className="group relative rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-muted">
          <Target className="size-4 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/goals/${goal.id}`} className="block font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring">
            <span className={cn(goal.status === "dropped" && "text-muted-foreground line-through")}>{goal.title}</span>
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {goal.team ? <Users className="size-3" aria-hidden /> : <Building2 className="size-3" aria-hidden />}
              {goal.team ? goal.team.name : "Organization"}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <UserAvatar name={goal.owner.name} email={goal.owner.email} image={goal.owner.image} size="sm" className="size-4" />
              {goal.owner.name ?? goal.owner.email}
            </span>
            {goal.targetDate ? (
              <>
                <span>·</span>
                <span className={cn(late && "font-medium text-priority-urgent")}>
                  {late ? "Target passed " : "Target "}
                  {formatDay(goal.targetDate, today)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <GoalStatusBadge status={goal.status} className="relative shrink-0" />
      </div>
      <GoalProgress tasks={goal.tasks} className="mt-3" />
    </li>
  );
}
