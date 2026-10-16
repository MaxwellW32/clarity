import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionPanel } from "@/components/requests/decision-panel";
import { RequestStatusBadge, UrgencyBadge } from "@/components/requests/request-badges";
import { StatusBadge } from "@/components/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { type RequestDecision } from "@/lib/constants";
import { listTeams } from "@/lib/dal/orgs";
import { getRequest } from "@/lib/dal/requests";
import { canReadRequest, canTriageRequest } from "@/lib/permissions";
import type { Person } from "@/lib/tasks/types";
import { formatAbsolute, formatDay, formatRelative, dayKey } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Request" };

const nameOf = (person: Person | null | undefined) => person?.name ?? person?.email ?? "someone";

const PHRASES: Record<RequestDecision, string> = {
  under_review: "started reviewing it",
  approved: "approved it",
  deferred: "deferred it",
  rejected: "rejected it",
  converted: "turned it into a task",
  reopened: "reopened it",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border bg-card">
      <h2 className="border-b px-5 py-3 text-sm font-semibold md:px-6">{title}</h2>
      <div className="grid gap-4 px-5 py-4 md:px-6">{children}</div>
    </section>
  );
}

export default async function RequestPage(props: PageProps<"/requests/[id]">) {
  const { id } = await props.params;
  const viewer = await requireViewer();
  const found = await getRequest(viewer, id);
  if (found === null || !canReadRequest(viewer, found.scope)) notFound();
  const { detail } = found;
  const canTriage = canTriageRequest(viewer, found.scope);
  const members = canTriage ? ((await listTeams(viewer)).find((team) => team.id === detail.team.id)?.members ?? []).map(({ userId, name, email, image }) => ({ id: userId, name, email, image })) : [];
  const now = new Date();
  const today = dayKey(now, viewer.timezone);
  const when = (iso: string) => ({ relative: formatRelative(new Date(iso), now, viewer.timezone), absolute: formatAbsolute(new Date(iso), viewer.timezone) });
  const submitted = when(detail.createdAt);

  const statusLine = (() => {
    if (detail.status === "new") return `Waiting for a ${detail.team.name} lead to review it.`;
    const by = detail.decidedBy ? nameOf(detail.decidedBy) : "the team";
    const at = detail.decidedAt ? when(detail.decidedAt).relative : "";
    switch (detail.status) {
      case "under_review":
        return `${by} is reviewing it (since ${at}).`;
      case "approved":
        return `Approved by ${by} ${at}. It will become a task when the team schedules it.`;
      case "deferred":
        return `Deferred by ${by} ${at}${detail.deferUntil ? `, to be revisited ${formatDay(detail.deferUntil, today)}` : ""}.`;
      case "rejected":
        return `Rejected by ${by} ${at}.`;
      case "converted":
        return `Turned into a task by ${by} ${at}.`;
    }
  })();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <Link href="/requests" className="inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden />
          Requests
        </Link>
        <h1 className="mt-2 text-lg leading-snug font-semibold tracking-tight md:text-xl">{detail.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <RequestStatusBadge status={detail.status} />
          <UrgencyBadge urgency={detail.urgency} />
          <span>{detail.team.name}</span>
          <span className="inline-flex items-center gap-1.5">
            <UserAvatar name={detail.requester.name} email={detail.requester.email} image={detail.requester.image} size="sm" className="size-4" />
            {nameOf(detail.requester)}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>submitted {submitted.relative}</span>
            </TooltipTrigger>
            <TooltipContent>{submitted.absolute}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="grid gap-5">
        <section className="rounded-xl border bg-card px-5 py-4 md:px-6">
          <p className="text-sm">{statusLine}</p>
          {detail.decisionReason && detail.status !== "new" ? <p className="mt-1.5 text-sm text-muted-foreground italic">“{detail.decisionReason}”</p> : null}
          {canTriage && detail.status !== "converted" ? (
            <div className="mt-4 border-t pt-4">
              <DecisionPanel request={{ id: detail.id, status: detail.status, title: detail.title }} members={members} />
            </div>
          ) : null}
        </section>

        {detail.task ? (
          <Card title="The work it became">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.task.status} />
              <Link href={`/tasks/${detail.task.id}`} className="text-sm font-medium text-link underline-offset-4 hover:underline">
                {detail.task.title}
              </Link>
              {detail.task.assignee ? <span className="text-xs text-muted-foreground">· {nameOf(detail.task.assignee)}</span> : null}
            </div>
            {detail.task.nextAction ? (
              <div>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Next action</p>
                <p className="mt-0.5 text-sm font-medium">{detail.task.nextAction}</p>
              </div>
            ) : null}
            {detail.task.latestProgress ? (
              <div>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Latest progress</p>
                <p className="mt-0.5 text-sm whitespace-pre-line">{detail.task.latestProgress}</p>
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card title="The ask">
          {detail.desiredOutcome ? (
            <div>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Why it matters</p>
              <p className="mt-0.5 text-sm whitespace-pre-line">{detail.desiredOutcome}</p>
            </div>
          ) : null}
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Details</p>
            {detail.description ? <p className="mt-0.5 text-sm whitespace-pre-line">{detail.description}</p> : <p className="mt-0.5 text-sm text-muted-foreground">No further details.</p>}
          </div>
          {detail.link ? (
            <a href={detail.link} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent">
              <ExternalLink className="size-3 text-muted-foreground" aria-hidden />
              {new URL(detail.link).hostname.replace(/^www\./, "")}
            </a>
          ) : null}
        </Card>

        <Card title="Decision history">
          {detail.decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions yet.</p>
          ) : (
            <ol className="grid gap-3">
              {detail.decisions.map((decision) => {
                const at = when(decision.at);
                return (
                  <li key={decision.id} className="flex gap-3">
                    <UserAvatar name={decision.decider.name} email={decision.decider.email} image={decision.decider.image} size="sm" className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <p>
                          <span className="font-medium">{nameOf(decision.decider)}</span> <span className="text-muted-foreground">{PHRASES[decision.decision]}</span>
                        </p>
                        <time dateTime={decision.at} title={at.absolute} className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {at.relative}
                        </time>
                      </div>
                      {decision.reason ? <p className="mt-0.5 text-sm text-muted-foreground italic">“{decision.reason}”</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
