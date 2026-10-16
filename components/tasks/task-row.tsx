"use client";

import { cn } from "cn";
import { Link2, MoreHorizontal, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PriorityGlyph } from "@/components/priority-glyph";
import { StatusIcon } from "@/components/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user-avatar";
import { TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import type { TaskListItem } from "@/lib/tasks/types";
import { DueLabel } from "./due-label";
import { StatusMenuItems, useChangeStatus } from "./status-menu";
import { useTaskActions } from "./task-actions";

async function copyLink(id: string) {
  await navigator.clipboard.writeText(`${window.location.origin}/tasks/${id}`);
  toast.success("Link copied.");
}

/** One dense row: status · title · next action · reason · due · priority · assignee, with quick actions. */
export function TaskRow({ task, today }: { task: TaskListItem; today: string }) {
  const router = useRouter();
  const { openUpdate } = useTaskActions();
  const { change } = useChangeStatus(task.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const rejected = task.status === "rejected";

  const cancelPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    <li
      className="group relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/60 sm:px-4"
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") return;
        longPressed.current = false;
        pressTimer.current = window.setTimeout(() => {
          longPressed.current = true;
          setSheetOpen(true);
        }, 500);
      }}
      onPointerUp={cancelPress}
      onPointerMove={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(event) => {
        if (longPressed.current) event.preventDefault();
      }}
    >
      <StatusIcon status={task.status} />
      <Link
        href={`/tasks/${task.id}`}
        prefetch={false}
        data-task-link
        className="flex min-w-0 flex-1 flex-col gap-0.5 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring md:flex-row md:items-baseline md:gap-3"
        onClick={(event) => {
          if (longPressed.current) {
            event.preventDefault();
            longPressed.current = false;
          }
        }}
      >
        <span className={cn("truncate text-[13px] font-medium md:max-w-[55%] md:shrink-0", rejected && "text-muted-foreground line-through")}>{task.title}</span>
        {task.nextAction ? <span className="truncate text-xs text-muted-foreground md:text-[13px]">{task.nextAction}</span> : null}
      </Link>
      {task.reason ? (
        <span className="relative hidden shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">{task.reason}</span>
      ) : null}
      <DueLabel due={task.dueDate} today={today} status={task.status} className="relative shrink-0 text-xs" />
      <PriorityGlyph priority={task.priority} className="relative" />
      {task.assignee ? (
        <UserAvatar name={task.assignee.name} email={task.assignee.email} image={task.assignee.image} size="sm" className="relative" />
      ) : (
        <span className="relative size-6 shrink-0 rounded-full border border-dashed" title="Unassigned" aria-label="Unassigned" />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${task.title}`}
          className="relative hidden size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity outline-none group-hover:opacity-100 hover:bg-accent focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:opacity-100 md:grid"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => openUpdate(task.id)}>
            <NotebookPen />
            Update progress
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2">
              <StatusIcon status={task.status} />
              Change status
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <StatusMenuItems current={task.status} onPick={(status) => change(task.status, status)} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => copyLink(task.id)}>
            <Link2 />
            Copy link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader>
            <SheetTitle className="truncate pr-6">{task.title}</SheetTitle>
            <SheetDescription>{TASK_STATUS_LABELS[task.status]}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-1 px-4">
            <SheetButton
              onClick={() => {
                setSheetOpen(false);
                openUpdate(task.id);
              }}
            >
              <NotebookPen className="size-4 text-muted-foreground" />
              Update progress
            </SheetButton>
            <SheetButton
              onClick={() => {
                setSheetOpen(false);
                router.push(`/tasks/${task.id}`);
              }}
            >
              Open task
            </SheetButton>
            <SheetButton
              onClick={() => {
                setSheetOpen(false);
                void copyLink(task.id);
              }}
            >
              <Link2 className="size-4 text-muted-foreground" />
              Copy link
            </SheetButton>
            <p className="px-3 pt-3 pb-1 text-xs text-muted-foreground">Change status</p>
            <div className="grid grid-cols-2 gap-1">
              {TASK_STATUSES.map((status) => (
                <SheetButton
                  key={status}
                  disabled={status === task.status}
                  onClick={() => {
                    setSheetOpen(false);
                    change(task.status, status);
                  }}
                >
                  <StatusIcon status={status} />
                  {TASK_STATUS_LABELS[status]}
                </SheetButton>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </li>
  );
}

function SheetButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 items-center gap-3 rounded-md px-3 text-left text-sm font-medium hover:bg-accent disabled:opacity-50"
    >
      {children}
    </button>
  );
}
