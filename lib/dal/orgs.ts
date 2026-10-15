import "server-only";
import { and, asc, eq, gt, inArray, isNull, like, or } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { invitations, organizationMembers, organizations, teamMembers, teams, users } from "@/db/schema";
import type { OrgRole, TeamRole } from "@/lib/constants";
import type { Viewer } from "@/lib/permissions";

// Organization, membership and team reads. Everything that takes a Viewer filters by viewer.orgId in SQL.

export type Membership = {
  orgId: string;
  name: string;
  slug: string;
  timezone: string;
  role: OrgRole;
};

/** Every org the user belongs to, oldest membership first (the fallback active org). */
export async function listMemberships(userId: string): Promise<Membership[]> {
  return db
    .select({
      orgId: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      timezone: organizations.timezone,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.orgId))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizationMembers.joinedAt), asc(organizations.name));
}

/** The user's role on each team of one org. */
export async function teamRolesFor(userId: string, orgId: string): Promise<Map<string, TeamRole>> {
  const rows = await db
    .select({ teamId: teamMembers.teamId, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, userId), eq(teams.orgId, orgId)));
  return new Map(rows.map((row) => [row.teamId, row.role]));
}

export async function getUserProfile(userId: string) {
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image, timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId));
  return row ?? null;
}

export type MemberRow = {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: OrgRole;
  joinedAt: Date;
};

export async function listMembers(viewer: Viewer): Promise<MemberRow[]> {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.orgId, viewer.orgId))
    .orderBy(asc(users.name), asc(users.email));
}

export type TeamWithMembers = {
  id: string;
  name: string;
  description: string | null;
  members: { userId: string; name: string | null; email: string | null; image: string | null; role: TeamRole }[];
};

export async function listTeams(viewer: Viewer): Promise<TeamWithMembers[]> {
  const teamRows = await db
    .select({ id: teams.id, name: teams.name, description: teams.description })
    .from(teams)
    .where(eq(teams.orgId, viewer.orgId))
    .orderBy(asc(teams.name));
  if (teamRows.length === 0) return [];
  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      userId: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(inArray(teamMembers.teamId, teamRows.map((team) => team.id)))
    .orderBy(asc(teamMembers.role), asc(users.name));
  return teamRows.map((team) => ({
    ...team,
    members: memberRows
      .filter((row) => row.teamId === team.id)
      .map((row) => ({ userId: row.userId, name: row.name, email: row.email, image: row.image, role: row.role })),
  }));
}

export type PendingInvitation = {
  id: string;
  email: string;
  orgRole: OrgRole;
  teamName: string | null;
  teamRole: TeamRole | null;
  invitedByName: string | null;
  expiresAt: Date;
  createdAt: Date;
};

/** Invitations not yet accepted (expired ones included, so they can be resent). */
export async function listPendingInvitations(viewer: Viewer): Promise<PendingInvitation[]> {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      orgRole: invitations.orgRole,
      teamName: teams.name,
      teamRole: invitations.teamRole,
      invitedByName: users.name,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .leftJoin(teams, eq(teams.id, invitations.teamId))
    .leftJoin(users, eq(users.id, invitations.invitedBy))
    .where(and(eq(invitations.orgId, viewer.orgId), isNull(invitations.acceptedAt)))
    .orderBy(asc(invitations.createdAt));
}

/** An org-scoped team lookup — never trust a team id from the client. */
export async function findTeam(tx: Tx | typeof db, orgId: string, teamId: string) {
  const [team] = await tx.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)));
  return team ?? null;
}

export async function findMembership(tx: Tx | typeof db, orgId: string, userId: string) {
  const [row] = await tx
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)));
  return row ?? null;
}

/** Inside a transaction the admin rows are locked, so two admins demoting each other cannot both succeed. */
export async function countAdmins(tx: Tx, orgId: string): Promise<number> {
  const rows = await tx
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.role, "admin")))
    .for("update");
  return rows.length;
}

/** An invitation still open for this org and email, if one exists. */
export async function findOpenInvitation(tx: Tx | typeof db, orgId: string, email: string) {
  const [row] = await tx
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.orgId, orgId),
        eq(invitations.email, email),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    );
  return row ?? null;
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base.length > 0 ? base : "org";
}

/** `acme`, then `acme-2`, `acme-3`… — the first slug no org has taken. */
export async function uniqueSlug(tx: Tx, name: string): Promise<string> {
  const base = slugify(name);
  const rows = await tx
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(or(eq(organizations.slug, base), like(organizations.slug, `${base}-%`)));
  const taken = new Set(rows.map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}
