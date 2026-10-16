import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { LastFilters } from "@/components/tasks/last-filters";
import { TaskList } from "@/components/tasks/task-list";
import { TaskToolbar } from "@/components/tasks/task-toolbar";
import { Button } from "@/components/ui/button";
import { listMembers, listTeams } from "@/lib/dal/orgs";
import { listTasks } from "@/lib/dal/tasks";
import { canSeeTeamPages } from "@/lib/permissions";
import { filtersToParams, isFiltered, parseFilters } from "@/lib/tasks/filters";
import { dayKey } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage(props: PageProps<"/tasks">) {
  const viewer = await requireViewer();
  if (!canSeeTeamPages(viewer)) redirect("/overview");
  const filters = parseFilters(await props.searchParams);
  const today = dayKey(new Date(), viewer.timezone);
  const [page, members, teams] = await Promise.all([listTasks(viewer, filters, { today }), listMembers(viewer), listTeams(viewer)]);
  const myTeams = teams.filter((team) => viewer.teamRoles.has(team.id)).map(({ id, name }) => ({ id, name }));
  const people = members.filter((member) => member.role !== "stakeholder").map(({ userId, name, email }) => ({ id: userId, name, email }));

  return (
    <>
      <PageHeader title="Tasks" description="Every task in the organization. Filters live in the address, so a view can be shared." action={<NewTaskButton />} />
      <TaskToolbar filters={filters} people={people} teams={myTeams} />
      <LastFilters current={filtersToParams(filters).toString()} />
      {page.items.length === 0 ? (
        isFiltered(filters) ? (
          <EmptyState
            icon={Search}
            title="Nothing matches these filters"
            action={
              <Button asChild variant="outline">
                <Link href="/tasks">Clear filters</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Search} title="No open tasks" description="Create the first one, or switch on Show closed to see finished work." action={<NewTaskButton />} />
        )
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <TaskList page={page} today={today} query={Object.fromEntries(filtersToParams(filters))} />
        </div>
      )}
    </>
  );
}
