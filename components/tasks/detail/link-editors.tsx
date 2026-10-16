"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { editTask } from "@/actions/tasks";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toastResult } from "@/lib/toast-result";

/** Picks a goal or an expectation for the task; shows a link to it when set. */
export function LinkEditor({
  taskId,
  field,
  current,
  options,
  editable,
  link,
  none,
}: {
  taskId: string;
  field: "goalId" | "expectationId";
  current: { id: string; title: string } | null;
  options: { id: string; title: string }[];
  editable: boolean;
  /** Where "Open" goes: a prefix the id is appended to, or one fixed address. */
  link: { prefix: string } | { fixed: string };
  none: string;
}) {
  const [pending, startTransition] = useTransition();
  const href = (id: string) => ("prefix" in link ? `${link.prefix}${id}` : link.fixed);
  if (!editable) {
    return current ? (
      <Link href={href(current.id)} className="text-link underline-offset-4 hover:underline">
        {current.title}
      </Link>
    ) : (
      <span className="text-muted-foreground">{none}</span>
    );
  }
  const known = current && !options.some((option) => option.id === current.id) ? [current, ...options] : options;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label={field === "goalId" ? "Goal" : "Expectation"}
        className="inline-block w-full max-w-xs"
        value={current?.id ?? ""}
        disabled={pending}
        onChange={(event) => startTransition(async () => void toastResult(await editTask({ taskId, field, value: event.target.value }), "Saved."))}
      >
        <option value="">{none}</option>
        {known.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </NativeSelect>
      {current ? (
        <Link href={href(current.id)} className="text-xs text-link underline-offset-4 hover:underline">
          Open
        </Link>
      ) : null}
    </div>
  );
}

/** "Why it mattered": the human-written impact note reports quote. Prominent once the task is done. */
export function ImpactEditor({ taskId, impactNote, editable, completed }: { taskId: string; impactNote: string | null; editable: boolean; completed: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(impactNote ?? "");
  const [pending, startTransition] = useTransition();
  if (!impactNote && !editable) return null;

  if (editing) {
    return (
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            if (toastResult(await editTask({ taskId, field: "impactNote", value }), "Impact note saved.")) setEditing(false);
          });
        }}
      >
        <label htmlFor={`impact-${taskId}`} className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Why it mattered
        </label>
        <Textarea
          id={`impact-${taskId}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={3}
          autoFocus
          placeholder="What changed for the business, in one or two sentences. Reports quote this."
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setValue(impactNote ?? "");
              setEditing(false);
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit();
          }}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Why it mattered</p>
        {impactNote ? (
          <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-line">{impactNote}</p>
        ) : (
          <p className="mt-0.5 text-sm text-muted-foreground">{completed ? "Add a line on what this changed; reports and My Impact quote it." : "Optional: what this changes for the business. Reports quote it."}</p>
        )}
      </div>
      {editable ? (
        <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => setEditing(true)} aria-label="Edit impact note">
          <Pencil aria-hidden />
          {impactNote ? "Edit" : "Add"}
        </Button>
      ) : null}
    </div>
  );
}
