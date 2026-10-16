"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { goals, organizationMembers, teamExpectations } from "@/db/schema";
import { GuardError, ok, runAction, type ActionResult } from "@/lib/action-result";
import { EXPECTATION_KINDS, EXPECTATION_STATUSES, GOAL_STATUSES } from "@/lib/constants";
import { lockExpectation, lockGoal } from "@/lib/dal/goals";
import { findTeam } from "@/lib/dal/orgs";
import { log } from "@/lib/log";
import { canManageGoal, leadsTeam } from "@/lib/permissions";
import { requireViewer } from "@/lib/viewer";

const id = z.string().min(1).max(64);
const optionalText = (max: number) => z.string().trim().max(max).default("");
const day = z.union([z.literal(""), z.iso.date({ error: "Pick a date." })]).default("");

async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)));
  return row !== undefined;
}

// --- goals ----------------------------------------------------------------------------------------------------------

const goalFields = {
  title: z.string().trim().min(1, "Give the goal a title.").max(200),
  description: optionalText(4000),
  successCriteria: optionalText(2000),
  /** Empty = an organization-wide goal (admins only). */
  teamId: z.string().max(64).default(""),
  ownerId: z.string().max(64).default(""),
  targetDate: day,
};

const createGoalSchema = z.object(goalFields);

export async function createGoal(input: z.input<typeof createGoalSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction("goals.create", createGoalSchema, input, async (data) => {
    const viewer = await requireViewer();
    const teamId = data.teamId || null;
    if (teamId !== null && (await findTeam(db, viewer.orgId, teamId)) === null) throw new GuardError("not_found");
    if (!canManageGoal(viewer, teamId)) throw new GuardError("forbidden");
    const ownerId = data.ownerId || viewer.userId;
    if (!(await isOrgMember(viewer.orgId, ownerId))) throw new GuardError("forbidden", "The owner must be a member of the organization.");
    const [created] = await db
      .insert(goals)
      .values({ orgId: viewer.orgId, teamId, title: data.title, description: data.description || null, successCriteria: data.successCriteria || null, ownerId, targetDate: data.targetDate || null })
      .returning({ id: goals.id });
    log.info("goals.created", { orgId: viewer.orgId, goalId: created.id, by: viewer.userId });
    refresh();
    return ok({ id: created.id }, "Goal created.");
  });
}

const updateGoalSchema = z.object({ goalId: id, ...goalFields });

export async function updateGoal(input: z.input<typeof updateGoalSchema>): Promise<ActionResult> {
  return runAction("goals.update", updateGoalSchema, input, async (data) => {
    const viewer = await requireViewer();
    await db.transaction(async (tx) => {
      const goal = await lockGoal(tx, viewer.orgId, data.goalId);
      if (goal === null) throw new GuardError("not_found");
      if (!canManageGoal(viewer, goal.teamId)) throw new GuardError("forbidden");
      const teamId = data.teamId || null;
      if (teamId !== goal.teamId && !canManageGoal(viewer, teamId)) throw new GuardError("forbidden");
      if (teamId !== null && (await findTeam(tx, viewer.orgId, teamId)) === null) throw new GuardError("not_found");
      const ownerId = data.ownerId || goal.ownerId;
      if (ownerId !== goal.ownerId && !(await isOrgMember(viewer.orgId, ownerId))) throw new GuardError("forbidden", "The owner must be a member of the organization.");
      await tx
        .update(goals)
        .set({ title: data.title, description: data.description || null, successCriteria: data.successCriteria || null, teamId, ownerId, targetDate: data.targetDate || null, updatedAt: new Date() })
        .where(eq(goals.id, goal.id));
    });
    refresh();
    return ok(undefined, "Goal saved.");
  });
}

const goalStatusSchema = z.object({ goalId: id, status: z.enum(GOAL_STATUSES) });

export async function setGoalStatus(input: z.input<typeof goalStatusSchema>): Promise<ActionResult> {
  return runAction("goals.status", goalStatusSchema, input, async (data) => {
    const viewer = await requireViewer();
    await db.transaction(async (tx) => {
      const goal = await lockGoal(tx, viewer.orgId, data.goalId);
      if (goal === null) throw new GuardError("not_found");
      if (!canManageGoal(viewer, goal.teamId)) throw new GuardError("forbidden");
      await tx.update(goals).set({ status: data.status, updatedAt: new Date() }).where(eq(goals.id, goal.id));
    });
    refresh();
    return ok(undefined, data.status === "achieved" ? "Marked achieved." : data.status === "dropped" ? "Goal dropped." : "Goal is active again.");
  });
}

// --- expectations --------------------------------------------------------------------------------------------------

const createExpectationSchema = z
  .object({
    teamId: id,
    title: z.string().trim().min(1, "Say what is expected.").max(200),
    description: optionalText(2000),
    kind: z.enum(EXPECTATION_KINDS).default("milestone"),
    targetCount: z.coerce.number().int().min(1).max(1000).optional(),
    periodStart: z.iso.date({ error: "Pick when the period starts." }),
    periodEnd: z.iso.date({ error: "Pick when the period ends." }),
    goalId: z.string().max(64).default(""),
  })
  .refine((value) => value.periodEnd >= value.periodStart, { path: ["periodEnd"], message: "The period must end after it starts." })
  .refine((value) => value.kind !== "count" || value.targetCount !== undefined, { path: ["targetCount"], message: "How many count as done?" });

/** A lead's agreed outcome for a period: a milestone, or a number of deliverables. */
export async function createExpectation(input: z.input<typeof createExpectationSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction("expectations.create", createExpectationSchema, input, async (data) => {
    const viewer = await requireViewer();
    if ((await findTeam(db, viewer.orgId, data.teamId)) === null) throw new GuardError("not_found");
    if (!leadsTeam(viewer, data.teamId)) throw new GuardError("forbidden");
    if (data.goalId) {
      const [goal] = await db.select({ teamId: goals.teamId }).from(goals).where(and(eq(goals.id, data.goalId), eq(goals.orgId, viewer.orgId)));
      if (!goal || (goal.teamId !== null && goal.teamId !== data.teamId)) throw new GuardError("not_found", "That goal isn't available to this team.");
    }
    const [created] = await db
      .insert(teamExpectations)
      .values({
        orgId: viewer.orgId,
        teamId: data.teamId,
        title: data.title,
        description: data.description || null,
        kind: data.kind,
        targetCount: data.kind === "count" ? (data.targetCount ?? null) : null,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        goalId: data.goalId || null,
      })
      .returning({ id: teamExpectations.id });
    refresh();
    return ok({ id: created.id }, "Expectation added.");
  });
}

const expectationStatusSchema = z.object({ expectationId: id, status: z.enum(EXPECTATION_STATUSES) });

export async function setExpectationStatus(input: z.input<typeof expectationStatusSchema>): Promise<ActionResult> {
  return runAction("expectations.status", expectationStatusSchema, input, async (data) => {
    const viewer = await requireViewer();
    await db.transaction(async (tx) => {
      const expectation = await lockExpectation(tx, viewer.orgId, data.expectationId);
      if (expectation === null) throw new GuardError("not_found");
      if (!leadsTeam(viewer, expectation.teamId)) throw new GuardError("forbidden");
      await tx.update(teamExpectations).set({ status: data.status }).where(eq(teamExpectations.id, expectation.id));
    });
    refresh();
    return ok(undefined, data.status === "met" ? "Marked met." : data.status === "missed" ? "Marked missed." : "Reopened.");
  });
}

const deleteExpectationSchema = z.object({ expectationId: id });

export async function deleteExpectation(input: z.input<typeof deleteExpectationSchema>): Promise<ActionResult> {
  return runAction("expectations.delete", deleteExpectationSchema, input, async (data) => {
    const viewer = await requireViewer();
    await db.transaction(async (tx) => {
      const expectation = await lockExpectation(tx, viewer.orgId, data.expectationId);
      if (expectation === null) throw new GuardError("not_found");
      if (!leadsTeam(viewer, expectation.teamId)) throw new GuardError("forbidden");
      await tx.delete(teamExpectations).where(eq(teamExpectations.id, expectation.id));
    });
    refresh();
    return ok(undefined, "Expectation removed.");
  });
}
