import { cn } from "cn";
import { Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { GoalDialog } from "@/components/goals/goal-dialog";
import { GoalCard } from "@/components/goals/goal-parts";
import { PageHeader } from "@/components/page-header";
import { GOAL_STATUSES, type GoalStatus } from "@/lib/constants";
import { listGoals } from "@/lib/dal/goals";
import { listMembers, listTeams } from "@/lib/dal/orgs";
import { canReadGoals, isAdmin, isManager, leadsTeam } from "@/lib/permissions";
import { dayKey } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Goals" };

const VIEWS: { value: string; label: string; statuses: GoalStatus[] }[] = [
  { value: "active", label: "Active", statuses: ["active"] },
  { value: "achieved", label: "Achieved", statuses: ["achieved"] },
  { value: "dropped", label: "Dropped", statuses: ["dropped"] },
  { value: "all", label: "All", statuses: [...GOAL_STATUSES] },
];

/** What the organization is trying to achieve, and how much linked work is done. Not an OKR system. */
export default async function GoalsPage(props: PageProps<"/goals">) {
  const viewer = await requireViewer();
  if (!canReadGoals(viewer)) redirect("/overview");
  const query = await props.searchParams;
  const view = VIEWS.find((each) => each.value === query.status) ?? VIEWS[0];
  const manager = isManager(viewer);
  const [goals, teams, members] = await Promise.all([listGoals(viewer, view.statuses), listTeams(viewer), manager ? listMembers(viewer) : Promise.resolve([])]);
  const today = dayKey(new Date(), viewer.timezone);
  const myTeams = teams.filter((team) => leadsTeam(viewer, team.id)).map(({ id, name }) => ({ id, name }));
  const people = members.filter((member) => member.role !== "stakeholder").map(({ userId, name, email, image }) => ({ id: userId, name, email, image }));

  return (
    <>
      <PageHeader
        title="Goals"
        description="What the work is for. Link tasks to a goal and its progress is simply the work that got done."
        action={manager ? <GoalDialog mode="create" teams={myTeams} members={people} canOrgWide={isAdmin(viewer)} viewerId={viewer.userId} /> : null}
      />
      <div className="mb-4 inline-flex rounded-md border bg-background p-0.5" role="tablist" aria-label="Goal status">
        {VIEWS.map((each) => {
          const active = each.value === view.value;
          return (
            <Link
              key={each.value}
              role="tab"
              aria-selected={active}
              href={each.value === "active" ? "/goals" : `/goals?status=${each.value}`}
              replace
              scroll={false}
              className={cn(
                "h-7 rounded-[5px] px-2.5 text-xs leading-7 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {each.label}
            </Link>
          );
        })}
      </div>
      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title={view.value === "active" ? "No active goals" : `No ${view.label.toLowerCase()} goals`}
          description={manager ? "Write down what success looks like this quarter, then link the work that gets you there." : "Your leads haven't set goals yet. Once they do, you can link your tasks to them."}
          action={manager && view.value === "active" ? <GoalDialog mode="create" teams={myTeams} members={people} canOrgWide={isAdmin(viewer)} viewerId={viewer.userId} /> : null}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} today={today} />
          ))}
        </ul>
      )}
    </>
  );
}
