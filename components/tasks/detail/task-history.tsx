"use client";

import { ArrowRight } from "lucide-react";
import { Fragment, useState, useTransition } from "react";
import { loadHistory } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import type { HistoryItem, HistoryPage } from "@/lib/tasks/types";
import { toastResult } from "@/lib/toast-result";

const nameOf = (person: HistoryItem["actor"]) => person.name ?? person.email ?? "Someone";

function Entry({ item }: { item: HistoryItem }) {
  return (
    <li className="flex gap-3 py-2.5">
      <UserAvatar name={item.actor.name} email={item.actor.email} image={item.actor.image} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-sm">
            <span className="font-medium">{nameOf(item.actor)}</span> <span className="text-muted-foreground">{item.phrase}</span>
          </p>
          <time dateTime={item.at} title={item.absolute} className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
            {item.time}
          </time>
        </div>
        {item.change ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{item.change.before ?? "—"}</span>
            <ArrowRight className="size-3" aria-hidden />
            <span className="text-foreground">{item.change.after ?? "—"}</span>
          </p>
        ) : null}
        {item.type === "update" ? (
          <div className="mt-1.5 grid gap-1 rounded-md bg-muted/60 px-3 py-2 text-sm">
            {item.progress ? <p className="whitespace-pre-line">{item.progress}</p> : null}
            {item.nextAction ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground/80">Next:</span> {item.nextAction}
              </p>
            ) : null}
            {item.blocker ? (
              <p className="text-status-blocked-fg">
                <span className="font-medium">Blocked:</span> {item.blocker}
              </p>
            ) : null}
          </div>
        ) : item.note ? (
          <p className="mt-1 text-sm text-muted-foreground italic">“{item.note}”</p>
        ) : null}
      </div>
    </li>
  );
}

/** Updates and audit events, newest first, grouped by day, 20 at a time. */
export function TaskHistory({ taskId, initial }: { taskId: string; initial: HistoryPage }) {
  // Earlier pages are keyed to the first page the server sent: after an action refreshes the page, `initial`
  // is a new object, so the list starts over from the fresh first page instead of showing stale state.
  const [extra, setExtra] = useState<{ key: HistoryPage; pages: HistoryPage[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const pages = extra !== null && extra.key === initial ? [initial, ...extra.pages] : [initial];
  const items = pages.flatMap((page) => page.items);
  const cursor = pages[pages.length - 1].nextCursor;

  return (
    <section aria-labelledby="history-heading" className="rounded-xl border bg-card">
      <h2 id="history-heading" className="border-b px-5 py-3 text-sm font-semibold md:px-6">
        History
      </h2>
      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground md:px-6">Nothing has happened yet.</p>
      ) : (
        <ol className="px-5 py-2 md:px-6">
          {items.map((item, index) => {
            const newDay = index === 0 || items[index - 1].day !== item.day;
            return (
              <Fragment key={item.id}>
                {newDay ? (
                  <li className={index === 0 ? "pt-1" : "pt-4"} aria-hidden>
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{item.dayLabel}</p>
                  </li>
                ) : null}
                <Entry item={item} />
              </Fragment>
            );
          })}
        </ol>
      )}
      {cursor ? (
        <div className="flex justify-center border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await loadHistory({ taskId, cursor });
                if (toastResult(result)) setExtra((current) => ({ key: initial, pages: [...(current !== null && current.key === initial ? current.pages : []), result.data] }));
              })
            }
          >
            {pending ? "Loading…" : "Show earlier"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
