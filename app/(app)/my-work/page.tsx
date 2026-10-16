import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskSection } from "@/components/tasks/task-section";
import { myWorkTasks } from "@/lib/dal/tasks";
import { canSeeTeamPages } from "@/lib/permissions";
import { tasksHref } from "@/lib/tasks/filters";
import { groupMyWork } from "@/lib/tasks/my-work";
import { dayKey } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "My Work" };

const CAP = 10;

/** Where you stopped and what's next: my work in four groups, each task in exactly one of them. */
export default async function MyWorkPage() {
  const viewer = await requireViewer();
  if (!canSeeTeamPages(viewer)) redirect("/overview");
  const today = dayKey(new Date(), viewer.timezone);
  const groups = groupMyWork(await myWorkTasks(viewer), viewer.userId, today);
  const nothing = groups.attention.length + groups.continueWorking.length + groups.waiting.length + groups.finished.length === 0;

  return (
    <>
      <PageHeader title="My Work" description="Where you stopped, and what's next." action={<NewTaskButton />} />
      {nothing ? (
        <EmptyState
          icon={ListChecks}
          title="Nothing is assigned to you yet"
          description="Tasks assigned to you show up here, grouped by what needs doing next. Create one to get started."
          action={<NewTaskButton variant="outline" />}
        />
      ) : (
        <div className="grid gap-8">
          {groups.attention.length > 0 ? (
            <TaskSection
              id="attention"
              title="Needs attention"
              description="Overdue, due soon, sent back, or waiting on your approval."
              items={groups.attention.slice(0, CAP)}
              total={groups.attention.length}
              today={today}
              seeAllHref={tasksHref({ assignee: "me", due: "overdue" })}
            />
          ) : null}
          <TaskSection
            id="continue"
            title="Continue working"
            items={groups.continueWorking.slice(0, CAP)}
            total={groups.continueWorking.length}
            today={today}
            seeAllHref={tasksHref({ assignee: "me", status: ["in_progress", "not_started"] })}
            empty="Nothing in progress. Pick something up from the task list, or create a task."
          />
          {groups.waiting.length > 0 ? (
            <TaskSection
              id="waiting"
              title="Waiting on others"
              description="Blocked, or waiting for an approval. Nothing for you to do until someone acts."
              items={groups.waiting.slice(0, CAP)}
              total={groups.waiting.length}
              today={today}
              seeAllHref={tasksHref({ assignee: "me", status: ["awaiting_approval", "blocked"] })}
            />
          ) : null}
          {groups.finished.length > 0 ? (
            <TaskSection
              id="finished"
              title="Recently finished"
              description="Completed in the last 14 days."
              items={groups.finished.slice(0, CAP)}
              total={groups.finished.length}
              today={today}
              seeAllHref={tasksHref({ assignee: "me", status: ["completed"], closed: true, sort: "updated" })}
            />
          ) : null}
        </div>
      )}
    </>
  );
}
