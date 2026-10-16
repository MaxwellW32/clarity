"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { notificationPreferences, notifications } from "@/db/schema";
import { ok, runAction, type ActionResult } from "@/lib/action-result";
import { requireUser, requireViewer } from "@/lib/viewer";

export async function markAllRead(): Promise<ActionResult> {
  return runAction("notifications.read_all", z.object({}), {}, async () => {
    const viewer = await requireViewer();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, viewer.userId), eq(notifications.orgId, viewer.orgId), isNull(notifications.readAt)));
    refresh();
    return ok(undefined, "All caught up.");
  });
}

const idSchema = z.object({ id: z.string().min(1).max(64) });

/** Marks one notification read; only ever the viewer's own row. */
export async function markRead(input: z.input<typeof idSchema>): Promise<ActionResult> {
  return runAction("notifications.read", idSchema, input, async ({ id }) => {
    const viewer = await requireViewer();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, viewer.userId), isNull(notifications.readAt)));
    return ok(undefined);
  });
}

const preferencesSchema = z.object({
  emailAssignment: z.boolean(),
  emailApproval: z.boolean(),
  emailRequestDecision: z.boolean(),
  emailHandover: z.boolean(),
  emailBlocked: z.boolean(),
});

export async function savePreferences(input: z.input<typeof preferencesSchema>): Promise<ActionResult> {
  return runAction("notifications.preferences", preferencesSchema, input, async (data) => {
    const user = await requireUser();
    await db
      .insert(notificationPreferences)
      .values({ userId: user.id, ...data })
      .onConflictDoUpdate({ target: notificationPreferences.userId, set: data });
    refresh();
    return ok(undefined, "Preferences saved.");
  });
}
