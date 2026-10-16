import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { TaskListItem } from "@/lib/tasks/types";
import { TaskList } from "./task-list";

/** A titled group of task rows with a count and, when there is more than it shows, a "See all" link. */
export function TaskSection({
  id,
  title,
  description,
  items,
  total = items.length,
  today,
  seeAllHref,
  empty,
}: {
  id: string;
  title: string;
  description?: string;
  items: TaskListItem[];
  /** How many there are in all, when `items` is a capped slice. */
  total?: number;
  today: string;
  seeAllHref?: string;
  /** Shown instead of rows when there is nothing in the section. */
  empty?: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="min-w-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-0.5">
        <div className="flex items-baseline gap-2">
          <h2 id={`${id}-heading`} className="text-sm font-semibold">
            {title}
          </h2>
          <span className="text-xs tabular-nums text-muted-foreground" aria-label={`${total} tasks`}>
            {total}
          </span>
        </div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-4 py-5 text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <TaskList page={{ items, nextCursor: null }} today={today} />
          {seeAllHref && total > items.length ? (
            <Link
              href={seeAllHref}
              className="flex items-center justify-center gap-1.5 border-t px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              See all {total}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
