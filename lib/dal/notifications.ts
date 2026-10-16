import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { notificationPreferences, notifications, teamMembers } from "@/db/schema";
import type { Viewer } from "@/lib/permissions";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string;
  readAt: string | null;
  createdAt: string;
};

/** The viewer's notifications in the active org, newest first. */
export async function listNotifications(viewer: Viewer, limit = 50): Promise<NotificationItem[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, viewer.userId), eq(notifications.orgId, viewer.orgId)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function unreadCount(viewer: Viewer): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, viewer.userId), eq(notifications.orgId, viewer.orgId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export type Preferences = {
  emailAssignment: boolean;
  emailApproval: boolean;
  emailRequestDecision: boolean;
  emailHandover: boolean;
  emailBlocked: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = { emailAssignment: true, emailApproval: true, emailRequestDecision: true, emailHandover: true, emailBlocked: true };

/** A user's email preferences; the defaults until they change something. */
export async function getPreferences(userId: string): Promise<Preferences> {
  const [row] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  if (!row) return DEFAULT_PREFERENCES;
  return { emailAssignment: row.emailAssignment, emailApproval: row.emailApproval, emailRequestDecision: row.emailRequestDecision, emailHandover: row.emailHandover, emailBlocked: row.emailBlocked };
}

/** Who leads a team (for "a task on your team is blocked"). */
export async function teamLeadIds(tx: Tx | typeof db, teamId: string): Promise<string[]> {
  const rows = await tx
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, "lead")));
  return rows.map((row) => row.userId);
}
