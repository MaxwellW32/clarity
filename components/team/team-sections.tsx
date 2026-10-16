import { cn } from "cn";
import { AlertCircle, CheckCircle2, Circle, Clock, OctagonAlert, UserX, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import type { FeedItem, TeamCounts, WorkloadRow } from "@/lib/dal/team";
import { tasksHref } from "@/lib/tasks/filters";
import { formatRelative } from "@/lib/time";

// --- A. counts ------------------------------------------------------------------------------------------------

type Tile = { key: keyof TeamCounts; label: string; icon: LucideIcon; tone: string; href: string };

/** Six operational counts. Each is a link to the tasks it counts; none of them is a rating. */
export function CountTiles({ counts, teamId, days }: { counts: TeamCounts; teamId: string; days: number }) {
  const tiles: Tile[] = [
    { key: "active", label: "Active", icon: Circle, tone: "text-status-in-progress-dot", href: tasksHref({ team: teamId }) },
    { key: "completed", label: `Completed · ${days}d`, icon: CheckCircle2, tone: "text-status-completed-dot", href: tasksHref({ team: teamId, status: ["completed"], closed: true, sort: "updated" }) },
    { key: "overdue", label: "Overdue", icon: AlertCircle, tone: "text-priority-urgent", href: tasksHref({ team: teamId, due: "overdue" }) },
    { key: "blocked", label: "Blocked", icon: OctagonAlert, tone: "text-status-blocked-dot", href: tasksHref({ team: teamId, status: ["blocked"] }) },
    { key: "awaiting", label: "Awaiting approval", icon: Clock, tone: "text-status-awaiting-dot", href: tasksHref({ team: teamId, status: ["awaiting_approval"] }) },
    { key: "unassigned", label: "Unassigned", icon: UserX, tone: "text-muted-foreground", href: tasksHref({ team: teamId, assignee: "none" }) },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Work overview">
      {tiles.map(({ key, label, icon: Icon, tone, href }) => {
        const value = counts[key];
        const quiet = value === 0 && key !== "active" && key !== "completed";
        return (
          <li key={key}>
            <Link href={href} className="block rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={cn("size-3.5", quiet ? "text-muted-foreground/50" : tone)} aria-hidden />
              </div>
              <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", quiet && "text-muted-foreground")}>{value}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// --- C. workload ------------------------------------------------------------------------------------------------

const nameOf = (person: { name: string | null; email: string | null } | null) => person?.name ?? person?.email ?? "Unassigned";

/** One row per person: how much they hold and how big it is, with trouble counts. Hover for the titles. */
export function Workload({ rows, teamId }: { rows: WorkloadRow[]; teamId: string }) {
  if (rows.length === 0) return <p className="px-4 py-4 text-sm text-muted-foreground">Nobody holds open work right now.</p>;
  const max = Math.max(...rows.map((row) => row.active), 1);
  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const sizes = [row.sizes.l > 0 ? `${row.sizes.l} L` : null, row.sizes.m > 0 ? `${row.sizes.m} M` : null, row.sizes.s > 0 ? `${row.sizes.s} S` : null, row.sizes.none > 0 ? `${row.sizes.none} unsized` : null].filter(Boolean).join(" · ");
        return (
          <li key={row.person?.id ?? "unassigned"} title={row.titles.join("\n")}>
            <Link href={tasksHref({ team: teamId, assignee: row.person?.id ?? "none" })} className="block px-4 py-3 transition-colors hover:bg-accent/60">
              <div className="flex items-center gap-3">
                {row.person ? (
                  <UserAvatar name={row.person.name} email={row.person.email} image={row.person.image} size="sm" />
                ) : (
                  <span className="size-6 shrink-0 rounded-full border border-dashed" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm font-medium", row.person === null && "text-muted-foreground")}>{nameOf(row.person)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {row.active} active{sizes ? ` · ${sizes}` : ""}
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${Math.round((row.active / max) * 100)}%` }} />
                  </span>
                  {row.blocked + row.overdue + row.awaiting > 0 ? (
                    <span className="mt-1.5 flex flex-wrap gap-x-3 text-[11px]">
                      {row.overdue > 0 ? <span className="text-priority-urgent">{row.overdue} overdue</span> : null}
                      {row.blocked > 0 ? <span className="text-status-blocked-fg">{row.blocked} blocked</span> : null}
                      {row.awaiting > 0 ? <span className="text-status-awaiting-fg">{row.awaiting} awaiting approval</span> : null}
                    </span>
                  ) : null}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// --- E. recent decisions ----------------------------------------------------------------------------------------

/** The decisions feed: who changed what that mattered, newest first. */
export function DecisionsFeed({ items, now, timeZone }: { items: FeedItem[]; now: Date; timeZone: string }) {
  if (items.length === 0) return <p className="px-4 py-4 text-sm text-muted-foreground">No important changes yet.</p>;
  return (
    <ol className="divide-y">
      {items.map((item) => (
        <li key={`${item.subject.type}-${item.id}`} className="flex gap-3 px-4 py-2.5">
          <UserAvatar name={item.actor.name} email={item.actor.email} image={item.actor.image} size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">{nameOf(item.actor)}</span> <span className="text-muted-foreground">{item.verb}</span>{" "}
              <Link href={item.subject.type === "task" ? `/tasks/${item.subject.id}` : `/requests/${item.subject.id}`} className="font-medium underline-offset-4 hover:underline">
                {item.subject.title}
              </Link>
            </p>
            {item.note ? <p className="mt-0.5 truncate text-xs text-muted-foreground italic">“{item.note}”</p> : null}
          </div>
          <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">{formatRelative(new Date(item.at), now, timeZone)}</span>
        </li>
      ))}
    </ol>
  );
}
