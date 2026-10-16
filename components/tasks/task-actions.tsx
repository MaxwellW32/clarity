"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getUpdateContext } from "@/actions/tasks";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { TaskStatus } from "@/lib/constants";
import { ShortcutsHelp } from "@/components/shell/shortcuts-help";
import { CommandPalette } from "./command-palette";
import { CreateTaskForm } from "./create-task-form";
import { TRANSITION_TITLES, TransitionForm } from "./transition-form";
import type { UpdateContext } from "./update-context";
import { UpdateProgressForm } from "./update-progress-form";

/** Fired on the task page to open and focus its inline Update Progress form. */
export const FOCUS_UPDATE_EVENT = "clarity:focus-update";

type TaskActions = {
  openCreate: () => void;
  openUpdate: (taskId: string) => void;
  openTransition: (taskId: string, status: TaskStatus) => void;
  openPalette: () => void;
  /** The task whose page is open, if any (registered by <CurrentTask> on the task page). */
  currentTaskId: string | null;
  setCurrentTask: (taskId: string | null) => void;
};

const TaskActionsContext = createContext<TaskActions | null>(null);

export function useTaskActions(): TaskActions {
  const value = use(TaskActionsContext);
  if (value === null) throw new Error("useTaskActions must be used inside TaskActionsProvider");
  return value;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.closest("[role=dialog]") !== null;
}

/** Loads what the forms need about one task, once per open. */
function useUpdateContext(taskId: string | null) {
  const [state, setState] = useState<{ taskId: string; context: UpdateContext | null; error: string | null } | null>(null);
  useEffect(() => {
    if (taskId === null) return;
    let live = true;
    getUpdateContext({ taskId }).then((result) => {
      if (live) setState({ taskId, context: result.ok ? result.data : null, error: result.ok ? null : result.error });
    });
    return () => {
      live = false;
    };
  }, [taskId]);
  return state !== null && state.taskId === taskId ? state : null;
}

function Loading() {
  return (
    <div className="grid gap-3" aria-busy="true">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-9 w-1/2" />
    </div>
  );
}

/** Rendered by the task page so U and the palette know which task is open; reading the URL here would block prerendering. */
export function CurrentTask({ id }: { id: string }) {
  const { setCurrentTask } = useTaskActions();
  useEffect(() => {
    setCurrentTask(id);
    return () => setCurrentTask(null);
  }, [id, setCurrentTask]);
  return null;
}

export function TaskActionsProvider({ children }: { children: ReactNode }) {
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateTaskId, setUpdateTaskId] = useState<string | null>(null);
  const [transition, setTransition] = useState<{ taskId: string; status: TaskStatus } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const openUpdate = useCallback(
    (taskId: string) => {
      // On the task's own page the inline form is the place to write it.
      if (taskId === currentTaskId && document.getElementById("update-progress")) window.dispatchEvent(new Event(FOCUS_UPDATE_EVENT));
      else setUpdateTaskId(taskId);
    },
    [currentTaskId],
  );

  const actions = useMemo<TaskActions>(
    () => ({
      openCreate: () => setCreateOpen(true),
      openUpdate,
      openTransition: (taskId, status) => setTransition({ taskId, status }),
      openPalette: () => setPaletteOpen(true),
      currentTaskId,
      setCurrentTask: setCurrentTaskId,
    }),
    [openUpdate, currentTaskId],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        setCreateOpen(true);
      } else if ((event.key === "u" || event.key === "U") && currentTaskId) {
        event.preventDefault();
        openUpdate(currentTaskId);
      } else if (event.key === "/") {
        const search = document.querySelector<HTMLInputElement>("[data-list-search]");
        if (search) {
          event.preventDefault();
          search.focus();
        }
      } else if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      } else if (event.key === "j" || event.key === "k") {
        // Roving focus through the task rows on the page; Enter then follows the focused link.
        const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-task-link]")];
        if (links.length === 0) return;
        event.preventDefault();
        const index = links.findIndex((link) => link === document.activeElement);
        const next = event.key === "j" ? Math.min(links.length - 1, index + 1) : Math.max(0, index <= 0 ? 0 : index - 1);
        links[next]?.focus();
        links[next]?.scrollIntoView({ block: "nearest" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentTaskId, openUpdate]);

  const updateState = useUpdateContext(updateTaskId);
  const transitionState = useUpdateContext(transition?.taskId ?? null);

  return (
    <TaskActionsContext value={actions}>
      {children}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription className="sr-only">Create a task</DialogDescription>
          </DialogHeader>
          {createOpen ? <CreateTaskForm onDone={() => setCreateOpen(false)} onCancel={() => setCreateOpen(false)} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={updateTaskId !== null} onOpenChange={(open) => !open && setUpdateTaskId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update progress</DialogTitle>
            <DialogDescription className="truncate">{updateState?.context?.task.title ?? " "}</DialogDescription>
          </DialogHeader>
          {updateState === null ? (
            <Loading />
          ) : updateState.context === null ? (
            <p className="text-sm text-destructive">{updateState.error}</p>
          ) : !updateState.context.abilities.progress ? (
            <p className="text-sm text-muted-foreground">You can follow this task, but only its team can update it.</p>
          ) : (
            <UpdateProgressForm context={updateState.context} autoFocus onSaved={() => setUpdateTaskId(null)} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={transition !== null} onOpenChange={(open) => !open && setTransition(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{transition ? (TRANSITION_TITLES[transition.status] ?? "Change status") : "Change status"}</DialogTitle>
            <DialogDescription className="truncate">{transitionState?.context?.task.title ?? " "}</DialogDescription>
          </DialogHeader>
          {transition === null || transitionState === null ? (
            <Loading />
          ) : transitionState.context === null ? (
            <p className="text-sm text-destructive">{transitionState.error}</p>
          ) : (
            <TransitionForm context={transitionState.context} status={transition.status} onDone={() => setTransition(null)} />
          )}
        </DialogContent>
      </Dialog>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </TaskActionsContext>
  );
}
