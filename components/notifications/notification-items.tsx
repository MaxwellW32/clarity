"use client";

import { cn } from "cn";
import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllRead, markRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import type { NotificationItem } from "@/lib/dal/notifications";
import { toastResult } from "@/lib/toast-result";

/** A notification row: opening it marks it read and goes to what it is about. */
export function NotificationLink({ item, when }: { item: NotificationItem; when: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unread = item.readAt === null;
  return (
    <li>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            if (unread) await markRead({ id: item.id });
            router.push(item.href);
          })
        }
        className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 disabled:opacity-60", unread && "bg-status-in-progress-bg/30")}
      >
        <span className={cn("mt-2 size-2 shrink-0 rounded-full", unread ? "bg-link" : "bg-transparent")} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm", unread ? "font-medium" : "font-normal")}>{item.title}</span>
          {item.body ? <span className="mt-0.5 block text-xs text-muted-foreground">{item.body}</span> : null}
        </span>
        <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">{when}</span>
      </button>
    </li>
  );
}

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => void toastResult(await markAllRead()))}>
      <CheckCheck aria-hidden />
      Mark all read
    </Button>
  );
}
