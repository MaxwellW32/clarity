import { ArrowRight, ClipboardList, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskList } from "@/components/tasks/task-list";
import { NewExpectationDialog } from "@/components/team/expectation-dialog";
import { OutcomesList } from "@/components/team/outcomes";
import { CountTiles, DecisionsFeed, Workload } from "@/components/team/team-sections";
import { TeamToolbar } from "@/components/team/team-toolbar";
import { Button } from "@/components/ui/button";
import { listExpectations } from "@/lib/dal/goals";
import { listTeams } from "@/lib/dal/orgs";
import { countPendingRequests } from "@/lib/dal/requests";
import { attentionTasks, linkOptions } from "@/lib/dal/tasks";
import { teamCounts, teamFeed, teamWorkload } from "@/lib/dal/team";
import { canSeeTeamPages, leadsTeam } from "@/lib/permissions";
import { tasksHref } from "@/lib/tasks/filters";
import { parsePeriod } from "@/lib/team/period";
import { dayKey } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Team" };

function Panel({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The manager's 60-second read of a team: counts, what needs a hand, who holds what, and what changed. */
export default async function TeamPage(props: PageProps<"/team">) {
  const viewer = await requireViewer();
  if (!canSeeTeamPages(viewer)) redirect("/overview");
  const query = await props.searchParams;
  const teams = await listTeams(viewer);
  if (teams.length === 0) {
    return (
      <>
        <PageHeader title="Team" />
        <EmptyState icon={Users} title="No teams yet" description="An admin creates teams under Settings → Organization." />
      </>
    );
  }
  const asked = typeof query.team === "string" ? query.team : "";
  const team = teams.find((each) => each.id === asked) ?? teams.find((each) => viewer.teamRoles.has(each.id)) ?? teams[0];
  const days = parsePeriod(query.days);
  const now = new Date();
  const today = dayKey(now, viewer.timezone);
  const since = new Date(now.getTime() - days * 86_400_000);
  const leads = leadsTeam(viewer, team.id);
  const [counts, attention, workload, feed, pending, outcomes, links] = await Promise.all([
    teamCounts(viewer, team.id, today, since),
    attentionTasks(viewer, [team.id], today, 12),
    teamWorkload(viewer, team.id, today),
    teamFeed(viewer, [team.id], 12),
    leads ? countPendingRequests(viewer, [team.id]) : Promise.resolve(0),
    listExpectations(viewer, { teamId: team.id }),
    leads ? linkOptions(viewer) : Promise.resolve({ goals: [], expectations: [] }),
  ]);
  const goalChoices = links.goals.filter((goal) => goal.teamId === null || goal.teamId === team.id).map(({ id, title }) => ({ id, title }));
  const leadNames = team.members.filter((member) => member.role === "lead").map((member) => member.name ?? member.email);

  return (
    <>
      <PageHeader
        title={team.name}
        description={`${team.members.length} ${team.members.length === 1 ? "member" : "members"}${leadNames.length > 0 ? ` · led by ${leadNames.join(", ")}` : ""}${team.description ? ` · ${team.description}` : ""}`}
        action={<NewTaskButton />}
      />
      <TeamToolbar teams={teams.map(({ id, name }) => ({ id, name }))} teamId={team.id} days={days} />

      <div className="grid gap-6">
        <CountTiles counts={counts} teamId={team.id} days={days} />

        {pending > 0 ? (
          <Link href="/requests/review" className="flex items-center gap-3 rounded-lg border border-status-in-progress-dot/30 bg-status-in-progress-bg px-4 py-3 text-sm text-status-in-progress-fg transition-colors hover:bg-status-in-progress-bg/70">
            <ClipboardList className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">
              <span className="font-medium">
                {pending} {pending === 1 ? "request is" : "requests are"} waiting for a decision.
              </span>{" "}
              Open the weekly review to approve, defer or convert them.
            </span>
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        ) : null}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
          <div className="grid gap-6">
            <Panel
              title="Attention required"
              aside={
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link href={tasksHref({ team: team.id })}>All tasks</Link>
                </Button>
              }
            >
              {attention.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Nothing is overdue, blocked, waiting on approval or unassigned. Enjoy it.</p>
              ) : (
                <TaskList page={{ items: attention, nextCursor: null }} today={today} />
              )}
            </Panel>
            <Panel title="Recent decisions and activity">
              <DecisionsFeed items={feed} now={now} timeZone={viewer.timezone} />
            </Panel>
          </div>
          <div className="grid gap-6">
            <Panel title="Workload">
              <Workload rows={workload} teamId={team.id} />
            </Panel>
            <Panel title="Agreed outcomes" aside={leads ? <NewExpectationDialog teamId={team.id} goals={goalChoices} today={today} /> : null}>
              <OutcomesList items={outcomes} today={today} canManage={leads} teamId={team.id} />
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
