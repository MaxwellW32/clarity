import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InlineUpdate } from "@/components/tasks/detail/inline-update";
import { ResumeCard } from "@/components/tasks/detail/resume-card";
import { TaskDetails } from "@/components/tasks/detail/task-details";
import { TaskHeader } from "@/components/tasks/detail/task-header";
import { TaskHistory } from "@/components/tasks/detail/task-history";
import { CurrentTask } from "@/components/tasks/task-actions";
import { listHistory } from "@/lib/dal/history";
import { getTask, linkOptions, listEvidence, taskPeople } from "@/lib/dal/tasks";
import { canApproveTask, canEditTask, canReadTask, canUpdateProgress } from "@/lib/permissions";
import { defaultApproverFor } from "@/lib/tasks/approver";
import type { TaskAbilities } from "@/lib/tasks/types";
import { dayKey, formatAbsolute, formatRelative } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Task" };

/**
 * The task page answers, in order: what is this (header), what happens next and what has happened (Resume
 * card), what do I do now (inline update), the details, then the full history.
 */
export default async function TaskPage(props: PageProps<"/tasks/[id]">) {
  const { id } = await props.params;
  const viewer = await requireViewer();
  // One round trip for everything; nothing is rendered unless the viewer may read the task.
  const [found, evidence, history, people, links] = await Promise.all([
    getTask(viewer, id),
    listEvidence(viewer, id),
    listHistory(viewer, id, null),
    taskPeople(viewer, id),
    linkOptions(viewer),
  ]);
  if (found === null || !canReadTask(viewer, found.scope)) notFound();
  const { detail, scope } = found;
  const abilities: TaskAbilities = {
    edit: canEditTask(viewer, scope),
    progress: canUpdateProgress(viewer, scope),
    approve: canApproveTask(viewer, scope),
    reject: canEditTask(viewer, scope),
  };
  const now = new Date();
  const today = dayKey(now, viewer.timezone);
  const when = (iso: string) => ({ relative: formatRelative(new Date(iso), now, viewer.timezone), absolute: formatAbsolute(new Date(iso), viewer.timezone) });
  const members = people.filter((person) => person.onTeam).map(({ id, name, email, image }) => ({ id, name, email, image }));

  return (
    <div className="mx-auto max-w-3xl">
      <CurrentTask id={detail.id} />
      <TaskHeader detail={detail} abilities={abilities} members={members} today={today} created={when(detail.createdAt)} />
      <div className="grid gap-5">
        <ResumeCard
          detail={detail}
          evidence={evidence}
          abilities={abilities}
          lastUpdate={detail.lastUpdate ? { author: detail.lastUpdate.author, ...when(detail.lastUpdate.at) } : null}
          completed={detail.completedAt ? when(detail.completedAt) : null}
        />
        {abilities.progress ? (
          <InlineUpdate
            context={{
              task: {
                id: detail.id,
                title: detail.title,
                status: detail.status,
                assigneeId: detail.assignee?.id ?? null,
                nextAction: detail.nextAction,
                blockedReason: detail.blockedReason,
                blockedBy: detail.blockedBy,
              },
              people,
              defaultApprover: defaultApproverFor(people, detail.approver?.id ?? null, detail.assignee?.id ?? null),
              abilities,
            }}
            fresh={detail.lastUpdate === null}
          />
        ) : null}
        <TaskDetails
          detail={detail}
          abilities={abilities}
          links={{
            goals: links.goals.filter((goal) => goal.teamId === null || goal.teamId === detail.team.id),
            expectations: links.expectations.filter((expectation) => expectation.teamId === detail.team.id),
          }}
          started={detail.startedAt ? when(detail.startedAt) : null}
          completed={detail.completedAt ? when(detail.completedAt) : null}
        />
        <TaskHistory taskId={detail.id} initial={history} />
      </div>
    </div>
  );
}
