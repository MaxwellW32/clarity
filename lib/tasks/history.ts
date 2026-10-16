import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type TaskActivityKind, type TaskPriority, type TaskStatus } from "@/lib/constants";
import { calendarDaysBetween, dayKey, formatAbsolute } from "@/lib/time";
import type { HistoryItem } from "./types";

export type HistoryRow = {
  type: "update" | "activity";
  id: string;
  created_at: Date | string;
  kind: TaskActivityKind | null;
  progress: string | null;
  next_action: string | null;
  blocker: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  note: string | null;
  actor_id: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_image: string | null;
  before_assignee: string | null;
  after_assignee: string | null;
  approver_name: string | null;
};

const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
const statusLabel = (value: unknown) => (typeof value === "string" && value in TASK_STATUS_LABELS ? TASK_STATUS_LABELS[value as TaskStatus] : null);
const priorityLabel = (value: unknown) => (typeof value === "string" && value in TASK_PRIORITY_LABELS ? TASK_PRIORITY_LABELS[value as TaskPriority] : null);
const formatDay = (value: unknown) => {
  if (typeof value !== "string") return "No date";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, day)));
};

/** "posted an update", "blocked it", before → after: one row of the history, in plain words. */
export function phraseHistory(row: HistoryRow, timeZone: string, now: Date): HistoryItem {
  const at = new Date(row.created_at);
  const day = dayKey(at, timeZone);
  const daysAgo = calendarDaysBetween(day, dayKey(now, timeZone));
  const dayLabel =
    daysAgo === 0
      ? "Today"
      : daysAgo === 1
        ? "Yesterday"
        : new Intl.DateTimeFormat("en", { timeZone, weekday: "short", month: "short", day: "numeric", ...(daysAgo > 300 ? { year: "numeric" } : {}) }).format(at);
  const before = row.before ?? {};
  const after = row.after ?? {};
  let phrase = "";
  let change: HistoryItem["change"] = null;

  if (row.type === "update") {
    phrase = "posted an update";
  } else {
    switch (row.kind) {
      case "created":
        phrase = "created the task";
        break;
      case "edited": {
        const field = Object.keys(after)[0] ?? Object.keys(before)[0] ?? "details";
        phrase = `edited the ${field === "dueDate" ? "due date" : field}`;
        if (field === "title") change = { before: text(before.title), after: text(after.title) };
        break;
      }
      case "status_changed":
        phrase = "changed the status";
        change = { before: statusLabel(before.status), after: statusLabel(after.status) };
        break;
      case "assigned":
        phrase = row.after_assignee ? `assigned it to ${row.after_assignee}` : "unassigned it";
        if (row.before_assignee) change = { before: row.before_assignee, after: row.after_assignee ?? "Unassigned" };
        break;
      case "handed_over":
        phrase = `handed it over to ${row.after_assignee ?? "someone"}`;
        break;
      case "due_changed":
        phrase = "changed the due date";
        change = { before: before.dueDate ? formatDay(before.dueDate) : "No date", after: after.dueDate ? formatDay(after.dueDate) : "No date" };
        break;
      case "priority_changed":
        phrase = "changed the priority";
        change = { before: priorityLabel(before.priority), after: priorityLabel(after.priority) };
        break;
      case "blocked":
        phrase = text(after.blockedBy) ? `marked it blocked (waiting on ${text(after.blockedBy)})` : "marked it blocked";
        break;
      case "unblocked":
        phrase = "unblocked it";
        break;
      case "approval_requested":
        phrase = `asked ${row.approver_name ?? "someone"} to approve it`;
        break;
      case "approved":
        phrase = "approved it";
        break;
      case "sent_back":
        phrase = "sent it back";
        break;
      case "rejected":
        phrase = "rejected it";
        break;
      case "completed":
        phrase = "completed it";
        break;
      case "reopened":
        phrase = "reopened it";
        change = { before: statusLabel(before.status), after: statusLabel(after.status) };
        break;
      case "evidence_added":
        phrase = `added evidence: ${text(after.label) ?? text(after.url) ?? "a link"}`;
        break;
      case "evidence_removed":
        phrase = `removed evidence: ${text(before.label) ?? text(before.url) ?? "a link"}`;
        break;
      default:
        phrase = "updated it";
    }
  }

  return {
    id: row.id,
    type: row.type === "update" ? "update" : (row.kind ?? "edited"),
    actor: { id: row.actor_id, name: row.actor_name, email: row.actor_email, image: row.actor_image },
    phrase,
    change,
    note: row.note,
    progress: row.progress,
    nextAction: row.next_action,
    blocker: row.blocker,
    at: at.toISOString(),
    day,
    dayLabel,
    time: new Intl.DateTimeFormat("en", { timeZone, hour: "numeric", minute: "2-digit" }).format(at),
    absolute: formatAbsolute(at, timeZone),
  };
}
