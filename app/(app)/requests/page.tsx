import { ClipboardList, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { NewRequestDialog } from "@/components/requests/new-request-dialog";
import { RequestRow } from "@/components/requests/request-row";
import { RequestToolbar } from "@/components/requests/request-toolbar";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { listTeams, managedTeamIds } from "@/lib/dal/orgs";
import { countPendingRequests, listRequests } from "@/lib/dal/requests";
import { isManager, isStakeholder } from "@/lib/permissions";
import { parseRequestFilters } from "@/lib/requests/filters";
import { dayKey } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Requests" };

const EMPTY: Record<string, { title: string; description: string }> = {
  open: { title: "No open requests", description: "New requests land here until someone on the team decides on them." },
  deferred: { title: "Nothing deferred", description: "Requests put off for later show up here with their revisit date." },
  decided: { title: "Nothing decided yet", description: "Approved, converted and rejected requests are listed here with their reasons." },
  all: { title: "No requests yet", description: "Ask a team for something and it shows up here." },
};

export default async function RequestsPage(props: PageProps<"/requests">) {
  const viewer = await requireViewer();
  const filters = parseRequestFilters(await props.searchParams);
  const stakeholder = isStakeholder(viewer);
  const manager = isManager(viewer);
  const managed = manager ? await managedTeamIds(viewer) : [];
  const [items, teams, pending] = await Promise.all([listRequests(viewer, filters), listTeams(viewer), countPendingRequests(viewer, managed)]);
  const now = new Date();
  const today = dayKey(now, viewer.timezone);
  const teamOptions = teams.map(({ id, name }) => ({ id, name }));
  const empty = EMPTY[filters.view];

  return (
    <>
      <PageHeader
        title="Requests"
        description={stakeholder ? "What you've asked for, and what was decided." : "Incoming work. Nothing here is a commitment until a lead decides."}
        action={<NewRequestDialog teams={teamOptions} />}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <RequestToolbar filters={filters} teams={teamOptions} showMine={!stakeholder} />
        {manager ? (
          <Button asChild variant="outline" className="mb-4">
            <Link href="/requests/review">
              <ClipboardList aria-hidden />
              Weekly review
              {pending > 0 ? <span className="ml-1 rounded-full bg-status-in-progress-bg px-1.5 text-[11px] font-semibold text-status-in-progress-fg">{pending}</span> : null}
            </Link>
          </Button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Inbox} title={filters.mine ? "You haven't asked for anything in this view" : empty.title} description={empty.description} action={filters.view === "open" ? <NewRequestDialog teams={teamOptions} variant="outline" /> : null} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {items.map((request) => (
            <RequestRow key={request.id} request={request} now={now} today={today} timeZone={viewer.timezone} />
          ))}
        </ul>
      )}
    </>
  );
}
