"use server";

import { and, eq, like, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { tasks, teams } from "@/db/schema";
import { fail, GuardError, ok, runAction, type ActionResult } from "@/lib/action-result";
import { deleteSampleData, insertSampleData, SAMPLE_TAG } from "@/lib/demo/sample";
import { log } from "@/lib/log";
import { canManageOrg } from "@/lib/permissions";
import { requireViewer } from "@/lib/viewer";

const schema = z.object({ teamId: z.string().max(64).default("") });

/** Admins can load clearly-labelled sample work to see how Clarity reads before the team has real tasks. */
export async function loadSampleData(input: z.input<typeof schema>): Promise<ActionResult> {
  return runAction("demo.load", schema, input, async (data) => {
    const viewer = await requireViewer();
    if (!canManageOrg(viewer)) throw new GuardError("forbidden");
    const outcome = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(eq(tasks.orgId, viewer.orgId), like(tasks.title, `${SAMPLE_TAG}%`)));
      if ((existing?.n ?? 0) > 0) return "Sample data is already loaded. Remove it first if you want a fresh set.";
      const [team] = data.teamId
        ? await tx.select({ id: teams.id }).from(teams).where(and(eq(teams.id, data.teamId), eq(teams.orgId, viewer.orgId)))
        : await tx.select({ id: teams.id }).from(teams).where(eq(teams.orgId, viewer.orgId)).orderBy(teams.createdAt).limit(1);
      if (!team) return "Create a team first; sample work belongs to a team.";
      await insertSampleData(tx, { orgId: viewer.orgId, teamId: team.id, userId: viewer.userId });
      return null;
    });
    if (outcome !== null) return fail(outcome);
    log.info("demo.loaded", { orgId: viewer.orgId, by: viewer.userId });
    refresh();
    return ok(undefined, "Sample data loaded. Every sample item starts with “Sample ·”.");
  });
}

export async function removeSampleData(): Promise<ActionResult> {
  return runAction("demo.remove", z.object({}), {}, async () => {
    const viewer = await requireViewer();
    if (!canManageOrg(viewer)) throw new GuardError("forbidden");
    await db.transaction((tx) => deleteSampleData(tx, viewer.orgId));
    log.info("demo.removed", { orgId: viewer.orgId, by: viewer.userId });
    refresh();
    return ok(undefined, "Sample data removed.");
  });
}
