import "server-only";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { invitations, organizations, teams, users } from "@/db/schema";
import { hashInviteToken } from "@/lib/invite-token";

const inviter = alias(users, "inviter");

/** The invitation behind a link. The token is the credential, so this is not viewer-scoped. */
export async function findInvitationByToken(token: string) {
  if (token.length < 20 || token.length > 200) return null;
  const [row] = await db
    .select({
      email: invitations.email,
      orgRole: invitations.orgRole,
      teamRole: invitations.teamRole,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      orgName: organizations.name,
      teamName: teams.name,
      inviterName: inviter.name,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.orgId))
    .leftJoin(teams, eq(teams.id, invitations.teamId))
    .leftJoin(inviter, eq(inviter.id, invitations.invitedBy))
    .where(eq(invitations.tokenHash, hashInviteToken(token)));
  return row ? { ...row, expired: row.expiresAt.getTime() <= Date.now() } : null;
}
