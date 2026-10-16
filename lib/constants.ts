// Shared string unions: the database enums (db/schema.ts) and the UI read the same lists.

export const ORG_ROLES = ["admin", "member", "stakeholder"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const TEAM_ROLES = ["lead", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TASK_STATUSES = [
  "not_started",
  "in_progress",
  "awaiting_approval",
  "blocked",
  "rejected",
  "completed",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_SIZES = ["s", "m", "l"] as const;
export type TaskSize = (typeof TASK_SIZES)[number];

export const TASK_ACTIVITY_KINDS = [
  "created",
  "edited",
  "status_changed",
  "assigned",
  "handed_over",
  "due_changed",
  "priority_changed",
  "blocked",
  "unblocked",
  "approval_requested",
  "approved",
  "sent_back",
  "rejected",
  "completed",
  "reopened",
  "progress_updated",
  "evidence_added",
  "evidence_removed",
] as const;
export type TaskActivityKind = (typeof TASK_ACTIVITY_KINDS)[number];

export const PROJECT_STATUSES = ["active", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const GOAL_STATUSES = ["active", "achieved", "dropped"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const EXPECTATION_KINDS = ["milestone", "count"] as const;
export type ExpectationKind = (typeof EXPECTATION_KINDS)[number];

export const EXPECTATION_STATUSES = ["open", "met", "missed"] as const;
export type ExpectationStatus = (typeof EXPECTATION_STATUSES)[number];

export const REQUEST_URGENCIES = ["low", "normal", "high", "critical"] as const;
export type RequestUrgency = (typeof REQUEST_URGENCIES)[number];

export const REQUEST_STATUSES = [
  "new",
  "under_review",
  "approved",
  "deferred",
  "rejected",
  "converted",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_DECISIONS = [
  "under_review",
  "approved",
  "deferred",
  "rejected",
  "converted",
  "reopened",
] as const;
export type RequestDecision = (typeof REQUEST_DECISIONS)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Admin",
  member: "Member",
  stakeholder: "Stakeholder",
};

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  lead: "Lead",
  member: "Member",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  awaiting_approval: "Awaiting approval",
  blocked: "Blocked",
  rejected: "Rejected",
  completed: "Completed",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "New",
  under_review: "Under review",
  approved: "Approved",
  deferred: "Deferred",
  rejected: "Rejected",
  converted: "Converted to work",
};

export const REQUEST_URGENCY_LABELS: Record<RequestUrgency, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

export const TASK_SIZE_LABELS: Record<TaskSize, string> = { s: "Small", m: "Medium", l: "Large" };

export const DEFAULT_TIMEZONE = "America/Jamaica";

/** Cookie holding the active organization id (validated against membership on every request). */
export const ORG_COOKIE = "clarity.org";

export const INVITE_TTL_DAYS = 7;

export const APP_NAME = "Clarity";
