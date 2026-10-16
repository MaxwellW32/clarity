"use client";

import { cn } from "cn";
import { Link2 } from "lucide-react";
import { useState, useTransition, type RefObject } from "react";
import { updateProgress } from "@/actions/tasks";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import { toastResult } from "@/lib/toast-result";
import type { UpdateContext } from "./update-context";

const nameOf = (person: { name: string | null; email: string | null }) => person.name ?? person.email ?? "Someone";

/** One compact form: progress, next action, and the optional blocker / evidence / handover / status. */
export function UpdateProgressForm({
  context,
  onSaved,
  autoFocus = false,
  progressRef,
}: {
  context: UpdateContext;
  onSaved?: () => void;
  autoFocus?: boolean;
  progressRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const { task, people, abilities } = context;
  const [progress, setProgress] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [blocked, setBlocked] = useState(task.status === "blocked");
  const [blockedReason, setBlockedReason] = useState(task.blockedReason ?? "");
  const [blockedBy, setBlockedBy] = useState(task.blockedBy ?? "");
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceLabel, setEvidenceLabel] = useState("");
  const [handOverTo, setHandOverTo] = useState("");
  const [markAs, setMarkAs] = useState<"" | "in_progress" | "awaiting_approval" | "completed">(task.status === "not_started" ? "in_progress" : "");
  const [approverId, setApproverId] = useState(context.defaultApprover ?? "");
  const [summary, setSummary] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  const teammates = people.filter((person) => person.onTeam && person.id !== task.assigneeId);
  const current = people.find((person) => person.id === task.assigneeId);
  const completing = markAs === "completed";
  const canComplete = task.status !== "awaiting_approval" || abilities.approve;
  const markOptions = (["in_progress", "awaiting_approval", "completed"] as const).filter(
    (status) => status !== task.status && (status !== "completed" || canComplete),
  );

  function submit() {
    startTransition(async () => {
      const result = await updateProgress({
        taskId: task.id,
        progress,
        nextAction,
        blocked,
        blockedReason: blocked ? blockedReason : "",
        blockedBy: blocked ? blockedBy : "",
        evidenceUrl: showEvidence ? evidenceUrl.trim() : "",
        evidenceLabel: showEvidence ? evidenceLabel : "",
        handOverTo,
        markAs: blocked ? "" : markAs,
        approverId: markAs === "awaiting_approval" ? approverId : "",
        summary: completing ? summary : "",
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? { progress: [result.error] });
        if (!result.fieldErrors) toastResult(result);
        return;
      }
      toastResult(result);
      setErrors({});
      setProgress("");
      setNextAction("");
      setEvidenceUrl("");
      setEvidenceLabel("");
      setShowEvidence(false);
      setHandOverTo("");
      setSummary("");
      onSaved?.();
    });
  }

  const error = (key: string) =>
    errors[key]?.[0] ? (
      <p className="text-xs text-destructive" id={`${key}-error`}>
        {errors[key]?.[0]}
      </p>
    ) : null;

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          submit();
        }
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor={`progress-${task.id}`}>Latest progress</Label>
        <Textarea
          id={`progress-${task.id}`}
          ref={progressRef}
          value={progress}
          onChange={(event) => setProgress(event.target.value)}
          placeholder="What did you get done?"
          rows={3}
          autoFocus={autoFocus}
          aria-invalid={errors.progress ? true : undefined}
        />
        {error("progress")}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`next-${task.id}`}>
          Next action
          {completing ? <span className="font-normal text-muted-foreground">(optional when completing)</span> : null}
        </Label>
        <Textarea
          id={`next-${task.id}`}
          value={nextAction}
          onChange={(event) => setNextAction(event.target.value)}
          placeholder={task.nextAction ? `Was: ${task.nextAction}` : "What exactly happens next?"}
          rows={2}
          aria-invalid={errors.nextAction ? true : undefined}
        />
        {error("nextAction")}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <Switch id={`blocked-${task.id}`} checked={blocked} onCheckedChange={setBlocked} />
          <Label htmlFor={`blocked-${task.id}`} className="font-normal">
            I&apos;m blocked
          </Label>
        </div>
        {!showEvidence ? (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowEvidence(true)}>
            <Link2 aria-hidden />
            Add evidence link
          </Button>
        ) : null}
      </div>

      {blocked ? (
        <div className="grid gap-3 rounded-md border border-status-blocked-dot/30 bg-status-blocked-bg/60 p-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Input
              aria-label="What is blocking it"
              placeholder="What's blocking it?"
              value={blockedReason}
              onChange={(event) => setBlockedReason(event.target.value)}
              aria-invalid={errors.blockedReason ? true : undefined}
              className="bg-background"
            />
            {error("blockedReason")}
          </div>
          <Input
            aria-label="Who or what can unblock it"
            placeholder="Who or what can unblock it? (optional)"
            value={blockedBy}
            onChange={(event) => setBlockedBy(event.target.value)}
            className="bg-background"
          />
        </div>
      ) : null}

      {showEvidence ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="grid gap-1.5">
            <Input
              aria-label="Evidence link"
              placeholder="https://…"
              value={evidenceUrl}
              onChange={(event) => setEvidenceUrl(event.target.value)}
              inputMode="url"
              aria-invalid={errors.evidenceUrl ? true : undefined}
            />
            {error("evidenceUrl")}
          </div>
          <Input aria-label="Evidence label" placeholder="Label (optional)" value={evidenceLabel} onChange={(event) => setEvidenceLabel(event.target.value)} />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`handover-${task.id}`} className="text-xs text-muted-foreground">
            Hand over to
          </Label>
          <NativeSelect id={`handover-${task.id}`} value={handOverTo} onChange={(event) => setHandOverTo(event.target.value)}>
            <option value="">{current ? `Keep with ${nameOf(current)}` : "Keep unassigned"}</option>
            {teammates.map((person) => (
              <option key={person.id} value={person.id}>
                {nameOf(person)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className={cn("grid gap-1.5", blocked && "opacity-50")}>
          <Label htmlFor={`mark-${task.id}`} className="text-xs text-muted-foreground">
            Mark as
          </Label>
          <NativeSelect
            id={`mark-${task.id}`}
            value={blocked ? "" : markAs}
            disabled={blocked}
            onChange={(event) => setMarkAs(event.target.value as typeof markAs)}
          >
            <option value="">Keep as {TASK_STATUS_LABELS[task.status].toLowerCase()}</option>
            {markOptions.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
          {error("markAs")}
        </div>
      </div>

      {!blocked && markAs === "awaiting_approval" ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`approver-${task.id}`} className="text-xs text-muted-foreground">
            Who approves it
          </Label>
          <NativeSelect id={`approver-${task.id}`} value={approverId} onChange={(event) => setApproverId(event.target.value)}>
            <option value="">Choose an approver…</option>
            {people
              .filter((person) => person.id !== task.assigneeId)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {nameOf(person)}
                  {person.lead ? " (lead)" : person.admin ? " (admin)" : ""}
                </option>
              ))}
          </NativeSelect>
          {error("approverId")}
        </div>
      ) : null}
      {!blocked && completing ? (
        <Textarea aria-label="Completion summary" placeholder="Completion summary (optional): what changed, and why it matters" value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} />
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <span className="hidden text-xs text-muted-foreground sm:inline">Ctrl+Enter to save</span>
        <Button type="submit" disabled={pending || progress.trim() === ""}>
          {pending ? "Saving…" : "Save update"}
        </Button>
      </div>
    </form>
  );
}
