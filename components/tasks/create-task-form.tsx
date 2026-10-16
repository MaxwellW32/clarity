"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createTask, getTaskFormOptions } from "@/actions/tasks";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, type TaskPriority, type TaskSize } from "@/lib/constants";
import type { TaskFormOptions } from "@/lib/tasks/types";

const LAST_TEAM = "clarity.lastTeam";

function readLastTeam(): string | null {
  try {
    return window.localStorage.getItem(LAST_TEAM);
  } catch {
    return null;
  }
}

function rememberTeam(teamId: string) {
  try {
    window.localStorage.setItem(LAST_TEAM, teamId);
  } catch {
    // private mode: the default just won't stick
  }
}

/** Title is all it needs; everything else has a sensible default. */
export function CreateTaskForm({ onDone, onCancel }: { onDone?: (id: string) => void; onCancel?: () => void }) {
  const router = useRouter();
  const [options, setOptions] = useState<TaskFormOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [teamId, setTeamId] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [size, setSize] = useState<TaskSize | "">("");
  const [description, setDescription] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [projectId, setProjectId] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    getTaskFormOptions().then((result) => {
      if (!live) return;
      if (!result.ok) return setLoadError(result.error);
      setOptions(result.data);
      const last = readLastTeam();
      const teams = result.data.teams;
      setTeamId(teams.find((team) => team.id === last)?.id ?? teams[0]?.id ?? "");
    });
    return () => {
      live = false;
    };
  }, []);

  const team = useMemo(() => options?.teams.find((each) => each.id === teamId) ?? null, [options, teamId]);
  const selfOnTeam = team?.members.some((member) => member.id === options?.viewerId) ?? false;
  // Default assignee is yourself when you're on the team; otherwise unassigned until chosen.
  const assignee = assigneeId ?? (selfOnTeam ? (options?.viewerId ?? "") : "");

  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (options === null) {
    return (
      <div className="grid gap-4" aria-busy="true">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (options.teams.length === 0) {
    return <p className="text-sm text-muted-foreground">Tasks belong to a team, and you aren&apos;t on one yet. Ask an admin to add you.</p>;
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await createTask({ title, teamId, assigneeId: assignee, priority, dueDate, size, description, nextAction, projectId });
          if (!result.ok) {
            setErrors(result.fieldErrors ?? { title: [result.error] });
            return;
          }
          rememberTeam(teamId);
          const id = result.data.id;
          toast.success("Task created.", { action: { label: "Open", onClick: () => router.push(`/tasks/${id}`) } });
          onDone?.(id);
        });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.requestSubmit();
      }}
    >
      <Field id="task-title" label="Title" error={errors.title?.[0]}>
        <Input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs doing?"
          maxLength={200}
          autoFocus
          aria-invalid={errors.title ? true : undefined}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {options.teams.length > 1 ? (
          <Field id="task-team" label="Team">
            <NativeSelect
              id="task-team"
              value={teamId}
              onChange={(event) => {
                setTeamId(event.target.value);
                setAssigneeId(null);
                setProjectId("");
              }}
            >
              {options.teams.map((each) => (
                <option key={each.id} value={each.id}>
                  {each.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        <Field id="task-assignee" label="Assignee" error={errors.assigneeId?.[0]}>
          <NativeSelect id="task-assignee" value={assignee} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">Unassigned</option>
            {team?.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.id === options.viewerId ? `${member.name ?? member.email} (me)` : (member.name ?? member.email)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="task-due" label="Due" error={errors.dueDate?.[0]}>
          <Input id="task-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
        {team && team.projects.length > 0 ? (
          <Field id="task-project" label="Project">
            <NativeSelect id="task-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">No project</option>
              {team.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div className="grid gap-2">
          <span className="text-sm font-medium">Priority</span>
          <Segmented
            label="Priority"
            value={priority}
            onChange={setPriority}
            options={[...TASK_PRIORITIES].reverse().map((value) => ({ value, label: TASK_PRIORITY_LABELS[value] }))}
          />
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium">Size</span>
          <Segmented
            label="Size"
            value={size}
            onChange={setSize}
            options={[
              { value: "", label: "–" },
              { value: "s", label: "S" },
              { value: "m", label: "M" },
              { value: "l", label: "L" },
            ]}
          />
        </div>
      </div>

      <Field id="task-next" label="First next action" hint="Optional: the very next step, so whoever picks it up knows where to start.">
        <Input id="task-next" value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="e.g. Reproduce it on staging" maxLength={1000} />
      </Field>
      <Field id="task-description" label="Description" hint="Optional.">
        <Textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={pending || title.trim() === "" || teamId === ""}>
          {pending ? "Creating…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
