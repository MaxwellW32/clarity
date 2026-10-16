import { REQUEST_URGENCY_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type RequestUrgency } from "@/lib/constants";
import type { Person } from "@/lib/tasks/types";
import { formatDay } from "@/lib/time";
import type { Contributions, Report, StakeholderUpdate, TeamSummary } from "./build";
import type { ReportTask } from "./data";

// Markdown and CSV renderings of a report. Plain, factual, pasteable into a doc or a chat.

const nameOf = (person: Person | null) => person?.name ?? person?.email ?? "Unassigned";

function dayOf(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function rangeLabel(range: { from: string; to: string }, today: string): string {
  return `${formatDay(range.from, today)} – ${formatDay(range.to, today)}`;
}

function taskLine(task: ReportTask, timeZone: string, today: string, withWho = true): string {
  const bits: string[] = [`**${task.title}**`];
  if (withWho && task.assignee) bits.push(nameOf(task.assignee));
  if (task.completedAt) bits.push(`completed ${formatDay(dayOf(task.completedAt, timeZone), today)}`);
  else if (task.dueDate) bits.push(`due ${formatDay(task.dueDate, today)}`);
  if (task.goal) bits.push(`→ ${task.goal.title}`);
  const lines = [`- ${bits.join(" · ")}`];
  if (task.impactNote) lines.push(`  - Why it mattered: ${task.impactNote}`);
  else if (task.completionSummary) lines.push(`  - ${task.completionSummary}`);
  if (task.blockedReason) lines.push(`  - Blocked: ${task.blockedReason}${task.blockedBy ? ` (waiting on ${task.blockedBy})` : ""}`);
  if (task.nextAction && !task.completedAt) lines.push(`  - Next: ${task.nextAction}`);
  for (const link of task.evidence) lines.push(`  - Evidence: ${link.label ? `[${link.label}](${link.url})` : link.url}`);
  return lines.join("\n");
}

const none = (text: string) => `_${text}_`;

export function teamSummaryMarkdown(report: TeamSummary, orgName: string, timeZone: string, today: string): string {
  const out: string[] = [];
  out.push(`# Team summary · ${report.scope.teamName ?? orgName}`);
  out.push(`${rangeLabel(report.range, today)} · generated from Clarity on ${formatDay(today, today)}`);
  out.push("");
  out.push("## Planned for this period");
  out.push(report.planned.total === 0 ? none("Nothing was due in this period.") : `${report.planned.total} tasks were due: ${report.planned.completed} completed, ${report.planned.open} still open, ${report.planned.rejected} rejected.`);
  out.push("");
  out.push(`## Delivered (${report.delivered.length})`);
  out.push(report.delivered.length === 0 ? none("Nothing completed in this period.") : report.delivered.map((task) => taskLine(task, timeZone, today)).join("\n"));
  out.push("");
  out.push(`## Still open (${report.stillOpen.length})`);
  out.push(report.stillOpen.length === 0 ? none("Nothing due in the period remains open.") : report.stillOpen.map((task) => `- **${task.title}** · ${nameOf(task.assignee)} · ${TASK_STATUS_LABELS[task.status]}${task.dueDate ? ` · due ${formatDay(task.dueDate, today)}` : ""}`).join("\n"));
  out.push("");
  out.push(`## Blocked (${report.blocked.length})`);
  out.push(report.blocked.length === 0 ? none("Nothing is blocked.") : report.blocked.map((task) => taskLine(task, timeZone, today)).join("\n"));
  out.push("");
  out.push(`## Decisions outstanding (${report.awaitingApproval.length + report.pendingRequests.length})`);
  const decisions = [
    ...report.awaitingApproval.map((task) => `- Approval: **${task.title}** · ${nameOf(task.assignee)}`),
    ...report.pendingRequests.map((request) => `- Request: **${request.title}** · from ${nameOf(request.requester)} · ${REQUEST_URGENCY_LABELS[request.urgency as RequestUrgency] ?? request.urgency} urgency`),
  ];
  out.push(decisions.length === 0 ? none("No decisions are waiting.") : decisions.join("\n"));
  out.push("");
  out.push(`## Goals advanced (${report.goalsAdvanced.length})`);
  out.push(report.goalsAdvanced.length === 0 ? none("No completed task in this period was linked to a goal.") : report.goalsAdvanced.map((goal) => `- **${goal.title}** · ${goal.completed} ${goal.completed === 1 ? "task" : "tasks"} completed`).join("\n"));
  if (report.outcomes.length > 0) {
    out.push("");
    out.push("## Agreed outcomes");
    out.push(
      report.outcomes
        .map((item) => {
          const progress = item.kind === "count" ? `${item.completed} of ${item.targetCount ?? 0} delivered` : item.linked === 0 ? "no work linked" : `${item.completed} of ${item.linked} linked tasks done`;
          return `- **${item.title}** · ${progress} · ${item.status}`;
        })
        .join("\n"),
    );
  }
  out.push("");
  out.push("_Facts above come from task records (dates, statuses, approvals). Whether they add up to strong performance is a judgment this report does not make._");
  return out.join("\n");
}

export function contributionsMarkdown(report: Contributions, timeZone: string, today: string): string {
  const out: string[] = [];
  out.push(`# Contributions · ${nameOf(report.person)}`);
  out.push(`${rangeLabel(report.range, today)} · generated from Clarity on ${formatDay(today, today)}`);
  out.push("");
  out.push("## In short");
  out.push(
    `${report.delivered.length} ${report.delivered.length === 1 ? "task" : "tasks"} completed, ${report.problemsSolved.length} of them urgent, high-priority or previously blocked, with ${report.evidenceCount} evidence ${report.evidenceCount === 1 ? "link" : "links"}. ${report.goalsSupported.length === 0 ? "No completed work was linked to a goal." : `Supported ${report.goalsSupported.length} ${report.goalsSupported.length === 1 ? "goal" : "goals"}: ${report.goalsSupported.map((goal) => goal.title).join("; ")}.`}`,
  );
  out.push("");
  out.push(`## Delivered (${report.delivered.length})`);
  out.push(report.delivered.length === 0 ? none("Nothing completed in this period.") : report.delivered.map((task) => taskLine(task, timeZone, today, false)).join("\n"));
  out.push("");
  out.push(`## Significant problems solved (${report.problemsSolved.length})`);
  out.push(report.problemsSolved.length === 0 ? none("None recorded.") : report.problemsSolved.map((task) => `- **${task.title}** · ${TASK_PRIORITY_LABELS[task.priority]} priority${task.wasBlocked ? " · was blocked" : ""}`).join("\n"));
  out.push("");
  out.push(`## Still carrying (${report.outstanding.length})`);
  out.push(report.outstanding.length === 0 ? none("Nothing open.") : report.outstanding.map((task) => `- **${task.title}** · ${TASK_STATUS_LABELS[task.status]}${task.dueDate ? ` · due ${formatDay(task.dueDate, today)}` : ""}${task.nextAction ? ` · next: ${task.nextAction}` : ""}`).join("\n"));
  if (report.waitingOnOthers.length > 0) {
    out.push("");
    out.push(`## Waiting on others (${report.waitingOnOthers.length})`);
    out.push(report.waitingOnOthers.map((task) => `- **${task.title}** · ${TASK_STATUS_LABELS[task.status]}${task.blockedReason ? ` · ${task.blockedReason}` : ""}`).join("\n"));
  }
  out.push("");
  out.push("_Counts are records, not a rating: a small number of large deliverables can matter more than many small ones._");
  return out.join("\n");
}

export function stakeholderMarkdown(report: StakeholderUpdate, orgName: string, timeZone: string, today: string): string {
  const out: string[] = [];
  out.push(`# Update · ${report.scope.teamName ?? orgName}`);
  out.push(`${rangeLabel(report.range, today)} · generated from Clarity on ${formatDay(today, today)}`);
  out.push("");
  out.push(`## Completed (${report.completed.length})`);
  out.push(report.completed.length === 0 ? none("Nothing completed in this period.") : report.completed.map((task) => `- **${task.title}**${task.impactNote ? ` — ${task.impactNote}` : task.completionSummary ? ` — ${task.completionSummary}` : ""}`).join("\n"));
  out.push("");
  out.push(`## In progress (${report.inProgress.length})`);
  out.push(report.inProgress.length === 0 ? none("Nothing in progress.") : report.inProgress.map((task) => `- **${task.title}**${task.nextAction ? ` — next: ${task.nextAction}` : ""}${task.dueDate ? ` (due ${formatDay(task.dueDate, today)})` : ""}`).join("\n"));
  out.push("");
  out.push(`## Blocked (${report.blocked.length})`);
  out.push(report.blocked.length === 0 ? none("Nothing is blocked.") : report.blocked.map((task) => `- **${task.title}** — ${task.blockedReason ?? "blocked"}${task.blockedBy ? ` (waiting on ${task.blockedBy})` : ""}`).join("\n"));
  out.push("");
  out.push(`## Requests awaiting a decision (${report.pendingRequests.length})`);
  out.push(report.pendingRequests.length === 0 ? none("None.") : report.pendingRequests.map((request) => `- **${request.title}** · from ${nameOf(request.requester)}`).join("\n"));
  out.push("");
  out.push(`## Coming up by ${formatDay(report.upcomingUntil, today)} (${report.upcoming.length})`);
  out.push(report.upcoming.length === 0 ? none("No dated commitments in the next two weeks.") : report.upcoming.map((task) => `- **${task.title}** · due ${formatDay(task.dueDate ?? today, today)}${task.assignee ? ` · ${nameOf(task.assignee)}` : ""}`).join("\n"));
  return out.join("\n");
}

export function reportMarkdown(report: Report, orgName: string, timeZone: string, today: string): string {
  switch (report.kind) {
    case "team":
      return teamSummaryMarkdown(report, orgName, timeZone, today);
    case "contributions":
      return contributionsMarkdown(report, timeZone, today);
    case "stakeholder":
      return stakeholderMarkdown(report, orgName, timeZone, today);
  }
}

// --- CSV --------------------------------------------------------------------------------------------------------

const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Every task a report mentions, one row each, with the section it appeared in. */
export function reportCsv(report: Report, timeZone: string): string {
  const header = ["section", "title", "status", "priority", "size", "assignee", "team", "due", "completed", "goal", "summary", "impact", "blocked_reason", "next_action", "evidence"];
  const rows: string[][] = [];
  const add = (section: string, tasks: ReportTask[]) => {
    for (const task of tasks) {
      rows.push([
        section,
        task.title,
        TASK_STATUS_LABELS[task.status],
        TASK_PRIORITY_LABELS[task.priority],
        task.size ?? "",
        nameOf(task.assignee),
        task.teamName,
        task.dueDate ?? "",
        dayOf(task.completedAt, timeZone),
        task.goal?.title ?? "",
        task.completionSummary ?? "",
        task.impactNote ?? "",
        task.blockedReason ?? "",
        task.nextAction ?? "",
        task.evidence.map((link) => link.url).join(" "),
      ]);
    }
  };
  if (report.kind === "team") {
    add("Delivered", report.delivered);
    add("Still open", report.stillOpen);
    add("Blocked", report.blocked);
    add("Awaiting approval", report.awaitingApproval);
  } else if (report.kind === "contributions") {
    add("Delivered", report.delivered);
    add("Still carrying", report.outstanding);
    add("Waiting on others", report.waitingOnOthers);
  } else {
    add("Completed", report.completed);
    add("In progress", report.inProgress);
    add("Blocked", report.blocked);
    add("Coming up", report.upcoming);
  }
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}
