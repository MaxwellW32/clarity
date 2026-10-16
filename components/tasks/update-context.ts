import type { TaskStatus } from "@/lib/constants";

/** What the update and status forms need about one task (actions/tasks.ts getUpdateContext, or the task page). */
export type UpdateContext = {
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    assigneeId: string | null;
    nextAction: string | null;
    blockedReason: string | null;
    blockedBy: string | null;
  };
  people: { id: string; name: string | null; email: string | null; image: string | null; onTeam: boolean; lead: boolean; admin: boolean }[];
  defaultApprover: string | null;
  abilities: { edit: boolean; progress: boolean; approve: boolean; reject: boolean };
};
