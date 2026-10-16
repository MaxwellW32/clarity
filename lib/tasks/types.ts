import type { TaskActivityKind, TaskPriority, TaskSize, TaskStatus, TeamRole } from "@/lib/constants";

// Shapes that cross from server to client: plain JSON (dates as ISO strings, day dates as "YYYY-MM-DD").

export type Person = { id: string; name: string | null; email: string | null; image: string | null };

export type TaskListItem = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  nextAction: string | null;
  assignee: Person | null;
  teamName: string;
  updatedAt: string;
  /** My Work only: why it needs attention ("Overdue", "Your approval", …). */
  reason?: string;
};

export type TaskPage = { items: TaskListItem[]; nextCursor: string | null };

export type TeamOption = {
  id: string;
  name: string;
  members: (Person & { role: TeamRole })[];
  projects: { id: string; name: string }[];
};

export type TaskFormOptions = { viewerId: string; teams: TeamOption[] };

export type EvidenceLink = { id: string; url: string; label: string | null };

export type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  size: TaskSize | null;
  dueDate: string | null;
  team: { id: string; name: string };
  project: { id: string; name: string } | null;
  assignee: Person | null;
  approver: Person | null;
  creator: Person;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  blockedBy: string | null;
  rejectionReason: string | null;
  latestProgress: string | null;
  nextAction: string | null;
  completionSummary: string | null;
  lastUpdate: { author: Person; at: string } | null;
  request: { id: string; title: string } | null;
};

/** What the viewer may do on a task, decided on the server. */
export type TaskAbilities = { edit: boolean; progress: boolean; approve: boolean; reject: boolean };

/** A history row, already phrased and timed in the viewer's timezone. */
export type HistoryItem = {
  id: string;
  type: "update" | TaskActivityKind;
  actor: Person;
  phrase: string;
  change: { before: string | null; after: string | null } | null;
  note: string | null;
  progress: string | null;
  nextAction: string | null;
  blocker: string | null;
  at: string;
  day: string;
  dayLabel: string;
  time: string;
  absolute: string;
};

export type HistoryPage = { items: HistoryItem[]; nextCursor: string | null };
