import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { goals, requests, tasks, teams, users } from "@/db/schema";
import type { TaskPriority, TaskSize, TaskStatus } from "@/lib/constants";
import type { Viewer } from "@/lib/permissions";
import type { Person } from "@/lib/tasks/types";

// Row reads shared by the three reports. Everything is scoped to the viewer's organization in SQL, and every
// number a report prints comes straight from these rows: nothing is estimated.

export type ReportTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  size: TaskSize | null;
  teamName: string;
  assignee: Person | null;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  completionSummary: string | null;
  impactNote: string | null;
  nextAction: string | null;
  blockedReason: string | null;
  blockedBy: string | null;
  goal: { id: string; title: string } | null;
  evidence: { url: string; label: string | null }[];
  /** Whether the task was ever marked blocked (a solved problem, when it is now complete). */
  wasBlocked: boolean;
};

const assigneeUser = alias(users, "report_assignee");

/** Tasks matching `where`, with everything a report prints about them. */
export async function reportTasks(viewer: Viewer, where: SQL | undefined, order: "completed" | "due" | "updated" = "completed", limit = 500): Promise<ReportTask[]> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      size: tasks.size,
      teamName: teams.name,
      assignee: sql<Person | null>`case when ${assigneeUser.id} is null then null else json_build_object('id', ${assigneeUser.id}, 'name', ${assigneeUser.name}, 'email', ${assigneeUser.email}, 'image', ${assigneeUser.image}) end`,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      completedAt: tasks.completedAt,
      completionSummary: tasks.completionSummary,
      impactNote: tasks.impactNote,
      nextAction: tasks.nextAction,
      blockedReason: tasks.blockedReason,
      blockedBy: tasks.blockedBy,
      goalId: goals.id,
      goalTitle: goals.title,
      evidence: sql<{ url: string; label: string | null }[]>`coalesce((select json_agg(json_build_object('url', e.url, 'label', e.label) order by e.created_at) from task_evidence_links e where e.task_id = ${tasks.id}), '[]'::json)`,
      wasBlocked: sql<boolean>`exists (select 1 from task_activity a where a.task_id = ${tasks.id} and a.kind = 'blocked')`,
    })
    .from(tasks)
    .innerJoin(teams, eq(teams.id, tasks.teamId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, tasks.assigneeId))
    .leftJoin(goals, eq(goals.id, tasks.goalId))
    .where(and(eq(tasks.orgId, viewer.orgId), where))
    .orderBy(
      ...(order === "completed"
        ? [desc(tasks.completedAt)]
        : order === "due"
          ? [sql`coalesce(${tasks.dueDate}, '9999-12-31'::date)`, asc(tasks.title)]
          : [desc(tasks.updatedAt)]),
    )
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    goal: row.goalId && row.goalTitle ? { id: row.goalId, title: row.goalTitle } : null,
  }));
}

/** SQL fragments for the common slices. Ranges are calendar days in the viewer's timezone. */
export const slice = {
  team: (teamId: string | null) => (teamId ? eq(tasks.teamId, teamId) : undefined),
  teams: (teamIds: string[]) => (teamIds.length > 0 ? inArray(tasks.teamId, teamIds) : undefined),
  assignee: (userId: string) => eq(tasks.assigneeId, userId),
  open: () => sql`${tasks.status} not in ('completed', 'rejected')`,
  completedBetween: (from: string, to: string, timeZone: string) =>
    and(eq(tasks.status, "completed"), isNotNull(tasks.completedAt), sql`(${tasks.completedAt} at time zone ${timeZone})::date between ${from}::date and ${to}::date`),
  dueBetween: (from: string, to: string) => sql`${tasks.dueDate} between ${from}::date and ${to}::date`,
  overdue: (today: string) => and(sql`${tasks.status} not in ('completed', 'rejected')`, sql`${tasks.dueDate} < ${today}::date`),
  status: (status: TaskStatus) => eq(tasks.status, status),
};

export type ReportRequest = { id: string; title: string; status: string; urgency: string; requester: Person; createdAt: string; teamName: string };

/** Requests still waiting for a decision in these teams (or the whole org). */
export async function pendingRequests(viewer: Viewer, teamId: string | null): Promise<ReportRequest[]> {
  const requester = alias(users, "report_requester");
  const rows = await db
    .select({
      id: requests.id,
      title: requests.title,
      status: requests.status,
      urgency: requests.urgency,
      createdAt: requests.createdAt,
      teamName: teams.name,
      requester: sql<Person>`json_build_object('id', ${requester.id}, 'name', ${requester.name}, 'email', ${requester.email}, 'image', ${requester.image})`,
    })
    .from(requests)
    .innerJoin(teams, eq(teams.id, requests.teamId))
    .innerJoin(requester, eq(requester.id, requests.requesterId))
    .where(and(eq(requests.orgId, viewer.orgId), inArray(requests.status, ["new", "under_review"]), teamId ? eq(requests.teamId, teamId) : undefined))
    .orderBy(asc(requests.createdAt));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
