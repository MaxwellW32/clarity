"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createGoal, updateGoal } from "@/actions/goals";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Person } from "@/lib/tasks/types";
import { toastResult } from "@/lib/toast-result";

export type GoalFormValues = { title: string; description: string; successCriteria: string; teamId: string; ownerId: string; targetDate: string };

/** Create or edit a goal. Org-wide goals are an admin's; team goals belong to that team's leads. */
export function GoalDialog({
  mode,
  goalId,
  initial,
  teams,
  members,
  canOrgWide,
  viewerId,
}: {
  mode: "create" | "edit";
  goalId?: string;
  initial?: Partial<GoalFormValues>;
  /** Teams the viewer may create goals for. */
  teams: { id: string; name: string }[];
  members: Person[];
  canOrgWide: boolean;
  viewerId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<GoalFormValues>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    successCriteria: initial?.successCriteria ?? "",
    teamId: initial?.teamId ?? (canOrgWide ? "" : (teams[0]?.id ?? "")),
    ownerId: initial?.ownerId ?? viewerId,
    targetDate: initial?.targetDate ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof GoalFormValues>(key: K, value: GoalFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <>
      {mode === "create" ? (
        <Button onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          New goal
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil aria-hidden />
          Edit
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "New goal" : "Edit goal"}</DialogTitle>
            <DialogDescription>Keep it to what success looks like. Work links to it from each task.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = mode === "create" ? await createGoal(values) : await updateGoal({ goalId: goalId ?? "", ...values });
                if (!result.ok) {
                  setErrors(result.fieldErrors ?? { title: [result.error] });
                  return;
                }
                setErrors({});
                setOpen(false);
                if (mode === "create" && "data" in result && result.data && typeof result.data === "object" && "id" in result.data) {
                  const id = String(result.data.id);
                  toast.success("Goal created.", { action: { label: "Open", onClick: () => router.push(`/goals/${id}`) } });
                } else toastResult(result);
              });
            }}
          >
            <Field id="goal-title" label="Goal" error={errors.title?.[0]}>
              <Input id="goal-title" value={values.title} onChange={(event) => set("title", event.target.value)} placeholder="e.g. Cut p95 API latency below 300 ms" maxLength={200} autoFocus />
            </Field>
            <Field id="goal-criteria" label="Success looks like" hint="How you'll know it's achieved." error={errors.successCriteria?.[0]}>
              <Textarea id="goal-criteria" value={values.successCriteria} onChange={(event) => set("successCriteria", event.target.value)} rows={2} placeholder="e.g. p95 under 300 ms for 14 consecutive days" />
            </Field>
            <Field id="goal-description" label="Why it matters" hint="Optional.">
              <Textarea id="goal-description" value={values.description} onChange={(event) => set("description", event.target.value)} rows={2} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="goal-team" label="Scope">
                <NativeSelect id="goal-team" value={values.teamId} onChange={(event) => set("teamId", event.target.value)}>
                  {canOrgWide ? <option value="">Whole organization</option> : null}
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="goal-owner" label="Owner" error={errors.ownerId?.[0]}>
                <NativeSelect id="goal-owner" value={values.ownerId} onChange={(event) => set("ownerId", event.target.value)}>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name ?? member.email}
                      {member.id === viewerId ? " (me)" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="goal-target" label="Target date" hint="Optional." error={errors.targetDate?.[0]}>
                <Input id="goal-target" type="date" value={values.targetDate} onChange={(event) => set("targetDate", event.target.value)} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || values.title.trim() === ""}>
                {pending ? "Saving…" : mode === "create" ? "Create goal" : "Save goal"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
