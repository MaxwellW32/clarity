import type { TaskPriority } from "@/lib/constants";
import { calendarDaysBetween } from "@/lib/time";
import type { TaskListItem } from "./types";

// My Work grouping (docs/PLAN.md §5), as a pure function so it can be unit-tested without a database.
// A task appears in exactly one section. Precedence: Needs attention (I must act now) → Waiting on others
// (someone else must act) → Continue working → Recently finished.

export type MyWorkRow = {
  item: TaskListItem;
  approverId: string | null;
  assigneeId: string | null;
  sortRank: number;
  completedAt: Date | null;
  /** In progress because an approver sent it back (its latest status event). */
  sentBack: boolean;
};

export type MyWorkGroups = {
  attention: TaskListItem[];
  continueWorking: TaskListItem[];
  waiting: TaskListItem[];
  finished: TaskListItem[];
};

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const OPEN = new Set(["not_started", "in_progress", "awaiting_approval", "blocked"]);

function daysUntilDue(item: TaskListItem, today: string): number | null {
  return item.dueDate ? calendarDaysBetween(today, item.dueDate) : null;
}

/** The list's "smart" order: overdue → due soonest → urgent first → manual rank → most recently updated. */
export function smartCompare(today: string) {
  return (a: MyWorkRow, b: MyWorkRow): number => {
    const dueA = daysUntilDue(a.item, today);
    const dueB = daysUntilDue(b.item, today);
    const overdueA = dueA !== null && dueA < 0 ? 0 : 1;
    const overdueB = dueB !== null && dueB < 0 ? 0 : 1;
    if (overdueA !== overdueB) return overdueA - overdueB;
    if ((dueA ?? Infinity) !== (dueB ?? Infinity)) return (dueA ?? Infinity) - (dueB ?? Infinity);
    if (PRIORITY_RANK[a.item.priority] !== PRIORITY_RANK[b.item.priority]) return PRIORITY_RANK[a.item.priority] - PRIORITY_RANK[b.item.priority];
    if (a.sortRank !== b.sortRank) return b.sortRank - a.sortRank;
    return b.item.updatedAt.localeCompare(a.item.updatedAt);
  };
}

/** Why a task needs attention, or null when it doesn't. */
function attentionReason(row: MyWorkRow, viewerId: string, today: string): string | null {
  const { item } = row;
  if (item.status === "awaiting_approval" && row.approverId === viewerId) return "Your approval";
  if (row.assigneeId !== viewerId || !OPEN.has(item.status)) return null;
  if (row.sentBack) return "Sent back";
  const days = daysUntilDue(item, today);
  if (days !== null && days < 0) return "Overdue";
  // Blocked work with a far-off date waits on others; a blocked task due now is still mine to chase.
  if (item.status === "blocked" && (days === null || days > 2)) return null;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === 2) return "Due in 2 days";
  return null;
}

/** Reasons the due label already shows (in red when overdue), so they get no extra badge. */
const DATE_REASONS = new Set(["Overdue", "Due today", "Due tomorrow", "Due in 2 days"]);

export function groupMyWork(rows: MyWorkRow[], viewerId: string, today: string): MyWorkGroups {
  const sorted = [...rows].sort(smartCompare(today));
  const groups: MyWorkGroups = { attention: [], continueWorking: [], waiting: [], finished: [] };
  const finished: MyWorkRow[] = [];
  for (const row of sorted) {
    const reason = attentionReason(row, viewerId, today);
    if (reason !== null) {
      groups.attention.push(DATE_REASONS.has(reason) ? row.item : { ...row.item, reason });
    } else if (row.assigneeId === viewerId && (row.item.status === "awaiting_approval" || row.item.status === "blocked")) {
      groups.waiting.push(row.item);
    } else if (row.assigneeId === viewerId && (row.item.status === "in_progress" || row.item.status === "not_started")) {
      groups.continueWorking.push(row.item);
    } else if (row.assigneeId === viewerId && row.item.status === "completed") {
      finished.push(row);
    }
  }
  groups.finished = finished
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
    .map((row) => row.item);
  return groups;
}
