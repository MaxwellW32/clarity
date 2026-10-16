import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { goals, teamExpectations, teams, users } from "@/db/schema";
import type { ExpectationKind, ExpectationStatus, GoalStatus } from "@/lib/constants";
import type { Viewer } from "@/lib/permissions";
import type { Person } from "@/lib/tasks/types";

export type GoalItem = {
  id: string;
  title: string;
  description: string | null;
  successCriteria: string | null;
  status: GoalStatus;
  owner: Person;
  team: { id: string; name: string } | null;
  targetDate: string | null;
  /** Linked work: how much, how much of it is done. Facts, not a score. */
  tasks: { total: number; completed: number; open: number };
  createdAt: string;
  updatedAt: string;
};

const ownerJson = sql<Person>`json_build_object('id', ${users.id}, 'name', ${users.name}, 'email', ${users.email}, 'image', ${users.image})`;
const taskCounts = sql<{ total: number; completed: number; open: number }>`(select json_build_object(
    'total', count(*)::int,
    'completed', count(*) filter (where t.status = 'completed')::int,
    'open', count(*) filter (where t.status not in ('completed', 'rejected'))::int)
  from tasks t where t.goal_id = ${goals.id})`;

function toItem(row: { goal: typeof goals.$inferSelect; teamName: string | null; owner: Person; tasks: GoalItem["tasks"] }): GoalItem {
  const g = row.goal;
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    successCriteria: g.successCriteria,
    status: g.status,
    owner: row.owner,
    team: g.teamId && row.teamName ? { id: g.teamId, name: row.teamName } : null,
    targetDate: g.targetDate,
    tasks: row.tasks,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

/** The organization's goals, nearest target date first. Everyone but stakeholders may read them. */
export async function listGoals(viewer: Viewer, statuses: GoalStatus[]): Promise<GoalItem[]> {
  const rows = await db
    .select({ goal: goals, teamName: teams.name, owner: ownerJson, tasks: taskCounts })
    .from(goals)
    .innerJoin(users, eq(users.id, goals.ownerId))
    .leftJoin(teams, eq(teams.id, goals.teamId))
    .where(and(eq(goals.orgId, viewer.orgId), statuses.length > 0 ? inArray(goals.status, statuses) : undefined))
    .orderBy(sql`${goals.targetDate} asc nulls last`, asc(goals.title));
  return rows.map(toItem);
}

export async function getGoal(viewer: Viewer, id: string): Promise<GoalItem | null> {
  const [row] = await db
    .select({ goal: goals, teamName: teams.name, owner: ownerJson, tasks: taskCounts })
    .from(goals)
    .innerJoin(users, eq(users.id, goals.ownerId))
    .leftJoin(teams, eq(teams.id, goals.teamId))
    .where(and(eq(goals.id, id), eq(goals.orgId, viewer.orgId)));
  return row ? toItem(row) : null;
}

export async function lockGoal(tx: Tx, orgId: string, id: string) {
  const [row] = await tx
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.orgId, orgId)))
    .for("update");
  return row ?? null;
}

// --- expectations -----------------------------------------------------------------------------------------------

export type ExpectationItem = {
  id: string;
  teamId: string;
  teamName: string;
  title: string;
  description: string | null;
  kind: ExpectationKind;
  targetCount: number | null;
  periodStart: string;
  periodEnd: string;
  status: ExpectationStatus;
  goal: { id: string; title: string } | null;
  /** Linked tasks: how many, how many completed. */
  linked: number;
  completed: number;
};

const expectationColumns = {
  expectation: teamExpectations,
  teamName: teams.name,
  goalTitle: goals.title,
  linked: sql<number>`(select count(*)::int from tasks t where t.expectation_id = ${teamExpectations.id})`,
  completed: sql<number>`(select count(*)::int from tasks t where t.expectation_id = ${teamExpectations.id} and t.status = 'completed')`,
};

function toExpectation(row: { expectation: typeof teamExpectations.$inferSelect; teamName: string; goalTitle: string | null; linked: number; completed: number }): ExpectationItem {
  const e = row.expectation;
  return {
    id: e.id,
    teamId: e.teamId,
    teamName: row.teamName,
    title: e.title,
    description: e.description,
    kind: e.kind,
    targetCount: e.targetCount,
    periodStart: e.periodStart,
    periodEnd: e.periodEnd,
    status: e.status,
    goal: e.goalId && row.goalTitle ? { id: e.goalId, title: row.goalTitle } : null,
    linked: row.linked,
    completed: row.completed,
  };
}

/** A team's agreed outcomes. Open ones first, then by period end. */
export async function listExpectations(viewer: Viewer, filter: { teamId?: string; goalId?: string; teamIds?: string[] }, includeClosed = true): Promise<ExpectationItem[]> {
  const rows = await db
    .select(expectationColumns)
    .from(teamExpectations)
    .innerJoin(teams, eq(teams.id, teamExpectations.teamId))
    .leftJoin(goals, eq(goals.id, teamExpectations.goalId))
    .where(
      and(
        eq(teamExpectations.orgId, viewer.orgId),
        filter.teamId ? eq(teamExpectations.teamId, filter.teamId) : undefined,
        filter.goalId ? eq(teamExpectations.goalId, filter.goalId) : undefined,
        filter.teamIds ? inArray(teamExpectations.teamId, filter.teamIds) : undefined,
        includeClosed ? undefined : eq(teamExpectations.status, "open"),
      ),
    )
    .orderBy(sql`(${teamExpectations.status} <> 'open')`, desc(teamExpectations.periodEnd), asc(teamExpectations.title));
  return rows.map(toExpectation);
}

export async function lockExpectation(tx: Tx, orgId: string, id: string) {
  const [row] = await tx
    .select()
    .from(teamExpectations)
    .where(and(eq(teamExpectations.id, id), eq(teamExpectations.orgId, orgId)))
    .for("update");
  return row ?? null;
}
