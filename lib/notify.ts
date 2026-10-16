import "server-only";
import { inArray } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { getPreferences } from "@/lib/dal/notifications";
import { log } from "@/lib/log";
import { sendMail } from "@/lib/mail";
import { notificationEmail } from "@/lib/mail/templates";

// In-app notifications plus an optional email, for the handful of events worth interrupting someone for.
// Actions collect notices while they run and dispatch them once the transaction has committed, so a
// rolled-back change never notifies anyone.

export type NotificationKind = "assigned" | "handover" | "approval_requested" | "approval_decided" | "blocked" | "request_decided";

export type Notice = {
  orgId: string;
  actorId: string;
  recipients: string[];
  kind: NotificationKind;
  title: string;
  body?: string | null;
  /** App path the notification opens. */
  href: string;
};

const PREFERENCE: Record<NotificationKind, "emailAssignment" | "emailHandover" | "emailApproval" | "emailBlocked" | "emailRequestDecision"> = {
  assigned: "emailAssignment",
  handover: "emailHandover",
  approval_requested: "emailApproval",
  approval_decided: "emailApproval",
  blocked: "emailBlocked",
  request_decided: "emailRequestDecision",
};

function appOrigin(): string {
  try {
    return new URL(process.env.AUTH_URL ?? "http://localhost:3014").origin;
  } catch {
    return "http://localhost:3014";
  }
}

/** Writes the in-app rows now and sends the emails after the response, each according to the recipient's preferences. */
export async function dispatch(notices: Notice[]): Promise<void> {
  const rows = notices.flatMap((notice) =>
    [...new Set(notice.recipients)]
      .filter((userId) => userId !== notice.actorId)
      .map((userId) => ({ userId, orgId: notice.orgId, kind: notice.kind, title: notice.title, body: notice.body ?? null, href: notice.href })),
  );
  if (rows.length === 0) return;
  try {
    await db.insert(notifications).values(rows);
  } catch (error) {
    log.error("notify.insert_failed", { error: error instanceof Error ? error.message : String(error) });
    return;
  }
  after(async () => {
    try {
      const recipients = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.id, [...new Set(rows.map((row) => row.userId))]));
      for (const row of rows) {
        const recipient = recipients.find((each) => each.id === row.userId);
        if (!recipient?.email) continue;
        const preferences = await getPreferences(row.userId);
        if (!preferences[PREFERENCE[row.kind as NotificationKind]]) continue;
        await sendMail(notificationEmail({ to: recipient.email, title: row.title, body: row.body, url: `${appOrigin()}${row.href}` }));
      }
    } catch (error) {
      log.error("notify.email_failed", { error: error instanceof Error ? error.message : String(error) });
    }
  });
}
