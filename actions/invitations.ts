"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { invitations, organizationMembers, organizations, teamMembers, users } from "@/db/schema";
import { fail, GuardError, ok, runAction, type ActionResult } from "@/lib/action-result";
import { ORG_ROLE_LABELS, ORG_ROLES, TEAM_ROLES, type OrgRole } from "@/lib/constants";
import { findTeam } from "@/lib/dal/orgs";
import { requireOrgAdmin } from "@/lib/guards";
import { hashInviteToken, inviteExpiry, inviteUrl, newInviteToken } from "@/lib/invite-token";
import { errorFields, log } from "@/lib/log";
import { sendMail } from "@/lib/mail";
import { invitationEmail } from "@/lib/mail/templates";
import { setActiveOrgCookie } from "@/lib/org-cookie";
import { requireUser } from "@/lib/viewer";

const MAX_AT_ONCE = 20;

/** "a@x.com, b@y.com" or one per line → unique lowercased addresses. */
const emailList = z
  .string()
  .transform((raw) => [...new Set(raw.split(/[\s,;]+/).map((each) => each.trim().toLowerCase()).filter(Boolean))])
  .pipe(
    z
      .array(z.email({ error: (issue) => `“${String(issue.input)}” isn't an email address.` }))
      .min(1, "Enter at least one email address.")
      .max(MAX_AT_ONCE, `Invite up to ${MAX_AT_ONCE} people at a time.`),
  );

const inviteSchema = z.object({
  emails: emailList,
  orgRole: z.enum(ORG_ROLES).default("member"),
  teamId: z.string().optional(),
  teamRole: z.enum(TEAM_ROLES).default("member"),
});

type SendOutcome = { sent: string[]; failed: string[] };

async function deliver(
  links: { email: string; token: string }[],
  orgName: string,
  inviterName: string,
  role: OrgRole,
): Promise<SendOutcome> {
  const outcome: SendOutcome = { sent: [], failed: [] };
  for (const { email, token } of links) {
    try {
      await sendMail(invitationEmail({ to: email, url: inviteUrl(token), orgName, inviterName, roleLabel: ORG_ROLE_LABELS[role].toLowerCase() }));
      outcome.sent.push(email);
    } catch (error) {
      log.error("invitations.send_failed", { email, ...errorFields(error) });
      outcome.failed.push(email);
    }
  }
  return outcome;
}

export type InviteResult = { invited: string[]; alreadyMembers: string[]; failed: string[] };

export async function inviteMembers(input: z.input<typeof inviteSchema>): Promise<ActionResult<InviteResult>> {
  return runAction("invitations.create", inviteSchema, input, async (data) => {
    const { viewer, user, org } = await requireOrgAdmin();
    // Stakeholders never sit on a team, so a team on their invitation is dropped.
    const teamId = data.orgRole === "stakeholder" || !data.teamId ? null : data.teamId;
    if (teamId !== null && (await findTeam(db, viewer.orgId, teamId)) === null) throw new GuardError("not_found");

    const { links, alreadyMembers } = await db.transaction(async (tx) => {
      const members = await tx
        .select({ email: users.email })
        .from(organizationMembers)
        .innerJoin(users, eq(users.id, organizationMembers.userId))
        .where(eq(organizationMembers.orgId, viewer.orgId));
      const memberEmails = new Set(members.map((row) => (row.email ?? "").toLowerCase()));

      const links: { email: string; token: string }[] = [];
      const alreadyMembers: string[] = [];
      for (const email of data.emails) {
        if (memberEmails.has(email)) {
          alreadyMembers.push(email);
          continue;
        }
        const { token, tokenHash } = newInviteToken();
        const values = {
          orgRole: data.orgRole,
          teamId,
          teamRole: teamId === null ? null : data.teamRole,
          tokenHash,
          invitedBy: viewer.userId,
          expiresAt: inviteExpiry(),
        };
        // One open invitation per address: inviting again refreshes it (and the old link stops working).
        const [open] = await tx
          .select({ id: invitations.id })
          .from(invitations)
          .where(and(eq(invitations.orgId, viewer.orgId), eq(invitations.email, email), isNull(invitations.acceptedAt)));
        if (open) await tx.update(invitations).set({ ...values, createdAt: new Date() }).where(eq(invitations.id, open.id));
        else await tx.insert(invitations).values({ orgId: viewer.orgId, email, ...values });
        links.push({ email, token });
      }
      return { links, alreadyMembers };
    });

    const { sent, failed } = await deliver(links, org.name, user.name ?? user.email, data.orgRole);
    log.info("invitations.created", { orgId: viewer.orgId, count: sent.length, failed: failed.length, by: viewer.userId });
    refresh();
    const message =
      sent.length === 0 ? undefined : sent.length === 1 ? `Invitation sent to ${sent[0]}.` : `${sent.length} invitations sent.`;
    return ok({ invited: sent, alreadyMembers, failed }, message);
  });
}

const idSchema = z.object({ id: z.string().min(1) });

export async function resendInvitation(input: z.input<typeof idSchema>): Promise<ActionResult> {
  return runAction("invitations.resend", idSchema, input, async ({ id }) => {
    const { viewer, user, org } = await requireOrgAdmin();
    const { token, tokenHash } = newInviteToken();
    const [row] = await db
      .update(invitations)
      .set({ tokenHash, expiresAt: inviteExpiry() })
      .where(and(eq(invitations.id, id), eq(invitations.orgId, viewer.orgId), isNull(invitations.acceptedAt)))
      .returning({ email: invitations.email, orgRole: invitations.orgRole });
    if (!row) throw new GuardError("not_found");
    const { failed } = await deliver([{ email: row.email, token }], org.name, user.name ?? user.email, row.orgRole);
    refresh();
    if (failed.length > 0) return fail(`The invitation was renewed, but the email to ${row.email} could not be sent.`);
    return ok(undefined, `Invitation resent to ${row.email}.`);
  });
}

export async function revokeInvitation(input: z.input<typeof idSchema>): Promise<ActionResult> {
  return runAction("invitations.revoke", idSchema, input, async ({ id }) => {
    const { viewer } = await requireOrgAdmin();
    const [row] = await db
      .delete(invitations)
      .where(and(eq(invitations.id, id), eq(invitations.orgId, viewer.orgId), isNull(invitations.acceptedAt)))
      .returning({ email: invitations.email });
    if (!row) throw new GuardError("not_found");
    log.info("invitations.revoked", { orgId: viewer.orgId, by: viewer.userId });
    refresh();
    return ok(undefined, `Invitation to ${row.email} revoked.`);
  });
}

const acceptSchema = z.object({ token: z.string().min(20).max(200) });

/**
 * Joins the invitation's org. The signed-in email must match the invited address (case-insensitively):
 * an invitation link alone never grants access to a different account.
 */
export async function acceptInvitation(input: z.input<typeof acceptSchema>): Promise<ActionResult> {
  const result = await runAction("invitations.accept", acceptSchema, input, async ({ token }) => {
    const user = await requireUser();
    const tokenHash = hashInviteToken(token);
    const outcome = await db.transaction(async (tx): Promise<{ error: string } | { orgId: string }> => {
      const [invite] = await tx.select().from(invitations).where(eq(invitations.tokenHash, tokenHash));
      if (!invite) return { error: "This invitation link isn't valid. Ask for a new one." };
      if (invite.acceptedAt !== null) return { error: "This invitation has already been used." };
      if (invite.expiresAt.getTime() <= Date.now()) return { error: "This invitation has expired. Ask an admin to resend it." };
      if (invite.email !== user.email.toLowerCase()) {
        return { error: "This invitation was sent to a different email address." };
      }
      // Claim it first, so a double submit cannot join twice.
      const [claimed] = await tx
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(and(eq(invitations.id, invite.id), isNull(invitations.acceptedAt)))
        .returning({ id: invitations.id });
      if (!claimed) return { error: "This invitation has already been used." };

      // An existing member keeps the role they have.
      await tx
        .insert(organizationMembers)
        .values({ orgId: invite.orgId, userId: user.id, role: invite.orgRole, invitedBy: invite.invitedBy })
        .onConflictDoNothing();
      const [membership] = await tx
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.orgId, invite.orgId), eq(organizationMembers.userId, user.id)));
      if (invite.teamId !== null && membership?.role !== "stakeholder") {
        const team = await findTeam(tx, invite.orgId, invite.teamId);
        if (team !== null) {
          await tx
            .insert(teamMembers)
            .values({ teamId: team.id, userId: user.id, role: invite.teamRole ?? "member" })
            .onConflictDoNothing();
        }
      }
      const [org] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, invite.orgId));
      return { orgId: org.id };
    });
    if ("error" in outcome) return fail(outcome.error);
    await setActiveOrgCookie(outcome.orgId);
    log.info("invitations.accepted", { orgId: outcome.orgId, userId: user.id });
    return ok(undefined);
  });
  if (result.ok) redirect("/overview");
  return result;
}
