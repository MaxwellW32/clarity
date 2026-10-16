import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { db, type Tx } from "@/db";
import { organizationMembers, projects, requests, taskEvidenceLinks, tasks, teams, users } from "@/db/schema";
import type { TaskStatus } from "@/lib/constants";
import { listTeams } from "@/lib/dal/orgs";
import { isAdmin, isStakeholder, type Viewer } from "@/lib/permissions";
import type { TaskFilters, TaskSort } from "@/lib/tasks/filters";
import type { EvidenceLink, Person, TaskDetail, TaskFormOptions, TaskListItem, TaskPage } from "@/lib/tasks/types";

const CLOSED: TaskStatus[] = ["completed", "rejected"];
const assigneeUser = alias(users, "assignee_user");

/** Stakeholders see only tasks made from their own requests. */
function visibility(viewer: Viewer): SQL {
  const inOrg = eq(tasks.orgId, viewer.orgId);
  if (!isStakeholder(viewer)) return inOrg;
  return and(inOrg, sql`${tasks.requestId} in (select ${requests.id} from ${requests} where ${requests.requesterId} = ${viewer.userId})`)!;
}

// Sort keys are written against a table alias so the keyset cursor can compare the same expressions on the
// cursor's own row ("tasks" for the list, "cur" for the cursor). Every key sorts ascending; id breaks ties.
function sortKeys(sort: TaskSort, table: "tasks" | "cur", today: string): SQL[] {
  const col = (name: string) => sql.raw(`"${table}"."${name}"`);
  const open = sql`${col("status")} not in ('completed', 'rejected')`;
  const overdue = sql`(case when ${col("due_date")} < ${today}::date and ${open} then 0 else 1 end)`;
  const due = sql`coalesce(${col("due_date")}, '9999-12-31'::date)`;
  const priority = sql`(case ${col("priority")} when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end)`;
  const rank = sql`(-${col("sort_rank")})`;
  const updated = sql`(-extract(epoch from ${col("updated_at")}))`;
  const created = sql`(-extract(epoch from ${col("created_at")}))`;
  switch (sort) {
    case "due":
      return [due, priority, updated];
    case "priority":
      return [priority, due, updated];
    case "updated":
      return [updated];
    case "created":
      return [created];
    default:
      return [overdue, due, priority, rank, updated];
  }
}

const listColumns = {
  id: tasks.id,
  title: tasks.title,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  nextAction: tasks.nextAction,
  updatedAt: tasks.updatedAt,
  teamName: teams.name,
  assigneeId: assigneeUser.id,
  assigneeName: assigneeUser.name,
  assigneeEmail: assigneeUser.email,
  assigneeImage: assigneeUser.image,
};

type ListRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskListItem["priority"];
  dueDate: string | null;
  nextAction: string | null;
  updatedAt: Date;
  teamName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeImage: string | null;
};

function toListItem(row: ListRow): TaskListItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    nextAction: row.nextAction,
    teamName: row.teamName,
    updatedAt: row.updatedAt.toISOString(),
    assignee: row.assigneeId ? { id: row.assigneeId, name: row.assigneeName, email: row.assigneeEmail, image: row.assigneeImage } : null,
  };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (match) => `\\${match}`);

export const PAGE_SIZE = 50;

/** The task list: filters from the URL, one of five sorts, 50 at a time with a keyset cursor (a task id). */
export async function listTasks(viewer: Viewer, filters: TaskFilters, options: { today: string; cursor?: string | null; limit?: number }): Promise<TaskPage> {
  const limit = options.limit ?? PAGE_SIZE;
  const { today } = options;
  const where: SQL[] = [visibility(viewer)];
  if (filters.q) where.push(ilike(tasks.title, `%${escapeLike(filters.q)}%`));
  if (filters.status.length > 0) where.push(inArray(tasks.status, filters.status));
  else if (!filters.closed) where.push(notInArray(tasks.status, CLOSED));
  if (filters.assignee === "me") where.push(eq(tasks.assigneeId, viewer.userId));
  else if (filters.assignee === "none") where.push(isNull(tasks.assigneeId));
  else if (filters.assignee) where.push(eq(tasks.assigneeId, filters.assignee));
  if (filters.priority) where.push(eq(tasks.priority, filters.priority));
  if (filters.due === "overdue") where.push(sql`${tasks.dueDate} < ${today}::date`, notInArray(tasks.status, CLOSED));
  if (filters.due === "week") where.push(sql`${tasks.dueDate} between ${today}::date and ${today}::date + 6`);
  if (filters.due === "none") where.push(isNull(tasks.dueDate));
  if (filters.team) where.push(eq(tasks.teamId, filters.team));

  const keys = sortKeys(filters.sort, "tasks", today);
  if (options.cursor) {
    const cursorKeys = sortKeys(filters.sort, "cur", today);
    where.push(
      sql`(${sql.join([...keys, sql`${tasks.id}`], sql`, `)}) > (select ${sql.join([...cursorKeys, sql.raw(`"cur"."id"`)], sql`, `)} from "tasks" "cur" where "cur"."id" = ${options.cursor} and "cur"."org_id" = ${viewer.orgId})`,
    );
  }

  const rows = await db
    .select(listColumns)
    .from(tasks)
    .innerJoin(teams, eq(teams.id, tasks.teamId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, tasks.assigneeId))
    .where(and(...where))
    .orderBy(...keys.map((key) => sql`${key} asc`), asc(tasks.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit).map(toListItem);
  return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
}

/** Title search for the command palette. */
export async function searchTasks(viewer: Viewer, q: string): Promise<TaskListItem[]> {
  const term = q.trim().slice(0, 100);
  if (term === "") return [];
  const rows = await db
    .select(listColumns)
    .from(tasks)
    .innerJoin(teams, eq(teams.id, tasks.teamId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, tasks.assigneeId))
    .where(and(visibility(viewer), ilike(tasks.title, `%${escapeLike(term)}%`)))
    .orderBy(sql`(${tasks.status} in ('completed', 'rejected'))`, desc(tasks.updatedAt))
    .limit(8);
  return rows.map(toListItem);
}

/** Everything My Work groups, in one query: my open work, my last 14 days of finished work, approvals I owe. */
export async function myWorkTasks(viewer: Viewer) {
  const rows = await db
    .select({
      ...listColumns,
      assigneeRaw: tasks.assigneeId,
      approverId: tasks.approverId,
      sortRank: tasks.sortRank,
      completedAt: tasks.completedAt,
      lastStatusKind: sql<string | null>`(select a.kind::text from task_activity a where a.task_id = ${tasks.id} and a.kind in ('sent_back', 'approval_requested', 'approved', 'status_changed', 'blocked', 'unblocked', 'completed', 'reopened', 'rejected') order by a.created_at desc limit 1)`,
    })
    .from(tasks)
    .innerJoin(teams, eq(teams.id, tasks.teamId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, tasks.assigneeId))
    .where(
      and(
        visibility(viewer),
        or(
          and(
            eq(tasks.assigneeId, viewer.userId),
            or(notInArray(tasks.status, CLOSED), sql`(${tasks.status} = 'completed' and ${tasks.completedAt} > now() - interval '14 days')`),
          ),
          and(eq(tasks.approverId, viewer.userId), eq(tasks.status, "awaiting_approval")),
        ),
      ),
    );
  return rows.map((row) => ({
    item: toListItem(row),
    approverId: row.approverId,
    assigneeId: row.assigneeRaw,
    sortRank: row.sortRank,
    completedAt: row.completedAt,
    sentBack: row.status === "in_progress" && row.lastStatusKind === "sent_back",
  }));
}

const creatorUser = alias(users, "creator_user");
const approverUser = alias(users, "approver_user");

type PersonColumns = { id: AnyPgColumn; name: AnyPgColumn; email: AnyPgColumn; image: AnyPgColumn };
const personJson = (table: PersonColumns) => sql`json_build_object('id', ${table.id}, 'name', ${table.name}, 'email', ${table.email}, 'image', ${table.image})`;

/** One task with everything the detail page shows, plus the requester its permission check needs. */
export async function getTask(viewer: Viewer, id: string) {
  const [row] = await db
    .select({
      task: tasks,
      teamName: teams.name,
      projectName: projects.name,
      requestTitle: requests.title,
      requesterId: requests.requesterId,
      assignee: sql<Person | null>`case when ${assigneeUser.id} is null then null else ${personJson(assigneeUser)} end`,
      approver: sql<Person | null>`case when ${approverUser.id} is null then null else ${personJson(approverUser)} end`,
      creator: sql<Person>`${personJson(creatorUser)}`,
      lastUpdate: sql<{ author: Person; at: string } | null>`(select json_build_object('at', u.created_at, 'author', json_build_object('id', au.id, 'name', au.name, 'email', au.email, 'image', au.image)) from task_updates u join users au on au.id = u.author_id where u.task_id = ${tasks.id} order by u.created_at desc limit 1)`,
    })
    .from(tasks)
    .innerJoin(teams, eq(teams.id, tasks.teamId))
    .innerJoin(creatorUser, eq(creatorUser.id, tasks.createdBy))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(requests, eq(requests.id, tasks.requestId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, tasks.assigneeId))
    .leftJoin(approverUser, eq(approverUser.id, tasks.approverId))
    .where(and(eq(tasks.id, id), eq(tasks.orgId, viewer.orgId)));
  if (!row) return null;
  const t = row.task;
  const detail: TaskDetail = {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    size: t.size,
    dueDate: t.dueDate,
    team: { id: t.teamId, name: row.teamName },
    project: t.projectId && row.projectName ? { id: t.projectId, name: row.projectName } : null,
    assignee: row.assignee,
    approver: row.approver,
    creator: row.creator,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    blockedReason: t.blockedReason,
    blockedBy: t.blockedBy,
    rejectionReason: t.rejectionReason,
    latestProgress: t.latestProgress,
    nextAction: t.nextAction,
    completionSummary: t.completionSummary,
    lastUpdate: row.lastUpdate ? { author: row.lastUpdate.author, at: new Date(row.lastUpdate.at).toISOString() } : null,
    request: t.requestId && row.requestTitle ? { id: t.requestId, title: row.requestTitle } : null,
  };
  return {
    detail,
    scope: { orgId: t.orgId, teamId: t.teamId, assigneeId: t.assigneeId, createdBy: t.createdBy, approverId: t.approverId, requesterId: row.requesterId },
  };
}

export async function listEvidence(viewer: Viewer, taskId: string): Promise<EvidenceLink[]> {
  return db
    .select({ id: taskEvidenceLinks.id, url: taskEvidenceLinks.url, label: taskEvidenceLinks.label })
    .from(taskEvidenceLinks)
    .innerJoin(tasks, eq(tasks.id, taskEvidenceLinks.taskId))
    .where(and(eq(taskEvidenceLinks.taskId, taskId), eq(tasks.orgId, viewer.orgId)))
    .orderBy(asc(taskEvidenceLinks.createdAt));
}

/** The task row an action works on, locked for the transaction, with what its permission checks need. */
export async function lockTask(tx: Tx, orgId: string, id: string) {
  const [row] = await tx
    .select({ task: tasks, requesterId: requests.requesterId })
    .from(tasks)
    .leftJoin(requests, eq(requests.id, tasks.requestId))
    .where(and(eq(tasks.id, id), eq(tasks.orgId, orgId)))
    .for("update", { of: tasks });
  if (!row) return null;
  const t = row.task;
  return {
    task: t,
    scope: { orgId: t.orgId, teamId: t.teamId, assigneeId: t.assigneeId, createdBy: t.createdBy, approverId: t.approverId, requesterId: row.requesterId },
  };
}

/** Teams the viewer can create tasks in (admins: all), with members and active projects. */
export async function taskFormOptions(viewer: Viewer): Promise<TaskFormOptions> {
  if (isStakeholder(viewer)) return { viewerId: viewer.userId, teams: [] };
  const [allTeams, projectRows] = await Promise.all([
    listTeams(viewer),
    db
      .select({ id: projects.id, name: projects.name, teamId: projects.teamId })
      .from(projects)
      .where(and(eq(projects.orgId, viewer.orgId), eq(projects.status, "active")))
      .orderBy(asc(projects.name)),
  ]);
  const teamsForViewer = allTeams.filter((team) => isAdmin(viewer) || viewer.teamRoles.has(team.id));
  return {
    viewerId: viewer.userId,
    teams: teamsForViewer.map((team) => ({
      id: team.id,
      name: team.name,
      members: team.members.map((member) => ({ id: member.userId, name: member.name, email: member.email, image: member.image, role: member.role })),
      projects: projectRows.filter((project) => project.teamId === team.id).map(({ id, name }) => ({ id, name })),
    })),
  };
}

/** People who can take over or approve a task: its team, plus the org's admins (who may act as lead). */
export async function taskPeople(viewer: Viewer, taskId: string) {
  const teamOf = sql`(select ${tasks.teamId} from ${tasks} where ${tasks.id} = ${taskId} and ${tasks.orgId} = ${viewer.orgId})`;
  const rows = await db.execute<{ id: string; name: string | null; email: string | null; image: string | null; team_role: string | null; org_role: string }>(sql`
    select u.id, u.name, u.email, u.image, tm.role::text as team_role, m.role::text as org_role
    from ${organizationMembers} m
    join ${users} u on u.id = m.user_id
    left join ${teams} t on t.id = ${teamOf}
    left join team_members tm on tm.team_id = t.id and tm.user_id = u.id
    where m.org_id = ${viewer.orgId} and (tm.user_id is not null or m.role = 'admin')
    order by (tm.role = 'lead') desc nulls last, u.name`);
  return rows.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    onTeam: row.team_role !== null,
    lead: row.team_role === "lead",
    admin: row.org_role === "admin",
  }));
}

/** A task's basics and permission scope, org-scoped: for read actions and the update form. */
export async function getTaskBasics(viewer: Viewer, id: string) {
  const [row] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      teamId: tasks.teamId,
      assigneeId: tasks.assigneeId,
      createdBy: tasks.createdBy,
      approverId: tasks.approverId,
      nextAction: tasks.nextAction,
      latestProgress: tasks.latestProgress,
      blockedReason: tasks.blockedReason,
      blockedBy: tasks.blockedBy,
      requesterId: requests.requesterId,
    })
    .from(tasks)
    .leftJoin(requests, eq(requests.id, tasks.requestId))
    .where(and(eq(tasks.id, id), eq(tasks.orgId, viewer.orgId)));
  if (!row) return null;
  return { ...row, scope: { orgId: viewer.orgId, teamId: row.teamId, assigneeId: row.assigneeId, createdBy: row.createdBy, approverId: row.approverId, requesterId: row.requesterId } };
}
