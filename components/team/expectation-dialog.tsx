"use client";

import { Check, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createExpectation, deleteExpectation, setExpectationStatus } from "@/actions/goals";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ExpectationKind, ExpectationStatus } from "@/lib/constants";
import { toastResult } from "@/lib/toast-result";

function monthRange(today: string): { start: string; end: string } {
  const [year, month] = today.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${today.slice(0, 7)}-01`, end: `${today.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

/** A lead writes down what the team has agreed to deliver in a period. Tasks then link to it. */
export function NewExpectationDialog({ teamId, goals, today }: { teamId: string; goals: { id: string; title: string }[]; today: string }) {
  const [open, setOpen] = useState(false);
  const range = monthRange(today);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ExpectationKind>("milestone");
  const [targetCount, setTargetCount] = useState("3");
  const [periodStart, setPeriodStart] = useState(range.start);
  const [periodEnd, setPeriodEnd] = useState(range.end);
  const [goalId, setGoalId] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Add outcome
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agreed outcome</DialogTitle>
            <DialogDescription>A milestone, or a number of deliverables, for a period. Progress comes from the tasks linked to it.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await createExpectation({ teamId, title, description, kind, targetCount: kind === "count" ? Number(targetCount) : undefined, periodStart, periodEnd, goalId });
                if (!result.ok) {
                  setErrors(result.fieldErrors ?? { title: [result.error] });
                  return;
                }
                toastResult(result);
                setOpen(false);
                setTitle("");
                setDescription("");
                setErrors({});
              });
            }}
          >
            <Field id="exp-title" label="What's expected" error={errors.title?.[0]}>
              <Input id="exp-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Deliver three agreed platform milestones this month" maxLength={200} autoFocus />
            </Field>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Kind</span>
              <Segmented
                label="Kind"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "milestone", label: "Milestone" },
                  { value: "count", label: "A number of deliverables" },
                ]}
              />
            </div>
            {kind === "count" ? (
              <Field id="exp-target" label="How many" error={errors.targetCount?.[0]}>
                <Input id="exp-target" type="number" min={1} max={1000} value={targetCount} onChange={(event) => setTargetCount(event.target.value)} className="w-28" />
              </Field>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="exp-start" label="From" error={errors.periodStart?.[0]}>
                <Input id="exp-start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
              </Field>
              <Field id="exp-end" label="To" error={errors.periodEnd?.[0]}>
                <Input id="exp-end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
              </Field>
            </div>
            {goals.length > 0 ? (
              <Field id="exp-goal" label="Toward which goal" hint="Optional.">
                <NativeSelect id="exp-goal" value={goalId} onChange={(event) => setGoalId(event.target.value)}>
                  <option value="">None</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            <Field id="exp-description" label="Notes" hint="Optional: what was agreed, with whom.">
              <Textarea id="exp-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || title.trim() === ""}>
                {pending ? "Saving…" : "Add outcome"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ExpectationActions({ expectationId, status }: { expectationId: string; status: ExpectationStatus }) {
  const [pending, startTransition] = useTransition();
  const set = (next: ExpectationStatus) => startTransition(async () => void toastResult(await setExpectationStatus({ expectationId, status: next })));
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "open" ? (
        <>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={pending} onClick={() => set("met")}>
            <Check aria-hidden />
            Met
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs text-muted-foreground" disabled={pending} onClick={() => set("missed")}>
            <X aria-hidden />
            Missed
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={pending} onClick={() => set("open")}>
          <RotateCcw aria-hidden />
          Reopen
        </Button>
      )}
      <ConfirmDialog
        title="Remove this outcome?"
        description="Tasks linked to it keep their history; only the expectation itself goes."
        confirmLabel="Remove"
        onConfirm={() => startTransition(async () => void toastResult(await deleteExpectation({ expectationId })))}
        trigger={
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" disabled={pending} aria-label="Remove outcome">
            <Trash2 aria-hidden />
          </Button>
        }
      />
    </div>
  );
}
