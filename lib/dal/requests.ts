import "server-only";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "@/db";
import { requestDecisions, requests, tasks, teams, users } from "@/db/schema";
import type { RequestStatus } from "@/lib/constants";
import { managedTeamIds } from "@/lib/dal/orgs";
import { attentionTasks } from "@/lib/dal/tasks";
import { isStakeholder, type Viewer } from "@/lib/permissions";
import type { RequestDecisionItem, RequestDetail, RequestFilters, RequestListItem, RequestView } from "@/lib/requests/types";
import type { Person, TaskListItem } from "@/lib/tasks/types";

const requesterUser = alias(users, "requester_user");
const deciderUser = alias(users, "decider_user");

/** Stakeholders see only what they asked for; everyone else sees the whole organization's requests. */
function visibility(viewer: Viewer): SQL {
  const inOrg = eq(requests.orgId, viewer.orgId);
  return isStakeholder(viewer) ? and(inOrg, eq(requests.requesterId, viewer.userId))! : inOrg;
}

export const VIEW_STATUSES: Record<RequestView, RequestStatus[]> = {
  open: ["new", "under_review"],
  deferred: ["deferred"],
  decided: ["approved", "converted", "rejected"],
  all: [],
};

const urgencyRank = sql`(case ${requests.urgency} when 'critical' then 0 when 'high' then 1 when 'normal' then 2 else 3 end)`;

const listColumns = {
  id: requests.id,
  title: requests.title,
  status: requests.status,
  urgency: requests.urgency,
  teamId: requests.teamId,
  teamName: teams.name,
  createdAt: requests.createdAt,
  decidedAt: requests.decidedAt,
  deferUntil: requests.deferUntil,
  requesterId: requesterUser.id,
  requesterName: requesterUser.name,
  requesterEmail: requesterUser.email,
  requesterImage: requesterUser.image,
  taskId: tasks.id,
  taskStatus: tasks.status,
};

type ListRow = {
  id: string;
  title: string;
  status: RequestStatus;
  urgency: RequestListItem["urgency"];
  teamId: string;
  teamName: string;
  createdAt: Date;
  decidedAt: Date | null;
  deferUntil: string | null;
  requesterId: string;
  requesterName: string | null;
  requesterEmail: string | null;
  requesterImage: string | null;
  taskId: string | null;
  taskStatus: TaskListItem["status"] | null;
};

function toListItem(row: ListRow): RequestListItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    urgency: row.urgency,
    teamId: row.teamId,
    teamName: row.teamName,
    requester: { id: row.requesterId, name: row.requesterName, email: row.requesterEmail, image: row.requesterImage },
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    deferUntil: row.deferUntil,
    task: row.taskId && row.taskStatus ? { id: row.taskId, status: row.taskStatus } : null,
  };
}

function baseQuery() {
  return db
    .select(listColumns)
    .from(requests)
    .innerJoin(teams, eq(teams.id, requests.teamId))
    .innerJoin(requesterUser, eq(requesterUser.id, requests.requesterId))
    .leftJoin(tasks, eq(tasks.id, requests.convertedTaskId));
}

/** The requests list. Open ones come oldest-first (they have waited longest); everything else newest-first. */
export async function listRequests(viewer: Viewer, filters: RequestFilters, limit = 200): Promise<RequestListItem[]> {
  const where: SQL[] = [visibility(viewer)];
  const statuses = VIEW_STATUSES[filters.view];
  if (statuses.length > 0) where.push(inArray(requests.status, statuses));
  if (filters.team) where.push(eq(requests.teamId, filters.team));
  if (filters.mine) where.push(eq(requests.requesterId, viewer.userId));
  const rows = await baseQuery()
    .where(and(...where))
    .orderBy(...(filters.view === "open" ? [urgencyRank, asc(requests.createdAt)] : [desc(requests.createdAt)]))
    .limit(limit);
  return rows.map(toListItem);
}

/** One request with its decision history and, when converted, the task it became. */
export async function getRequest(viewer: Viewer, id: string): Promise<{ detail: RequestDetail; scope: { orgId: string; teamId: string; requesterId: string } } | null> {
  const [row] = await db
    .select({
      request: requests,
      teamName: teams.name,
      requester: sql<Person>`json_build_object('id', ${requesterUser.id}, 'name', ${requesterUser.name}, 'email', ${requesterUser.email}, 'image', ${requesterUser.image})`,
      decidedBy: sql<Person | null>`case when ${deciderUser.id} is null then null else json_build_object('id', ${deciderUser.id}, 'name', ${deciderUser.name}, 'email', ${deciderUser.email}, 'image', ${deciderUser.image}) end`,
      task: sql<RequestDetail["task"]>`(select json_build_object('id', t.id, 'title', t.title, 'status', t.status, 'nextAction', t.next_action, 'latestProgress', t.latest_progress,
          'assignee', case when a.id is null then null else json_build_object('id', a.id, 'name', a.name, 'email', a.email, 'image', a.image) end)
        from ${tasks} t left join ${users} a on a.id = t.assignee_id where t.id = ${requests.convertedTaskId})`,
      decisions: sql<(Omit<RequestDecisionItem, "at"> & { at: string })[]>`coalesce((select json_agg(json_build_object('id', d.id, 'decision', d.decision, 'reason', d.reason, 'at', d.created_at,
          'decider', json_build_object('id', du.id, 'name', du.name, 'email', du.email, 'image', du.image)) order by d.created_at desc)
        from ${requestDecisions} d join ${users} du on du.id = d.decider_id where d.request_id = ${requests.id}), '[]'::json)`,
    })
    .from(requests)
    .innerJoin(teams, eq(teams.id, requests.teamId))
    .innerJoin(requesterUser, eq(requesterUser.id, requests.requesterId))
    .leftJoin(deciderUser, eq(deciderUser.id, requests.decidedBy))
    .where(and(eq(requests.id, id), eq(requests.orgId, viewer.orgId)));
  if (!row) return null;
  const r = row.request;
  return {
    detail: {
      id: r.id,
      title: r.title,
      description: r.description,
      desiredOutcome: r.desiredOutcome,
      urgency: r.urgency,
      link: r.link,
      status: r.status,
      team: { id: r.teamId, name: row.teamName },
      requester: row.requester,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      decidedBy: row.decidedBy,
      decisionReason: r.decisionReason,
      deferUntil: r.deferUntil,
      task: row.task,
      decisions: row.decisions.map((decision) => ({ ...decision, at: new Date(decision.at).toISOString() })),
    },
    scope: { orgId: r.orgId, teamId: r.teamId, requesterId: r.requesterId },
  };
}

/** The request row an action works on, locked for the transaction. */
export async function lockRequest(tx: Tx, orgId: string, id: string) {
  const [row] = await tx
    .select()
    .from(requests)
    .where(and(eq(requests.id, id), eq(requests.orgId, orgId)))
    .for("update");
  return row ?? null;
}

export type ReviewQueue = {
  teamIds: string[];
  pending: RequestListItem[];
  deferred: RequestListItem[];
  decided: RequestListItem[];
  attention: TaskListItem[];
};

/** The weekly review, for the teams the viewer manages: decisions owed, deferrals to revisit, commitments at risk, and what was decided lately. */
export async function reviewQueue(viewer: Viewer, today: string): Promise<ReviewQueue> {
  const teamIds = await managedTeamIds(viewer);
  if (teamIds.length === 0) return { teamIds, pending: [], deferred: [], decided: [], attention: [] };
  const scoped = and(eq(requests.orgId, viewer.orgId), inArray(requests.teamId, teamIds));
  const [pending, deferred, decided, attention] = await Promise.all([
    baseQuery()
      .where(and(scoped, inArray(requests.status, ["new", "under_review"])))
      .orderBy(urgencyRank, asc(requests.createdAt)),
    baseQuery()
      .where(and(scoped, eq(requests.status, "deferred")))
      .orderBy(sql`${requests.deferUntil} asc nulls last`, asc(requests.createdAt)),
    baseQuery()
      .where(and(scoped, inArray(requests.status, ["approved", "converted", "rejected"]), sql`${requests.decidedAt} > now() - interval '7 days'`))
      .orderBy(desc(requests.decidedAt)),
    attentionTasks(viewer, teamIds, today, 30),
  ]);
  return { teamIds, pending: pending.map(toListItem), deferred: deferred.map(toListItem), decided: decided.map(toListItem), attention };
}

/** How many requests await a decision in these teams (dashboards). */
export async function countPendingRequests(viewer: Viewer, teamIds: string[]): Promise<number> {
  if (teamIds.length === 0) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(requests)
    .where(and(eq(requests.orgId, viewer.orgId), inArray(requests.teamId, teamIds), inArray(requests.status, ["new", "under_review"])));
  return row?.n ?? 0;
}
