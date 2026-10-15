import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { getUserProfile, listMemberships, teamRolesFor, type Membership } from "@/lib/dal/orgs";
import { readActiveOrgCookie, tryRewriteActiveOrgCookie } from "@/lib/org-cookie";
import type { Viewer } from "@/lib/permissions";
import { safeTimeZone } from "@/lib/time";

export type SessionUser = { id: string; name: string | null; email: string; image: string | null };

export type ViewerContext = {
  viewer: Viewer;
  user: SessionUser & { timezone: string | null };
  org: Membership;
  /** Every org the user belongs to, for the switcher. */
  orgs: Membership[];
};

type Resolved = { status: "signed-out" } | { status: "no-org"; user: SessionUser } | ({ status: "ok" } & ViewerContext);

/** The signed-in user (from the database session), or null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Auth.js mints a CSRF token (crypto.getRandomValues) on every session read without a CSRF cookie. Partial
  // Prefetching prerenders the App Shell with cookies resolved and rejects that randomness, so the session
  // read happens at request time only; the shell's Suspense fallbacks cover it.
  await connection();
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  return { id: user.id, name: user.name ?? null, email: user.email, image: user.image ?? null };
});

/**
 * Resolves the active organization: the `clarity.org` cookie when the user really is a member of that
 * org, otherwise their oldest membership (and the cookie is rewritten where that is possible).
 */
const resolve = cache(async (): Promise<Resolved> => {
  const user = await getSessionUser();
  if (user === null) return { status: "signed-out" };

  const [memberships, profile, wanted] = await Promise.all([
    listMemberships(user.id),
    getUserProfile(user.id),
    readActiveOrgCookie(),
  ]);
  if (memberships.length === 0) return { status: "no-org", user };

  const org = memberships.find((membership) => membership.orgId === wanted) ?? memberships[0];
  if (org.orgId !== wanted) await tryRewriteActiveOrgCookie(org.orgId);

  const teamRoles = await teamRolesFor(user.id, org.orgId);
  const timezone = profile?.timezone ?? null;
  return {
    status: "ok",
    viewer: { userId: user.id, orgId: org.orgId, orgRole: org.role, teamRoles, timezone: safeTimeZone(timezone ?? org.timezone) },
    user: { ...user, name: profile?.name ?? user.name, timezone },
    org,
    orgs: memberships,
  };
});

/** The viewer for the active org, or null (signed out, or no organization yet). */
export async function getViewer(): Promise<Viewer | null> {
  const resolved = await resolve();
  return resolved.status === "ok" ? resolved.viewer : null;
}

/** Signed-in user with an organization, or a redirect to /login or /onboarding. */
export async function requireViewerContext(): Promise<ViewerContext> {
  const resolved = await resolve();
  if (resolved.status === "signed-out") redirect("/login");
  if (resolved.status === "no-org") redirect("/onboarding");
  return { viewer: resolved.viewer, user: resolved.user, org: resolved.org, orgs: resolved.orgs };
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
