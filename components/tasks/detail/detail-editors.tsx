"use client";

import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { editTask } from "@/actions/tasks";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TaskSize } from "@/lib/constants";
import { toastResult } from "@/lib/toast-result";

const SIZE_LABELS: Record<TaskSize, string> = { s: "Small", m: "Medium", l: "Large" };

export function DescriptionEditor({ taskId, description, editable }: { taskId: string; description: string | null; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description ?? "");
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            if (toastResult(await editTask({ taskId, field: "description", value }), "Description saved.")) setEditing(false);
          });
        }}
      >
        <Textarea
          aria-label="Description"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={4}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setValue(description ?? "");
              setEditing(false);
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit();
          }}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setValue(description ?? "");
              setEditing(false);
            }}
          >
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
    <div className="group flex items-start justify-between gap-3">
      {description ? (
        <p className="min-w-0 text-sm leading-relaxed whitespace-pre-line">{description}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{editable ? "No description. Add one if the title isn't enough." : "No description."}</p>
      )}
      {editable ? (
        <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => setEditing(true)} aria-label="Edit description">
          <Pencil aria-hidden />
          Edit
        </Button>
      ) : null}
    </div>
  );
}

export function SizeEditor({ taskId, size, editable }: { taskId: string; size: TaskSize | null; editable: boolean }) {
  const [pending, startTransition] = useTransition();
  if (!editable) return <span>{size ? SIZE_LABELS[size] : <span className="text-muted-foreground">Not set</span>}</span>;
  return (
    <NativeSelect
      aria-label="Size"
      className="inline-block w-32"
      value={size ?? ""}
      disabled={pending}
      onChange={(event) => startTransition(async () => void toastResult(await editTask({ taskId, field: "size", value: event.target.value as TaskSize | "" })))}
    >
      <option value="">Not set</option>
      <option value="s">Small</option>
      <option value="m">Medium</option>
      <option value="l">Large</option>
    </NativeSelect>
  );
}

export { ImpactEditor, LinkEditor } from "./link-editors";
