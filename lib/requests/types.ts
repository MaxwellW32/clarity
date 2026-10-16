import type { RequestDecision, RequestStatus, RequestUrgency, TaskStatus } from "@/lib/constants";
import type { Person } from "@/lib/tasks/types";

// Request shapes that cross to the client: plain JSON, dates as ISO strings, days as "YYYY-MM-DD".

export type RequestListItem = {
  id: string;
  title: string;
  status: RequestStatus;
  urgency: RequestUrgency;
  teamId: string;
  teamName: string;
  requester: Person;
  createdAt: string;
  decidedAt: string | null;
  deferUntil: string | null;
  task: { id: string; status: TaskStatus } | null;
};

export type RequestDecisionItem = {
  id: string;
  decision: RequestDecision;
  reason: string | null;
  decider: Person;
  at: string;
};

export type RequestDetail = {
  id: string;
  title: string;
  description: string | null;
  desiredOutcome: string | null;
  urgency: RequestUrgency;
  link: string | null;
  status: RequestStatus;
  team: { id: string; name: string };
  requester: Person;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: Person | null;
  decisionReason: string | null;
  deferUntil: string | null;
  task: { id: string; title: string; status: TaskStatus; nextAction: string | null; latestProgress: string | null; assignee: Person | null } | null;
  decisions: RequestDecisionItem[];
};

export const REQUEST_VIEWS = ["open", "deferred", "decided", "all"] as const;
export type RequestView = (typeof REQUEST_VIEWS)[number];

export type RequestFilters = { view: RequestView; team: string; mine: boolean };
