import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { MarkAllReadButton, NotificationLink } from "@/components/notifications/notification-items";
import { PageHeader } from "@/components/page-header";
import { listNotifications } from "@/lib/dal/notifications";
import { formatRelative } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Notifications" };

/** Everything that was worth telling you, newest first. Each one opens the thing it is about. */
export default async function NotificationsPage() {
  const viewer = await requireViewer();
  const items = await listNotifications(viewer);
  const now = new Date();
  const unread = items.filter((item) => item.readAt === null).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" description={unread > 0 ? `${unread} unread.` : "You're all caught up."} action={unread > 0 ? <MarkAllReadButton /> : null} />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="Nothing yet" description="Assignments, handovers, approvals, blockers on your team and decisions on your requests show up here." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {items.map((item) => (
            <NotificationLink key={item.id} item={item} when={formatRelative(new Date(item.createdAt), now, viewer.timezone)} />
          ))}
        </ul>
      )}
    </div>
  );
}
