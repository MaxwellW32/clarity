"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, type Tx } from "@/db";
import { organizationMembers, teamMembers, teams } from "@/db/schema";
import { fail, GuardError, ok, runAction, type ActionResult } from "@/lib/action-result";
import { ORG_ROLES } from "@/lib/constants";
import { countAdmins, findMembership } from "@/lib/dal/orgs";
import { requireOrgAdmin } from "@/lib/guards";
import { log } from "@/lib/log";

const LAST_ADMIN = "An organization needs at least one admin. Make someone else an admin first.";

/** Team memberships of one user across one org's teams. */
async function leaveOrgTeams(tx: Tx, orgId: string, userId: string): Promise<void> {
  const orgTeams = tx.select({ id: teams.id }).from(teams).where(eq(teams.orgId, orgId));
  await tx.delete(teamMembers).where(and(eq(teamMembers.userId, userId), inArray(teamMembers.teamId, orgTeams)));
}

const roleSchema = z.object({ userId: z.string().min(1), role: z.enum(ORG_ROLES) });

export async function changeMemberRole(input: z.input<typeof roleSchema>): Promise<ActionResult> {
  return runAction("members.role", roleSchema, input, async ({ userId, role }) => {
    const { viewer } = await requireOrgAdmin();
    const outcome = await db.transaction(async (tx) => {
      const member = await findMembership(tx, viewer.orgId, userId);
      if (member === null) throw new GuardError("not_found");
      if (member.role === role) return "unchanged";
      if (member.role === "admin" && (await countAdmins(tx, viewer.orgId)) <= 1) return "last-admin";
      await tx
        .update(organizationMembers)
        .set({ role })
        .where(and(eq(organizationMembers.orgId, viewer.orgId), eq(organizationMembers.userId, userId)));
      // Stakeholders see only their own requests, so they are never on a team.
      if (role === "stakeholder") await leaveOrgTeams(tx, viewer.orgId, userId);
      return "changed";
    });
    if (outcome === "last-admin") return fail(LAST_ADMIN);
    log.info("members.role_changed", { orgId: viewer.orgId, userId, role, by: viewer.userId });
    refresh();
    return ok(undefined, outcome === "changed" ? "Role updated." : undefined);
  });
}

const removeSchema = z.object({ userId: z.string().min(1) });

export async function removeMember(input: z.input<typeof removeSchema>): Promise<ActionResult> {
  return runAction("members.remove", removeSchema, input, async ({ userId }) => {
    const { viewer } = await requireOrgAdmin();
    if (userId === viewer.userId) return fail("You can't remove yourself. Ask another admin to do it.");
    await db.transaction(async (tx) => {
      const member = await findMembership(tx, viewer.orgId, userId);
      if (member === null) throw new GuardError("not_found");
      await leaveOrgTeams(tx, viewer.orgId, userId);
      await tx
        .delete(organizationMembers)
        .where(and(eq(organizationMembers.orgId, viewer.orgId), eq(organizationMembers.userId, userId)));
    });
    log.info("members.removed", { orgId: viewer.orgId, userId, by: viewer.userId });
    refresh();
    return ok(undefined, "Member removed.");
  });
}
