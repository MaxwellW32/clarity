import { ArrowRight, ClipboardList, Inbox, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { NewRequestDialog } from "@/components/requests/new-request-dialog";
import { RequestRow } from "@/components/requests/request-row";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskList } from "@/components/tasks/task-list";
import { CountTiles, DecisionsFeed } from "@/components/team/team-sections";
import { Button } from "@/components/ui/button";
import { ORG_ROLE_LABELS } from "@/lib/constants";
import { listTeams, managedTeamIds, type TeamWithMembers } from "@/lib/dal/orgs";
import { countPendingRequests, listRequests } from "@/lib/dal/requests";
import { attentionTasks, myWorkTasks } from "@/lib/dal/tasks";
import { teamCounts, teamFeed } from "@/lib/dal/team";
import { isAdmin, isManager, isStakeholder, type Viewer } from "@/lib/permissions";
import { groupMyWork } from "@/lib/tasks/my-work";
import { dayKey } from "@/lib/time";
import { teamHref } from "@/lib/team/period";
import { requireAppContext } from "@/lib/viewer";

export const metadata: Metadata = { title: "Overview" };

function greeting(timeZone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function Panel({ title, href, hrefLabel, children }: { title: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {hrefLabel ?? "See all"}
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** The first screen, shaped by role: a stakeholder's requests, a member's next steps, a manager's team health. */
export default async function OverviewPage() {
  const { viewer, user, org } = await requireAppContext();
  const firstName = (user.name ?? "").split(" ")[0] || null;
  const now = new Date();
  const today = dayKey(now, viewer.timezone);
  const title = `${greeting(viewer.timezone)}${firstName ? `, ${firstName}` : ""}`;

  if (isStakeholder(viewer)) return <StakeholderOverview viewer={viewer} title={title} now={now} today={today} />;

  const teams = await listTeams(viewer);
  const mine = teams.filter((team) => isAdmin(viewer) || viewer.teamRoles.has(team.id));
  const leads = teams.filter((team) => viewer.teamRoles.get(team.id) === "lead").map((team) => team.name);
  const description = [org.name, ORG_ROLE_LABELS[viewer.orgRole], leads.length > 0 ? `Leads ${leads.join(", ")}` : null].filter(Boolean).join(" · ");

  if (org.teamCount === 0 || mine.length === 0) {
    return (
      <>
        <PageHeader title={title} description={description} />
        <EmptyState
          icon={Users}
          title={org.teamCount === 0 ? "No teams yet" : "You aren't on a team yet"}
          description={org.teamCount === 0 ? "Your admin hasn't created a team yet. Your work will show up here once they do." : "Ask an admin to add you to a team; your work and your team's health will show up here."}
        />
      </>
    );
  }

  const manager = isManager(viewer);
  const managed = manager ? await managedTeamIds(viewer) : [];
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [workRows, attention, feed, pending, counts, requests] = await Promise.all([
    myWorkTasks(viewer),
    manager ? attentionTasks(viewer, managed, today, 8) : Promise.resolve([]),
    manager ? teamFeed(viewer, managed, 6) : Promise.resolve([]),
    manager ? countPendingRequests(viewer, managed) : Promise.resolve(0),
    Promise.all(mine.slice(0, 3).map(async (team) => ({ team, counts: await teamCounts(viewer, team.id, today, since) }))),
    listRequests(viewer, { view: "open", team: "", mine: true }, 3),
  ]);
  const groups = groupMyWork(workRows, viewer.userId, today);
  const next = [...groups.attention, ...groups.continueWorking].slice(0, 5);
  const myOpen = groups.attention.length + groups.continueWorking.length + groups.waiting.length;

  return (
    <>
      <PageHeader title={title} description={description} action={isAdmin(viewer) && viewer.teamRoles.size === 0 ? <InviteButton /> : <NewTaskButton />} />
      <div className="grid gap-6">
        {pending > 0 ? (
          <Link href="/requests/review" className="flex items-center gap-3 rounded-lg border border-status-in-progress-dot/30 bg-status-in-progress-bg px-4 py-3 text-sm text-status-in-progress-fg transition-colors hover:bg-status-in-progress-bg/70">
            <ClipboardList className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">
              <span className="font-medium">
                {pending} {pending === 1 ? "request is" : "requests are"} waiting for your decision.
              </span>{" "}
              Open the weekly review.
            </span>
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        ) : null}

        {counts.map(({ team, counts: c }) => (
          <section key={team.id} aria-label={`${team.name} overview`} className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3 px-0.5">
              <h2 className="text-sm font-semibold">{team.name}</h2>
              <Link href={teamHref(team.id, 30)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                Team dashboard
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
            <CountTiles counts={c} teamId={team.id} days={30} />
          </section>
        ))}

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Panel title="Pick up where you left off" href="/my-work" hrefLabel={myOpen > next.length ? `All ${myOpen} in My Work` : "My Work"}>
            {next.length === 0 ? (
              <div className="px-4 py-5 text-sm text-muted-foreground">
                Nothing is assigned to you. <NewTaskButton variant="outline" />
              </div>
            ) : (
              <TaskList page={{ items: next, nextCursor: null }} today={today} />
            )}
          </Panel>

          {manager ? (
            <Panel title="Needs your attention" href="/requests/review" hrefLabel="Weekly review">
              {attention.length === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">Nothing is overdue, blocked, waiting on approval or unassigned in your teams.</p> : <TaskList page={{ items: attention, nextCursor: null }} today={today} />}
            </Panel>
          ) : (
            <Panel title="Your requests" href="/requests?mine=1">
              {requests.length === 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground">
                  Need something from another team? <Link href="/requests" className="text-link underline-offset-4 hover:underline">Ask for it</Link>.
                </div>
              ) : (
                <ul className="divide-y">
                  {requests.map((request) => (
                    <RequestRow key={request.id} request={request} now={now} today={today} timeZone={viewer.timezone} />
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>

        {manager ? (
          <Panel title="Recent decisions and activity" href={teamHref(managed[0] ?? "", 30)} hrefLabel="Team dashboard">
            <DecisionsFeed items={feed} now={now} timeZone={viewer.timezone} />
          </Panel>
        ) : null}
      </div>
    </>
  );
}

function InviteButton() {
  return (
    <Button asChild>
      <Link href="/settings/organization#invite">
        <UserPlus aria-hidden />
        Invite people
      </Link>
    </Button>
  );
}

async function StakeholderOverview({ viewer, title, now, today }: { viewer: Viewer; title: string; now: Date; today: string }) {
  const [teams, requests] = await Promise.all([listTeams(viewer), listRequests(viewer, { view: "all", team: "", mine: true }, 20)]);
  const teamOptions = teams.map(({ id, name }: TeamWithMembers) => ({ id, name }));
  const open = requests.filter((request) => request.status === "new" || request.status === "under_review");
  return (
    <>
      <PageHeader title={title} description="Ask a team for what you need, and follow what happens to it." action={<NewRequestDialog teams={teamOptions} />} />
      {requests.length === 0 ? (
        <EmptyState icon={Inbox} title="You haven't asked for anything yet" description="Submit a request and the team will see it in their weekly review. You'll see every decision here, with the reason." />
      ) : (
        <div className="grid gap-6">
          <Panel title={open.length > 0 ? `Waiting on a decision · ${open.length}` : "Your requests"} href="/requests">
            <ul className="divide-y">
              {(open.length > 0 ? open : requests).slice(0, 10).map((request) => (
                <RequestRow key={request.id} request={request} now={now} today={today} timeZone={viewer.timezone} />
              ))}
            </ul>
          </Panel>
          {open.length > 0 && requests.length > open.length ? (
            <Panel title="Decided" href="/requests?view=decided">
              <ul className="divide-y">
                {requests
                  .filter((request) => !open.includes(request))
                  .slice(0, 5)
                  .map((request) => (
                    <RequestRow key={request.id} request={request} now={now} today={today} timeZone={viewer.timezone} />
                  ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      )}
    </>
  );
}
