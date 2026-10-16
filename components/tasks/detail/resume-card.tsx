import { CheckCircle2, Clock, OctagonAlert, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EvidenceLink, Person, TaskAbilities, TaskDetail } from "@/lib/tasks/types";
import { EvidenceChips } from "../evidence-chips";
import { ApprovalActions, UnblockButton } from "./resume-actions";

type When = { relative: string; absolute: string };

const nameOf = (person: Person | null | undefined) => person?.name ?? person?.email ?? "someone";

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{children}</p>;
}

function Stamp({ when, prefix }: { when: When; prefix: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          {prefix} {when.relative}
        </span>
      </TooltipTrigger>
      <TooltipContent>{when.absolute}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The Resume card (docs/PLAN.md §5): what happens next, what has happened, what's in the way, and the proof.
 * It sits above everything else so an interrupted task can be picked up without reading its history.
 */
export function ResumeCard({
  detail,
  evidence,
  abilities,
  lastUpdate,
  completed,
}: {
  detail: TaskDetail;
  evidence: EvidenceLink[];
  abilities: TaskAbilities;
  lastUpdate: ({ author: Person } & When) | null;
  completed: When | null;
}) {
  const strip =
    detail.status === "blocked" ? (
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-status-blocked-dot/30 bg-status-blocked-bg px-5 py-3 text-status-blocked-fg md:px-6">
        <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <p>
            <span className="font-medium">Blocked</span>
            {detail.blockedReason ? ` · ${detail.blockedReason}` : ""}
          </p>
          {detail.blockedBy ? <p className="mt-0.5 text-xs opacity-80">Waiting on {detail.blockedBy}</p> : null}
        </div>
        {abilities.progress ? <UnblockButton taskId={detail.id} /> : null}
      </div>
    ) : detail.status === "awaiting_approval" ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-status-awaiting-dot/30 bg-status-awaiting-bg px-5 py-3 text-status-awaiting-fg md:px-6">
        <Clock className="size-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Awaiting approval</span>
          {detail.approver ? ` from ${nameOf(detail.approver)}` : ""}
        </p>
        {abilities.approve ? <ApprovalActions taskId={detail.id} /> : null}
      </div>
    ) : detail.status === "completed" ? (
      <div className="flex items-start gap-3 border-b border-status-completed-dot/30 bg-status-completed-bg px-5 py-3 text-sm text-status-completed-fg md:px-6">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium">{completed ? <Stamp when={completed} prefix="Completed" /> : "Completed"}</p>
          {detail.completionSummary ? <p className="mt-0.5 whitespace-pre-line opacity-90">{detail.completionSummary}</p> : null}
        </div>
      </div>
    ) : detail.status === "rejected" ? (
      <div className="flex items-start gap-3 border-b bg-status-rejected-bg px-5 py-3 text-sm text-status-rejected-fg md:px-6">
        <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium">Rejected</span>
          {detail.rejectionReason ? ` · ${detail.rejectionReason}` : ""}
        </p>
      </div>
    ) : null;

  return (
    <section aria-label="Where this task stands" className="overflow-hidden rounded-xl border bg-card">
      {strip}
      <div className="grid gap-5 px-5 py-5 md:px-6">
        <div className="grid gap-1.5">
          <Label>Next action</Label>
          {detail.nextAction ? (
            <p className="text-lg leading-snug font-semibold whitespace-pre-line">{detail.nextAction}</p>
          ) : (
            <p className="text-base text-muted-foreground">
              {detail.status === "completed" || detail.status === "rejected"
                ? "Nothing left to do."
                : abilities.progress
                  ? "No next action yet. Leave one below so you know where to pick up."
                  : "No next action recorded yet."}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label>Latest progress</Label>
          {detail.latestProgress ? (
            <p className="text-sm leading-relaxed whitespace-pre-line">{detail.latestProgress}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No progress recorded yet.</p>
          )}
        </div>
        {evidence.length > 0 ? (
          <div className="grid gap-1.5">
            <Label>Evidence</Label>
            <EvidenceChips links={evidence} />
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {lastUpdate ? (
            <>
              Updated by {nameOf(lastUpdate.author)} · <Stamp when={lastUpdate} prefix="" />
            </>
          ) : (
            "No updates yet."
          )}
        </p>
      </div>
    </section>
  );
}
