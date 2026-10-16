import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import type { Viewer } from "@/lib/permissions";
import type { Person } from "@/lib/tasks/types";

// Reads behind the team dashboard and the overview. Every query is scoped to viewer.orgId and one team.

export type TeamCounts = { active: number; completed: number; overdue: number; blocked: number; awaiting: number; unassigned: number };

/** The operational counts, in one query. `completed` is within the period starting at `since`. */
export async function teamCounts(viewer: Viewer, teamId: string, today: string, since: Date): Promise<TeamCounts> {
  const open = sql`${tasks.status} not in ('completed', 'rejected')`;
  const [row] = await db
    .select({
      active: sql<number>`count(*) filter (where ${open})::int`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed' and ${tasks.completedAt} >= ${since})::int`,
      overdue: sql<number>`count(*) filter (where ${open} and ${tasks.dueDate} < ${today}::date)::int`,
      blocked: sql<number>`count(*) filter (where ${tasks.status} = 'blocked')::int`,
      awaiting: sql<number>`count(*) filter (where ${tasks.status} = 'awaiting_approval')::int`,
      unassigned: sql<number>`count(*) filter (where ${open} and ${tasks.assigneeId} is null)::int`,
    })
    .from(tasks)
    .where(and(eq(tasks.orgId, viewer.orgId), eq(tasks.teamId, teamId)));
  return row ?? { active: 0, completed: 0, overdue: 0, blocked: 0, awaiting: 0, unassigned: 0 };
}

export type WorkloadRow = {
  person: Person | null;
  active: number;
  sizes: { s: number; m: number; l: number; none: number };
  blocked: number;
  overdue: number;
  awaiting: number;
  /** Open task titles, most pressing first (for the hover list). */
  titles: string[];
};

/** Who holds what: open tasks per assignee with their size mix, plus an "unassigned" row when there is one. */
export async function teamWorkload(viewer: Viewer, teamId: string, today: string): Promise<WorkloadRow[]> {
  const result = await db.execute<{
    id: string | null;
    name: string | null;
    email: string | null;
    image: string | null;
    active: number;
    s: number;
    m: number;
    l: number;
    none: number;
    blocked: number;
    overdue: number;
    awaiting: number;
    titles: string[];
  }>(sql`
    select u.id, u.name, u.email, u.image,
           count(*)::int as active,
           count(*) filter (where t.size = 's')::int as s,
           count(*) filter (where t.size = 'm')::int as m,
           count(*) filter (where t.size = 'l')::int as l,
           count(*) filter (where t.size is null)::int as none,
           count(*) filter (where t.status = 'blocked')::int as blocked,
           count(*) filter (where t.due_date < ${today}::date)::int as overdue,
           count(*) filter (where t.status = 'awaiting_approval')::int as awaiting,
           array_agg(t.title order by (case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end), t.due_date nulls last) as titles
    from tasks t
    left join users u on u.id = t.assignee_id
    where t.org_id = ${viewer.orgId} and t.team_id = ${teamId} and t.status not in ('completed', 'rejected')
    group by u.id, u.name, u.email, u.image
    order by (u.id is null), active desc, u.name`);
  return result.rows.map((row) => ({
    person: row.id ? { id: row.id, name: row.name, email: row.email, image: row.image } : null,
    active: row.active,
    sizes: { s: row.s, m: row.m, l: row.l, none: row.none },
    blocked: row.blocked,
    overdue: row.overdue,
    awaiting: row.awaiting,
    titles: row.titles,
  }));
}

export type FeedItem = {
  id: string;
  subject: { type: "task" | "request"; id: string; title: string };
  actor: Person;
  verb: string;
  note: string | null;
  at: string;
};

const TASK_VERBS: Record<string, string> = {
  blocked: "blocked",
  unblocked: "unblocked",
  approved: "approved",
  sent_back: "sent back",
  rejected: "rejected",
  completed: "completed",
  reopened: "reopened",
  due_changed: "moved the due date of",
  handed_over: "handed over",
};

const REQUEST_VERBS: Record<string, string> = {
  under_review: "started reviewing the request",
  approved: "approved the request",
  deferred: "deferred the request",
  rejected: "rejected the request",
  converted: "turned into a task the request",
  reopened: "reopened the request",
};

/**
 * Recent changes that matter (status moves, approvals, deadline changes, handovers, request decisions) for
 * these teams. Edits and progress updates are left out on purpose: this is the decisions feed, not a log.
 */
export async function teamFeed(viewer: Viewer, teamIds: string[], limit = 15): Promise<FeedItem[]> {
  if (teamIds.length === 0) return [];
  const teamList = sql.join(teamIds.map((teamId) => sql`${teamId}`), sql`, `);
  const result = await db.execute<{
    type: "task" | "request";
    id: string;
    kind: string;
    note: string | null;
    created_at: Date | string;
    subject_id: string;
    subject_title: string;
    actor_id: string;
    actor_name: string | null;
    actor_email: string | null;
    actor_image: string | null;
  }>(sql`
    select f.*, u.id as actor_id, u.name as actor_name, u.email as actor_email, u.image as actor_image
    from (
      select 'task' as type, a.id, a.kind::text as kind, a.note, a.created_at, a.actor_id as who, t.id as subject_id, t.title as subject_title
      from task_activity a join tasks t on t.id = a.task_id
      where t.org_id = ${viewer.orgId} and t.team_id in (${teamList})
        and a.kind in ('blocked', 'unblocked', 'approved', 'sent_back', 'rejected', 'completed', 'reopened', 'due_changed', 'handed_over')
      union all
      select 'request', d.id, d.decision::text, d.reason, d.created_at, d.decider_id, r.id, r.title
      from request_decisions d join requests r on r.id = d.request_id
      where r.org_id = ${viewer.orgId} and r.team_id in (${teamList})
    ) f
    join users u on u.id = f.who
    order by f.created_at desc
    limit ${limit}`);
  return result.rows.map((row) => ({
    id: row.id,
    subject: { type: row.type, id: row.subject_id, title: row.subject_title },
    actor: { id: row.actor_id, name: row.actor_name, email: row.actor_email, image: row.actor_image },
    verb: row.type === "task" ? (TASK_VERBS[row.kind] ?? "changed") : (REQUEST_VERBS[row.kind] ?? "decided on the request"),
    note: row.note,
    at: new Date(row.created_at).toISOString(),
  }));
}
