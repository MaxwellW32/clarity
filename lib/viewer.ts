import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { listMemberships, teamRolesForUser, type Membership } from "@/lib/dal/orgs";
import { readActiveOrgCookie, tryRewriteActiveOrgCookie } from "@/lib/org-cookie";
import { isAdmin, type Viewer } from "@/lib/permissions";
import { safeTimeZone } from "@/lib/time";

export type SessionUser = { id: string; name: string | null; email: string; image: string | null; timezone: string | null };

export type ViewerContext = {
  viewer: Viewer;
  user: SessionUser;
  org: Membership;
  /** Every org the user belongs to, for the switcher. */
  orgs: Membership[];
};

type Resolved = { status: "signed-out" } | { status: "no-org"; user: SessionUser } | ({ status: "ok" } & ViewerContext);

/** Auth.js's database-session cookie: the __Secure- name on https (production), the plain one on http. */
const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

/**
 * The signed-in user, read straight from the session row (one query). Auth.js still handles sign-in, sign-out
 * and its route; reads skip it, so nothing here mints tokens or touches the clock.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = SESSION_COOKIES.map((name) => store.get(name)?.value).find((value) => value !== undefined && value !== "");
  if (token === undefined) return null;
  // Sessions last their original 30 days: reads never extend them.
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image, timezone: users.timezone })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.sessionToken, token), gt(sessions.expires, sql`now()`)));
  if (!row || !row.email) return null;
  return { ...row, email: row.email };
});

/**
 * Resolves the active organization: the `clarity.org` cookie when the user really is a member of that
 * org, otherwise their oldest membership (and the cookie is rewritten where that is possible).
 * Two round trips: the session above, then memberships and team roles together.
 */
const resolve = cache(async (): Promise<Resolved> => {
  const user = await getSessionUser();
  if (user === null) return { status: "signed-out" };

  const [memberships, roles, wanted] = await Promise.all([
    listMemberships(user.id),
    teamRolesForUser(user.id),
    readActiveOrgCookie(),
  ]);
  if (memberships.length === 0) return { status: "no-org", user };

  const org = memberships.find((membership) => membership.orgId === wanted) ?? memberships[0];
  if (org.orgId !== wanted) await tryRewriteActiveOrgCookie(org.orgId);

  const teamRoles = new Map(roles.filter((role) => role.orgId === org.orgId).map((role) => [role.teamId, role.role]));
  return {
    status: "ok",
    viewer: { userId: user.id, orgId: org.orgId, orgRole: org.role, teamRoles, timezone: safeTimeZone(user.timezone ?? org.timezone) },
    user,
    org,
    orgs: memberships,
  };
});

/** The viewer for the active org, or null (signed out, or no organization yet). */
export async function getViewer(): Promise<Viewer | null> {
  const resolved = await resolve();
  return resolved.status === "ok" ? resolved.viewer : null;
}

/** The full context for the active org, or null. */
export async function getViewerContext(): Promise<ViewerContext | null> {
  const resolved = await resolve();
  return resolved.status === "ok" ? { viewer: resolved.viewer, user: resolved.user, org: resolved.org, orgs: resolved.orgs } : null;
}

/** Signed-in user with an organization, or a redirect to /login or /onboarding. */
export async function requireViewerContext(): Promise<ViewerContext> {
  const resolved = await resolve();
  if (resolved.status === "signed-out") redirect("/login");
  if (resolved.status === "no-org") redirect("/onboarding");
  return { viewer: resolved.viewer, user: resolved.user, org: resolved.org, orgs: resolved.orgs };
}

/**
 * For app pages and the shell: an admin whose active org has no team yet is still setting up, so they go
 * back to onboarding (which works out the step from what exists). Actions use requireViewerContext.
 */
export async function requireAppContext(): Promise<ViewerContext> {
  const context = await requireViewerContext();
  if (context.org.teamCount === 0 && isAdmin(context.viewer)) redirect("/onboarding");
  return context;
}

export async function requireViewer(): Promise<Viewer> {
  return (await requireViewerContext()).viewer;
}

/** Signed in, organization or not (onboarding, invitations). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user === null) redirect("/login");
  return user;
}
