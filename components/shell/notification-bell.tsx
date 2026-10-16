import { Bell } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

/** The bell: a link to the notifications list with the unread count. Server-rendered, no polling. */
export function NotificationBell({ unread, variant = "sidebar" }: { unread: number; variant?: "sidebar" | "icon" }) {
  const label = unread > 0 ? `${unread} unread notifications` : "Notifications";
  if (variant === "icon") {
    return (
      <Link href="/notifications" aria-label={label} className="relative grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
        <Bell className="size-[18px]" aria-hidden />
        {unread > 0 ? <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-link px-1 text-[10px] leading-4 font-semibold text-white">{unread > 9 ? "9+" : unread}</span> : null}
      </Link>
    );
  }
  return (
    <Link
      href="/notifications"
      aria-label={label}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
        unread > 0 ? "text-sidebar-foreground hover:bg-sidebar-accent/60" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Bell className="size-4 shrink-0" aria-hidden />
      Notifications
      {unread > 0 ? <span className="ml-auto rounded-full bg-link px-1.5 text-[11px] leading-4 font-semibold text-white tabular-nums">{unread > 99 ? "99+" : unread}</span> : null}
    </Link>
  );
}
