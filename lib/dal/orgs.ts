import "server-only";
import { and, asc, eq, isNull, like, ne, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { invitations, organizationMembers, organizations, teamMembers, teams, users } from "@/db/schema";
import type { OrgRole, TeamRole } from "@/lib/constants";
import type { Viewer } from "@/lib/permissions";

// Organization, membership and team reads. Everything that takes a Viewer filters by viewer.orgId in SQL.

type Handle = Tx | typeof db;

export type Membership = {
  orgId: string;
  name: string;
  slug: string;
  timezone: string;
  role: OrgRole;
  /** Teams in the org: zero means its setup is unfinished. */
  teamCount: number;
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
      teamCount: sql<number>`(select count(*)::int from ${teams} where ${teams.orgId} = ${organizations.id})`,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.orgId))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizationMembers.joinedAt), asc(organizations.name));
}

/** The user's role on every team, across all their orgs (the viewer keeps the active org's). */
export async function teamRolesForUser(userId: string): Promise<{ orgId: string; teamId: string; role: TeamRole }[]> {
  return db
    .select({ orgId: teams.orgId, teamId: teamMembers.teamId, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId));
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

export type TeamMemberSummary = { userId: string; name: string | null; email: string | null; image: string | null; role: TeamRole };

export type TeamWithMembers = {
  id: string;
  name: string;
  description: string | null;
  members: TeamMemberSummary[];
};

/** The org's teams with their members, in one query. */
export async function listTeams(viewer: Pick<Viewer, "orgId">): Promise<TeamWithMembers[]> {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      userId: users.id,
      userName: users.name,
      email: users.email,
      image: users.image,
      role: teamMembers.role,
    })
    .from(teams)
    .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .leftJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teams.orgId, viewer.orgId))
    .orderBy(asc(teams.name), asc(teamMembers.role), asc(users.name));
  const byTeam = new Map<string, TeamWithMembers>();
  for (const row of rows) {
    let team = byTeam.get(row.id);
    if (!team) {
      team = { id: row.id, name: row.name, description: row.description, members: [] };
      byTeam.set(row.id, team);
    }
    if (row.userId !== null && row.role !== null) {
      team.members.push({ userId: row.userId, name: row.userName, email: row.email, image: row.image, role: row.role });
    }
  }
  return [...byTeam.values()];
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

/** What onboarding needs to know about the active org, in one query. */
export async function getSetupState(orgId: string, userId: string) {
  const [row] = await db
    .select({
      firstTeamId: sql<string | null>`(select id from ${teams} where ${teams.orgId} = ${orgId} order by ${teams.createdAt} limit 1)`,
      firstTeamName: sql<string | null>`(select name from ${teams} where ${teams.orgId} = ${orgId} order by ${teams.createdAt} limit 1)`,
      otherMembers: sql<number>`(select count(*)::int from ${organizationMembers} where ${organizationMembers.orgId} = ${orgId} and ${organizationMembers.userId} <> ${userId})`,
      pendingInvitations: sql<number>`(select count(*)::int from ${invitations} where ${invitations.orgId} = ${orgId} and ${invitations.acceptedAt} is null)`,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  return row ?? { firstTeamId: null, firstTeamName: null, otherMembers: 0, pendingInvitations: 0 };
}

/** An org-scoped team lookup: never trust a team id from the client. */
export async function findTeam(tx: Handle, orgId: string, teamId: string) {
  const [team] = await tx.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)));
  return team ?? null;
}

export async function findMembership(tx: Handle, orgId: string, userId: string) {
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

/** `acme`, then `acme-2`, `acme-3`…: the first slug no org has taken. */
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

/** The slug for a renamed org: the new name's slug when no other org has it, otherwise the current one. */
export async function slugForRename(tx: Tx, orgId: string, name: string, current: string): Promise<string> {
  const wanted = slugify(name);
  if (wanted === current) return current;
  const [taken] = await tx
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.slug, wanted), ne(organizations.id, orgId)));
  return taken ? current : wanted;
}
