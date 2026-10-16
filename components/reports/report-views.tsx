import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { UrgencyBadge } from "@/components/requests/request-badges";
import { OutcomesList } from "@/components/team/outcomes";
import { TASK_PRIORITY_LABELS, type RequestUrgency } from "@/lib/constants";
import type { Contributions, StakeholderUpdate, TeamSummary } from "@/lib/reports/build";
import type { ReportRequest, ReportTask } from "@/lib/reports/data";
import type { Person } from "@/lib/tasks/types";
import { formatDay } from "@/lib/time";

// On-screen renderings of the reports: the same facts the Markdown export prints, laid out to read.

const nameOf = (person: Person | null) => person?.name ?? person?.email ?? "Unassigned";

function dayOf(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function Section({ title, count, children, note }: { title: string; count?: number; children: React.ReactNode; note?: string }) {
  return (
    <section aria-label={title} className="break-inside-avoid rounded-xl border bg-card print:rounded-none print:border-0 print:border-t">
      <div className="flex items-baseline justify-between gap-3 border-b px-5 py-3 print:px-0">
        <h2 className="text-sm font-semibold">
          {title}
          {count !== undefined ? <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">{count}</span> : null}
        </h2>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </div>
      <div className="px-5 py-3 print:px-0">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-sm text-muted-foreground">{children}</p>;
}

export function TaskFacts({ tasks, timeZone, today, who = true, empty }: { tasks: ReportTask[]; timeZone: string; today: string; who?: boolean; empty: string }) {
  if (tasks.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y">
      {tasks.map((task) => {
        const completed = dayOf(task.completedAt, timeZone);
        return (
          <li key={task.id} className="py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Link href={`/tasks/${task.id}`} className="text-sm font-medium underline-offset-4 hover:underline print:no-underline">
                {task.title}
              </Link>
              <StatusBadge status={task.status} className="h-5 px-1.5 text-[11px]" />
              <span className="text-xs text-muted-foreground">
                {who ? `${nameOf(task.assignee)} · ` : ""}
                {completed ? `completed ${formatDay(completed, today)}` : task.dueDate ? `due ${formatDay(task.dueDate, today)}` : "no due date"}
                {task.priority === "urgent" || task.priority === "high" ? ` · ${TASK_PRIORITY_LABELS[task.priority]} priority` : ""}
                {task.goal ? ` · ${task.goal.title}` : ""}
              </span>
            </div>
            {task.impactNote ? (
              <p className="mt-1 text-sm">
                <span className="text-muted-foreground">Why it mattered: </span>
                {task.impactNote}
              </p>
            ) : task.completionSummary ? (
              <p className="mt-1 text-sm text-muted-foreground">{task.completionSummary}</p>
            ) : null}
            {task.blockedReason ? (
              <p className="mt-1 text-sm text-status-blocked-fg">
                Blocked: {task.blockedReason}
                {task.blockedBy ? ` · waiting on ${task.blockedBy}` : ""}
              </p>
            ) : null}
            {!task.completedAt && task.nextAction ? (
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">Next:</span> {task.nextAction}
              </p>
            ) : null}
            {task.evidence.length > 0 ? (
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {task.evidence.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-link underline-offset-4 hover:underline">
                    <ExternalLink className="size-3" aria-hidden />
                    {link.label ?? link.url}
                  </a>
                ))}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function RequestFacts({ requests, empty }: { requests: ReportRequest[]; empty: string }) {
  if (requests.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y">
      {requests.map((request) => (
        <li key={request.id} className="flex flex-wrap items-baseline gap-x-2 py-2 text-sm">
          <Link href={`/requests/${request.id}`} className="font-medium underline-offset-4 hover:underline print:no-underline">
            {request.title}
          </Link>
          <span className="text-xs text-muted-foreground">from {nameOf(request.requester)}</span>
          <UrgencyBadge urgency={request.urgency as RequestUrgency} />
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2 print:border-0 print:px-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function TeamSummaryView({ report, timeZone, today }: { report: TeamSummary; timeZone: string; today: string }) {
  return (
    <div className="grid gap-4">
      <Section title="Planned for this period" note="Tasks that were due in the period">
        {report.planned.total === 0 ? (
          <Empty>Nothing was due in this period.</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Due" value={report.planned.total} />
            <Stat label="Completed" value={report.planned.completed} />
            <Stat label="Still open" value={report.planned.open} />
            <Stat label="Rejected" value={report.planned.rejected} />
          </div>
        )}
      </Section>
      <Section title="Delivered" count={report.delivered.length}>
        <TaskFacts tasks={report.delivered} timeZone={timeZone} today={today} empty="Nothing completed in this period." />
      </Section>
      <Section title="Still open" count={report.stillOpen.length} note="Due in the period or overdue now">
        <TaskFacts tasks={report.stillOpen} timeZone={timeZone} today={today} empty="Nothing due in the period remains open." />
      </Section>
      <Section title="Blocked" count={report.blocked.length}>
        <TaskFacts tasks={report.blocked} timeZone={timeZone} today={today} empty="Nothing is blocked." />
      </Section>
      <Section title="Decisions outstanding" count={report.awaitingApproval.length + report.pendingRequests.length}>
        <TaskFacts tasks={report.awaitingApproval} timeZone={timeZone} today={today} empty="No approvals are waiting." />
        <div className="mt-2 border-t pt-2">
          <RequestFacts requests={report.pendingRequests} empty="No requests are waiting for a decision." />
        </div>
      </Section>
      <Section title="Goals advanced" count={report.goalsAdvanced.length} note="Goals with at least one task completed in the period">
        {report.goalsAdvanced.length === 0 ? (
          <Empty>No completed task in this period was linked to a goal.</Empty>
        ) : (
          <ul className="divide-y">
            {report.goalsAdvanced.map((goal) => (
              <li key={goal.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <Link href={`/goals/${goal.id}`} className="font-medium underline-offset-4 hover:underline print:no-underline">
                  {goal.title}
                </Link>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {goal.completed} {goal.completed === 1 ? "task" : "tasks"} completed
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {report.outcomes.length > 0 ? (
        <Section title="Agreed outcomes" count={report.outcomes.length}>
          <div className="-mx-5">
            <OutcomesList items={report.outcomes} today={today} canManage={false} />
          </div>
        </Section>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Facts above come from task records: dates, statuses, approvals. Whether they add up to strong performance is a judgment this report leaves to people.
      </p>
    </div>
  );
}

export function ContributionsView({ report, timeZone, today }: { report: Contributions; timeZone: string; today: string }) {
  return (
    <div className="grid gap-4">
      <Section title="In short">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Completed" value={report.delivered.length} />
          <Stat label="Significant problems" value={report.problemsSolved.length} />
          <Stat label="Goals supported" value={report.goalsSupported.length} />
          <Stat label="Evidence links" value={report.evidenceCount} />
        </div>
        {report.goalsSupported.length > 0 ? (
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">Supported: </span>
            {report.goalsSupported.map((goal, index) => (
              <span key={goal.id}>
                {index > 0 ? ", " : ""}
                <Link href={`/goals/${goal.id}`} className="underline-offset-4 hover:underline print:no-underline">
                  {goal.title}
                </Link>{" "}
                <span className="text-xs text-muted-foreground tabular-nums">({goal.completed})</span>
              </span>
            ))}
          </p>
        ) : null}
      </Section>
      <Section title="Delivered" count={report.delivered.length}>
        <TaskFacts tasks={report.delivered} timeZone={timeZone} today={today} who={false} empty="Nothing completed in this period." />
      </Section>
      <Section title="Significant problems solved" count={report.problemsSolved.length} note="Urgent or high priority, or unblocked along the way">
        <TaskFacts tasks={report.problemsSolved} timeZone={timeZone} today={today} who={false} empty="None recorded in this period." />
      </Section>
      <Section title="Still carrying" count={report.outstanding.length}>
        <TaskFacts tasks={report.outstanding} timeZone={timeZone} today={today} who={false} empty="Nothing open." />
      </Section>
      {report.waitingOnOthers.length > 0 ? (
        <Section title="Waiting on others" count={report.waitingOnOthers.length}>
          <TaskFacts tasks={report.waitingOnOthers} timeZone={timeZone} today={today} who={false} empty="" />
        </Section>
      ) : null}
      <p className="text-xs text-muted-foreground">Counts are records, not a rating. A few large deliverables can matter more than many small ones.</p>
    </div>
  );
}

export function StakeholderView({ report, timeZone, today }: { report: StakeholderUpdate; timeZone: string; today: string }) {
  return (
    <div className="grid gap-4">
      <Section title="Completed" count={report.completed.length}>
        <TaskFacts tasks={report.completed} timeZone={timeZone} today={today} who={false} empty="Nothing completed in this period." />
      </Section>
      <Section title="In progress" count={report.inProgress.length}>
        <TaskFacts tasks={report.inProgress} timeZone={timeZone} today={today} who={false} empty="Nothing in progress." />
      </Section>
      <Section title="Blocked" count={report.blocked.length}>
        <TaskFacts tasks={report.blocked} timeZone={timeZone} today={today} who={false} empty="Nothing is blocked." />
      </Section>
      <Section title="Requests awaiting a decision" count={report.pendingRequests.length}>
        <RequestFacts requests={report.pendingRequests} empty="None." />
      </Section>
      <Section title={`Coming up by ${formatDay(report.upcomingUntil, today)}`} count={report.upcoming.length}>
        <TaskFacts tasks={report.upcoming} timeZone={timeZone} today={today} empty="No dated commitments in the next two weeks." />
      </Section>
    </div>
  );
}
