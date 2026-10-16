import { cn } from "cn";
import type { TaskStatus } from "@/lib/constants";
import { formatDay, formatDue } from "@/lib/time";

/** "Tomorrow", "3 days overdue" (red), "Oct 20". `today` comes from the server so both sides agree. */
export function DueLabel({ due, today, status, className }: { due: string | null; today: string; status: TaskStatus; className?: string }) {
  if (!due) return null;
  const closed = status === "completed" || status === "rejected";
  const { text, overdue } = formatDue(due, today);
  return (
    <span className={cn("whitespace-nowrap tabular-nums", overdue && !closed ? "font-medium text-priority-urgent" : "text-muted-foreground", className)}>
      {closed ? formatDay(due, today) : text}
    </span>
  );
}
