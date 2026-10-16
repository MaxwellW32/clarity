import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DecisionPanel } from "@/components/requests/decision-panel";
import { RequestRow } from "@/components/requests/request-row";
import { TaskList } from "@/components/tasks/task-list";
import { listTeams } from "@/lib/dal/orgs";
import { reviewQueue } from "@/lib/dal/requests";
import { isManager } from "@/lib/permissions";
import type { Person } from "@/lib/tasks/types";
import { dayKey } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Weekly review" };

function Section({ id, title, count, description, children }: { id: string; title: string; count: number; description: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-0.5">
        <div className="flex items-baseline gap-2">
          <h2 id={`${id}-heading`} className="text-sm font-semibold">
            {title}
          </h2>
          <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed bg-card px-4 py-5 text-sm text-muted-foreground">{children}</p>;
}

/** The meeting view: everything a lead must decide or chase, for the teams they lead, decidable in place. */
export default async function ReviewPage() {
  const viewer = await requireViewer();
  if (!isManager(viewer)) redirect("/requests");
  const now = new Date();
  const today = dayKey(now, viewer.timezone);
  const [queue, teams] = await Promise.all([reviewQueue(viewer, today), listTeams(viewer)]);
  const membersOf = (teamId: string): Person[] => (teams.find((team) => team.id === teamId)?.members ?? []).map(({ userId, name, email, image }) => ({ id: userId, name, email, image }));
  const teamNames = teams.filter((team) => queue.teamIds.includes(team.id)).map((team) => team.name);
  const rowProps = { now, today, timeZone: viewer.timezone };

  return (
    <>
      <Link href="/requests" className="mb-3 inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden />
        Requests
      </Link>
      <PageHeader
        title="Weekly review"
        description={teamNames.length > 0 ? `Decisions owed and commitments at risk for ${teamNames.join(", ")}. Decide here; everything is recorded.` : "You don't lead a team yet."}
      />
      <div className="grid gap-8">
        <Section id="pending" title="Needs a decision" count={queue.pending.length} description="New and under review, most urgent and longest-waiting first.">
          {queue.pending.length === 0 ? (
            <Empty>Nothing is waiting on you.</Empty>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {queue.pending.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  {...rowProps}
                  actions={<DecisionPanel compact request={{ id: request.id, status: request.status, title: request.title }} members={membersOf(request.teamId)} />}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section id="deferred" title="Deferred, worth another look" count={queue.deferred.length} description="Revisit dates that have passed come first.">
          {queue.deferred.length === 0 ? (
            <Empty>Nothing deferred.</Empty>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {queue.deferred.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  {...rowProps}
                  actions={<DecisionPanel compact request={{ id: request.id, status: request.status, title: request.title }} members={membersOf(request.teamId)} />}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section id="attention" title="Commitments needing attention" count={queue.attention.length} description="Overdue, blocked, awaiting approval, unassigned, or due within three days.">
          {queue.attention.length === 0 ? (
            <Empty>Every commitment is on track.</Empty>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <TaskList page={{ items: queue.attention, nextCursor: null }} today={today} />
            </div>
          )}
        </Section>

        <Section id="decided" title="Decided in the last 7 days" count={queue.decided.length} description="What the team committed to, and what it turned down.">
          {queue.decided.length === 0 ? (
            <Empty>No decisions in the last week.</Empty>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {queue.decided.map((request) => (
                <RequestRow key={request.id} request={request} {...rowProps} />
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
