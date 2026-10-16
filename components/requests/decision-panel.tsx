"use client";

import { ArrowRight, Check, Pause, RotateCcw, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { convertRequest, decideRequest } from "@/actions/requests";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, type RequestStatus, type TaskPriority, type TaskSize } from "@/lib/constants";
import type { Person } from "@/lib/tasks/types";
import { toastResult } from "@/lib/toast-result";

type Decision = "under_review" | "approved" | "deferred" | "rejected" | "reopened";
type Mode = { kind: Decision } | { kind: "convert" } | null;

const DECISION_COPY: Record<Decision, { title: string; label: string; prompt: string; required: boolean }> = {
  under_review: { title: "Mark as under review", label: "Under review", prompt: "What are you checking before deciding? (optional)", required: false },
  approved: { title: "Approve this request", label: "Approve", prompt: "Why it's worth doing (optional, shown to the requester)", required: false },
  deferred: { title: "Defer this request", label: "Defer", prompt: "Why not now? (optional, shown to the requester)", required: false },
  rejected: { title: "Reject this request", label: "Reject", prompt: "Why? The requester sees this.", required: true },
  reopened: { title: "Reopen this request", label: "Reopen", prompt: "What changed? (optional)", required: false },
};

const nameOf = (person: Person) => person.name ?? person.email ?? "Someone";

/**
 * The reviewer's controls for one request. Which buttons show depends on its state; every click records a
 * decision with who, when and why. Convert creates a task that stays linked to the request.
 */
export function DecisionPanel({
  request,
  members,
  compact = false,
}: {
  request: { id: string; status: RequestStatus; title: string };
  members: Person[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState("");
  const [deferUntil, setDeferUntil] = useState("");
  const [title, setTitle] = useState(request.title);
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [size, setSize] = useState<TaskSize | "">("");
  const [dueDate, setDueDate] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  const close = () => {
    setMode(null);
    setReason("");
    setDeferUntil("");
    setErrors({});
  };
  const size_ = compact ? "sm" : "default";
  const { status } = request;
  if (status === "converted") return null;

  const decide = (decision: Decision) =>
    startTransition(async () => {
      const result = await decideRequest({ requestId: request.id, decision, reason, deferUntil: decision === "deferred" ? deferUntil : "" });
      if (toastResult(result)) close();
      else if (!result.ok) setErrors(result.fieldErrors ?? { reason: [result.error] });
    });

  const convert = () =>
    startTransition(async () => {
      const result = await convertRequest({ requestId: request.id, title, assigneeId, priority, size, dueDate, nextAction, reason });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? { title: [result.error] });
        return;
      }
      const taskId = result.data.taskId;
      toast.success("Task created from the request.", { action: { label: "Open task", onClick: () => router.push(`/tasks/${taskId}`) } });
      close();
    });

  const pendingDecision = status === "new" || status === "under_review";
  const buttons = (
    <div className="flex flex-wrap items-center gap-2">
      {status === "new" ? (
        <Button size={size_} variant="ghost" onClick={() => setMode({ kind: "under_review" })} disabled={pending}>
          <Search aria-hidden />
          Under review
        </Button>
      ) : null}
      {status === "deferred" || status === "rejected" ? (
        <Button size={size_} variant="outline" onClick={() => setMode({ kind: "reopened" })} disabled={pending}>
          <RotateCcw aria-hidden />
          Reopen
        </Button>
      ) : null}
      {pendingDecision || status === "deferred" ? (
        <Button size={size_} variant="outline" onClick={() => setMode({ kind: "approved" })} disabled={pending}>
          <Check aria-hidden />
          Approve
        </Button>
      ) : null}
      {pendingDecision || status === "approved" ? (
        <Button size={size_} variant="outline" onClick={() => setMode({ kind: "deferred" })} disabled={pending}>
          <Pause aria-hidden />
          Defer
        </Button>
      ) : null}
      {status !== "rejected" ? (
        <Button size={size_} variant="outline" className="text-destructive hover:text-destructive" onClick={() => setMode({ kind: "rejected" })} disabled={pending}>
          <X aria-hidden />
          Reject
        </Button>
      ) : null}
      {status !== "rejected" ? (
        <Button size={size_} onClick={() => setMode({ kind: "convert" })} disabled={pending}>
          <ArrowRight aria-hidden />
          Convert to task
        </Button>
      ) : null}
    </div>
  );

  return (
    <>
      {buttons}
      <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {mode?.kind === "convert" ? (
            <>
              <DialogHeader>
                <DialogTitle>Convert to a task</DialogTitle>
                <DialogDescription className="truncate">{request.title}</DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  convert();
                }}
              >
                <Field id="convert-title" label="Task title" error={errors.title?.[0]}>
                  <Input id="convert-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} autoFocus />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="convert-assignee" label="Assignee" error={errors.assigneeId?.[0]}>
                    <NativeSelect id="convert-assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                      <option value="">Unassigned</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {nameOf(member)}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field id="convert-due" label="Due" error={errors.dueDate?.[0]}>
                    <Input id="convert-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <div className="grid gap-2">
                    <span className="text-sm font-medium">Priority</span>
                    <Segmented label="Priority" value={priority} onChange={setPriority} options={[...TASK_PRIORITIES].reverse().map((value) => ({ value, label: TASK_PRIORITY_LABELS[value] }))} />
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
                <Field id="convert-next" label="First next action" hint="Optional: where whoever picks it up should start.">
                  <Input id="convert-next" value={nextAction} onChange={(event) => setNextAction(event.target.value)} maxLength={1000} />
                </Field>
                <Field id="convert-reason" label="Note for the requester" hint="Optional.">
                  <Input id="convert-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={close}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={pending || title.trim() === ""}>
                    {pending ? "Creating…" : "Create task"}
                  </Button>
                </div>
              </form>
            </>
          ) : mode !== null ? (
            <>
              <DialogHeader>
                <DialogTitle>{DECISION_COPY[mode.kind].title}</DialogTitle>
                <DialogDescription className="truncate">{request.title}</DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  decide(mode.kind);
                }}
              >
                <Field id="decision-reason" label={DECISION_COPY[mode.kind].prompt} error={errors.reason?.[0]}>
                  <Textarea id="decision-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} autoFocus aria-invalid={errors.reason ? true : undefined} />
                </Field>
                {mode.kind === "deferred" ? (
                  <Field id="decision-defer" label="Revisit on" hint="Optional. It comes back up in the weekly review on this date.">
                    <Input id="decision-defer" type="date" value={deferUntil} onChange={(event) => setDeferUntil(event.target.value)} />
                  </Field>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={close}>
                    Cancel
                  </Button>
                  <Button type="submit" variant={mode.kind === "rejected" ? "destructive" : "default"} disabled={pending || (DECISION_COPY[mode.kind].required && reason.trim() === "")}>
                    {pending ? "Saving…" : DECISION_COPY[mode.kind].label}
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
