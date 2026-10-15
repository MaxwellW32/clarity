"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { teamMembers, teams } from "@/db/schema";
import { fail, GuardError, ok, runAction, type ActionResult } from "@/lib/action-result";
import { TEAM_ROLES } from "@/lib/constants";
import { findMembership, findTeam } from "@/lib/dal/orgs";
import { requireOrgAdmin } from "@/lib/guards";
import { log } from "@/lib/log";

const createSchema = z.object({
  name: z.string().trim().min(2, "Give the team a name (2 characters or more).").max(60),
  description: z.string().trim().max(200).optional(),
  /** Add the creator as the team's lead. */
  lead: z.boolean().default(true),
});

export async function createTeam(input: z.input<typeof createSchema>): Promise<ActionResult<{ teamId: string }>> {
  return runAction("teams.create", createSchema, input, async (data) => {
    const { viewer } = await requireOrgAdmin();
    const teamId = await db.transaction(async (tx) => {
      const [clash] = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.orgId, viewer.orgId), eq(teams.name, data.name)));
      if (clash) return null;
      const [team] = await tx
        .insert(teams)
        .values({ orgId: viewer.orgId, name: data.name, description: data.description || null })
        .returning({ id: teams.id });
      if (data.lead) await tx.insert(teamMembers).values({ teamId: team.id, userId: viewer.userId, role: "lead" });
      return team.id;
    });
    if (teamId === null) return fail(`There is already a team called “${data.name}”.`);
    log.info("teams.created", { orgId: viewer.orgId, teamId, by: viewer.userId });
    refresh();
    return ok({ teamId }, "Team created.");
  });
}

const memberSchema = z.object({ teamId: z.string().min(1), userId: z.string().min(1), role: z.enum(TEAM_ROLES) });

/** Adds someone to a team, or changes their role on it. */
export async function setTeamMember(input: z.input<typeof memberSchema>): Promise<ActionResult> {
  return runAction("teams.set_member", memberSchema, input, async ({ teamId, userId, role }) => {
    const { viewer } = await requireOrgAdmin();
    const team = await findTeam(db, viewer.orgId, teamId);
    const member = await findMembership(db, viewer.orgId, userId);
    if (team === null || member === null) throw new GuardError("not_found");
    if (member.role === "stakeholder") return fail("Stakeholders aren't on teams. Change their organization role first.");
    await db
      .insert(teamMembers)
      .values({ teamId, userId, role })
      .onConflictDoUpdate({ target: [teamMembers.teamId, teamMembers.userId], set: { role } });
    log.info("teams.member_set", { orgId: viewer.orgId, teamId, userId, role, by: viewer.userId });
    refresh();
    return ok(undefined, "Team updated.");
  });
}

const removeSchema = z.object({ teamId: z.string().min(1), userId: z.string().min(1) });

export async function removeTeamMember(input: z.input<typeof removeSchema>): Promise<ActionResult> {
  return runAction("teams.remove_member", removeSchema, input, async ({ teamId, userId }) => {
    const { viewer } = await requireOrgAdmin();
    const team = await findTeam(db, viewer.orgId, teamId);
    if (team === null) throw new GuardError("not_found");
    await db.delete(teamMembers).where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)));
    log.info("teams.member_removed", { orgId: viewer.orgId, teamId, userId, by: viewer.userId });
    refresh();
    return ok(undefined, "Removed from the team.");
  });
}
