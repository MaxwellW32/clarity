"use client";

import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { renameOrganization } from "@/actions/org";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastResult } from "@/lib/toast-result";

/** The organisation's name and facts, with an inline rename for admins. */
export function OrgName({ name, facts, canManage }: { name: string; facts: string; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        className="grid gap-3 rounded-lg border bg-card p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await renameOrganization({ name: value });
            if (toastResult(result)) {
              setEditing(false);
              setError(undefined);
            } else if (!result.ok) setError(result.fieldErrors?.name?.[0] ?? result.error);
          });
        }}
      >
        <Field id="org-rename" label="Organisation name" hint="Your company or group, e.g. Intellibus" error={error}>
          <Input
            id="org-rename"
            value={value}
            maxLength={80}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setEditing(false);
                setValue(name);
              }
            }}
            aria-invalid={error ? true : undefined}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setValue(name);
              setError(undefined);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || value.trim().length < 2 || value.trim() === name}>
            {pending ? "Saving…" : "Save name"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold">{name}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{facts}</p>
      </div>
      {canManage ? (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
          Rename
        </Button>
      ) : null}
    </div>
  );
}
