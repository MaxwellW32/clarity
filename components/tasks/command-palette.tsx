"use client";

import { Building2, Inbox, LayoutGrid, ListChecks, NotebookPen, Plus, Search, Settings, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { paletteSearch } from "@/actions/tasks";
import { StatusIcon } from "@/components/status-badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TaskListItem } from "@/lib/tasks/types";
import { useTaskActions } from "./task-actions";

const PLACES = [
  { href: "/overview", label: "Overview", icon: LayoutGrid },
  { href: "/my-work", label: "My Work", icon: ListChecks },
  { href: "/tasks", label: "Tasks", icon: Search },
  { href: "/team", label: "Team", icon: Users },
  { href: "/requests", label: "Requests", icon: Inbox },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/settings/organization", label: "Organization", icon: Building2 },
];

/** ⌘K / Ctrl+K: jump anywhere, start a task, or find one by title. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { openCreate, openUpdate, currentTaskId } = useTaskActions();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; items: TaskListItem[] }>({ q: "", items: [] });

  useEffect(() => {
    const q = query.trim();
    if (q === "") return;
    const timer = window.setTimeout(async () => {
      const result = await paletteSearch({ q });
      if (result.ok) setResults({ q, items: result.data });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };
  const term = query.trim().toLowerCase();
  const tasks = term !== "" && results.q.toLowerCase() === term ? results.items : [];
  const places = PLACES.filter((place) => term === "" || place.label.toLowerCase().includes(term));
  const showActions = term === "" || "new task".includes(term) || "update progress".includes(term);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="top-[20%] translate-y-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>Search tasks, start one, or go somewhere</DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search tasks or type a command…" />
          <CommandList className="max-h-[min(60dvh,420px)]">
            <CommandEmpty>{term === "" ? "Type to search." : "Nothing matches."}</CommandEmpty>
            {tasks.length > 0 ? (
              <CommandGroup heading="Tasks">
                {tasks.map((task) => (
                  <CommandItem key={task.id} value={`task-${task.id}`} onSelect={() => go(`/tasks/${task.id}`)}>
                    <StatusIcon status={task.status} />
                    <span className="truncate">{task.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {showActions ? (
              <CommandGroup heading="Actions">
                <CommandItem
                  value="new-task"
                  onSelect={() => {
                    close();
                    openCreate();
                  }}
                >
                  <Plus />
                  New task
                  <CommandShortcut>N</CommandShortcut>
                </CommandItem>
                {currentTaskId ? (
                  <CommandItem
                    value="update-progress"
                    onSelect={() => {
                      close();
                      openUpdate(currentTaskId);
                    }}
                  >
                    <NotebookPen />
                    Update progress
                    <CommandShortcut>U</CommandShortcut>
                  </CommandItem>
                ) : null}
              </CommandGroup>
            ) : null}
            {places.length > 0 ? (
              <CommandGroup heading="Go to">
                {places.map(({ href, label, icon: Icon }) => (
                  <CommandItem key={href} value={`go-${href}`} onSelect={() => go(href)}>
                    <Icon />
                    {label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
