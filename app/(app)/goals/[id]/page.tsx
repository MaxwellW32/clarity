import { ArrowLeft, Building2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GoalDialog } from "@/components/goals/goal-dialog";
import { GoalProgress, GoalStatusBadge } from "@/components/goals/goal-parts";
import { GoalStatusActions } from "@/components/goals/goal-status-actions";
import { TaskList } from "@/components/tasks/task-list";
import { OutcomesList } from "@/components/team/outcomes";
import { UserAvatar } from "@/components/user-avatar";
import { getGoal, listExpectations } from "@/lib/dal/goals";
import { listMembers, listTeams } from "@/lib/dal/orgs";
import { linkedTasks } from "@/lib/dal/tasks";
import { canManageGoal, canReadGoals, isAdmin, leadsTeam } from "@/lib/permissions";
import { dayKey, formatDay } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Goal" };

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3 md:px-6">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default async function GoalPage(props: PageProps<"/goals/[id]">) {
  const { id } = await props.params;
  const viewer = await requireViewer();
  if (!canReadGoals(viewer)) redirect("/overview");
  const goal = await getGoal(viewer, id);
  if (goal === null) notFound();
  const manage = canManageGoal(viewer, goal.team?.id ?? null);
  const [tasks, expectations, teams, members] = await Promise.all([
    linkedTasks(viewer, { goalId: goal.id }),
    listExpectations(viewer, { goalId: goal.id }),
    manage ? listTeams(viewer) : Promise.resolve([]),
    manage ? listMembers(viewer) : Promise.resolve([]),
  ]);
  const today = dayKey(new Date(), viewer.timezone);
  const late = goal.status === "active" && goal.targetDate !== null && goal.targetDate < today;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <Link href="/goals" className="inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden />
          Goals
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <h1 className="min-w-0 flex-1 basis-80 text-lg leading-snug font-semibold tracking-tight md:text-xl">{goal.title}</h1>
          {manage ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <GoalDialog
                mode="edit"
                goalId={goal.id}
                initial={{ title: goal.title, description: goal.description ?? "", successCriteria: goal.successCriteria ?? "", teamId: goal.team?.id ?? "", ownerId: goal.owner.id, targetDate: goal.targetDate ?? "" }}
                teams={teams.filter((team) => leadsTeam(viewer, team.id)).map(({ id, name }) => ({ id, name }))}
                members={members.filter((member) => member.role !== "stakeholder").map(({ userId, name, email, image }) => ({ id: userId, name, email, image }))}
                canOrgWide={isAdmin(viewer)}
                viewerId={viewer.userId}
              />
              <GoalStatusActions goalId={goal.id} status={goal.status} />
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <GoalStatusBadge status={goal.status} />
          <span className="inline-flex items-center gap-1">
            {goal.team ? <Users className="size-3" aria-hidden /> : <Building2 className="size-3" aria-hidden />}
            {goal.team ? goal.team.name : "Whole organization"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UserAvatar name={goal.owner.name} email={goal.owner.email} image={goal.owner.image} size="sm" className="size-4" />
            {goal.owner.name ?? goal.owner.email}
          </span>
          {goal.targetDate ? <span className={late ? "font-medium text-priority-urgent" : undefined}>{late ? "Target passed" : "Target"} {formatDay(goal.targetDate, today)}</span> : null}
        </div>
      </header>

      <div className="grid gap-5">
        <section className="rounded-xl border bg-card px-5 py-4 md:px-6">
          {goal.successCriteria ? (
            <div>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Success looks like</p>
              <p className="mt-0.5 text-base font-medium whitespace-pre-line">{goal.successCriteria}</p>
            </div>
          ) : null}
          {goal.description ? <p className={goal.successCriteria ? "mt-3 text-sm text-muted-foreground whitespace-pre-line" : "text-sm whitespace-pre-line"}>{goal.description}</p> : null}
          {!goal.successCriteria && !goal.description ? <p className="text-sm text-muted-foreground">No description yet.</p> : null}
          <GoalProgress tasks={goal.tasks} className="mt-4" />
        </section>

        <Card title={`Linked work · ${tasks.length}`}>
          {tasks.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground md:px-6">No tasks link to this goal yet. Pick it under Goal on any task&apos;s details.</p>
          ) : (
            <TaskList page={{ items: tasks, nextCursor: null }} today={today} />
          )}
        </Card>

        {expectations.length > 0 ? (
          <Card title="Agreed outcomes toward this goal">
            <OutcomesList items={expectations} today={today} canManage={false} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
