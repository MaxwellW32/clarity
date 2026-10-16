"use client";

import { cn } from "cn";
import { ArrowLeft, Check, ChevronDown, Link2, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { editTask } from "@/actions/tasks";
import { PriorityGlyph } from "@/components/priority-glyph";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, type TaskPriority } from "@/lib/constants";
import type { TaskAbilities, TaskDetail } from "@/lib/tasks/types";
import { toastResult } from "@/lib/toast-result";
import { DueLabel } from "../due-label";
import { StatusMenuItems, useChangeStatus } from "../status-menu";
import { FOCUS_UPDATE_EVENT } from "../task-actions";

const chip =
  "inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none";

type Member = { id: string; name: string | null; email: string | null; image: string | null };

function TitleEditor({ detail, editable }: { detail: TaskDetail; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(detail.title);
  const [pending, startTransition] = useTransition();
  const save = () => {
    const next = value.trim();
    setEditing(false);
    if (next === "" || next === detail.title) return setValue(detail.title);
    startTransition(async () => {
      if (!toastResult(await editTask({ taskId: detail.id, field: "title", value: next }))) setValue(detail.title);
    });
  };
  const rejected = detail.status === "rejected";
  if (editing) {
    return (
      <Input
        aria-label="Title"
        value={value}
        autoFocus
        maxLength={200}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();
          if (event.key === "Escape") {
            setValue(detail.title);
            setEditing(false);
          }
        }}
        className="h-auto py-1 text-lg font-semibold"
      />
    );
  }
  const title = <span className={cn(rejected && "text-muted-foreground line-through", pending && "opacity-60")}>{value}</span>;
  return (
    <h1 className="text-lg leading-snug font-semibold tracking-tight md:text-xl">
      {editable ? (
        <button type="button" className="rounded-md text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setEditing(true)} title="Click to edit">
          {title}
        </button>
      ) : (
        title
      )}
    </h1>
  );
}

export function TaskHeader({
  detail,
  abilities,
  members,
  today,
  created,
}: {
  detail: TaskDetail;
  abilities: TaskAbilities;
  members: Member[];
  today: string;
  created: { relative: string; absolute: string };
}) {
  const { change, pending: statusPending } = useChangeStatus(detail.id);
  const [pending, startTransition] = useTransition();
  const edit = (field: "priority" | "assigneeId" | "dueDate", value: string) =>
    startTransition(async () => void toastResult(await editTask({ taskId: detail.id, field, value } as Parameters<typeof editTask>[0])));
  const assignee = detail.assignee;

  return (
    <header className="mb-5">
      <Link href="/tasks" className="inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden />
        Tasks
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-80">
          <TitleEditor key={detail.title} detail={detail} editable={abilities.edit} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy link"
                onClick={async () => {
                  await navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied.");
                }}
              >
                <Link2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy link</TooltipContent>
          </Tooltip>
          {abilities.progress ? (
            <Button onClick={() => window.dispatchEvent(new Event(FOCUS_UPDATE_EVENT))}>
              <NotebookPen aria-hidden />
              Update progress
              <kbd className="ml-1 hidden rounded border border-current/20 px-1 font-sans text-[10px] opacity-60 sm:inline">U</kbd>
            </Button>
          ) : null}
        </div>
      </div>

      <div className={cn("mt-3 flex flex-wrap items-center gap-2", pending && "opacity-70")}>
        {abilities.progress ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={statusPending} aria-label="Change status">
              <span className="inline-flex items-center gap-0.5">
                <StatusBadge status={detail.status} />
                <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <StatusMenuItems current={detail.status} allowReject={abilities.reject} onPick={(status) => change(detail.status, status)} />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <StatusBadge status={detail.status} />
        )}

        {abilities.edit ? (
          <DropdownMenu>
            <DropdownMenuTrigger className={chip} aria-label="Priority">
              <PriorityGlyph priority={detail.priority} className="size-3.5" />
              {TASK_PRIORITY_LABELS[detail.priority]}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {[...TASK_PRIORITIES].reverse().map((priority: TaskPriority) => (
                <DropdownMenuItem key={priority} onSelect={() => edit("priority", priority)} className="gap-2">
                  <span className="grid w-4 place-items-center">
                    <PriorityGlyph priority={priority} />
                  </span>
                  {TASK_PRIORITY_LABELS[priority]}
                  {priority === detail.priority ? <Check className="ml-auto size-4" aria-label="Current" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className={cn(chip, "hover:bg-background")}>
            <PriorityGlyph priority={detail.priority} className="size-3.5" />
            {TASK_PRIORITY_LABELS[detail.priority]}
          </span>
        )}

        {abilities.edit ? (
          <DropdownMenu>
            <DropdownMenuTrigger className={chip} aria-label="Assignee">
              {assignee ? <UserAvatar name={assignee.name} email={assignee.email} image={assignee.image} size="sm" className="size-4" /> : null}
              {assignee ? (assignee.name ?? assignee.email) : "Unassigned"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onSelect={() => edit("assigneeId", "")}>Unassigned</DropdownMenuItem>
              {members.map((member) => (
                <DropdownMenuItem key={member.id} onSelect={() => edit("assigneeId", member.id)} className="gap-2">
                  <UserAvatar name={member.name} email={member.email} image={member.image} size="sm" />
                  <span className="truncate">{member.name ?? member.email}</span>
                  {member.id === assignee?.id ? <Check className="ml-auto size-4" aria-label="Current" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className={cn(chip, "hover:bg-background")}>{assignee ? (assignee.name ?? assignee.email) : "Unassigned"}</span>
        )}

        {abilities.edit ? (
          <label className={cn(chip, "relative cursor-pointer")}>
            {detail.dueDate ? (
              <>
                <span className="text-muted-foreground">Due</span>
                <DueLabel due={detail.dueDate} today={today} status={detail.status} />
              </>
            ) : (
              <span className="text-muted-foreground">Add due date</span>
            )}
            <input
              type="date"
              aria-label="Due date"
              value={detail.dueDate ?? ""}
              onChange={(event) => edit("dueDate", event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        ) : detail.dueDate ? (
          <span className={cn(chip, "hover:bg-background")}>
            Due <DueLabel due={detail.dueDate} today={today} status={detail.status} />
          </span>
        ) : null}

        <span className="text-xs text-muted-foreground">
          {detail.team.name}
          {detail.project ? ` · ${detail.project.name}` : ""} ·{" "}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                created by {detail.creator.name ?? detail.creator.email} {created.relative}
              </span>
            </TooltipTrigger>
            <TooltipContent>{created.absolute}</TooltipContent>
          </Tooltip>
        </span>
      </div>
    </header>
  );
}
