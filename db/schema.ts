import type { AdapterAccountType } from "@auth/core/adapters";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  DEFAULT_TIMEZONE,
  EXPECTATION_KINDS,
  EXPECTATION_STATUSES,
  GOAL_STATUSES,
  ORG_ROLES,
  PROJECT_STATUSES,
  REQUEST_DECISIONS,
  REQUEST_STATUSES,
  REQUEST_URGENCIES,
  TASK_ACTIVITY_KINDS,
  TASK_PRIORITIES,
  TASK_SIZES,
  TASK_STATUSES,
  TEAM_ROLES,
} from "@/lib/constants";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const day = (name: string) => date(name, { mode: "string" });

// --- enums ------------------------------------------------------------------

export const orgRoleEnum = pgEnum("org_role", ORG_ROLES);
export const teamRoleEnum = pgEnum("team_role", TEAM_ROLES);
export const projectStatusEnum = pgEnum("project_status", PROJECT_STATUSES);
export const goalStatusEnum = pgEnum("goal_status", GOAL_STATUSES);
export const expectationKindEnum = pgEnum("expectation_kind", EXPECTATION_KINDS);
export const expectationStatusEnum = pgEnum("expectation_status", EXPECTATION_STATUSES);
export const requestUrgencyEnum = pgEnum("request_urgency", REQUEST_URGENCIES);
export const requestStatusEnum = pgEnum("request_status", REQUEST_STATUSES);
export const requestDecisionEnum = pgEnum("request_decision", REQUEST_DECISIONS);
export const taskPriorityEnum = pgEnum("task_priority", TASK_PRIORITIES);
export const taskSizeEnum = pgEnum("task_size", TASK_SIZES);
export const taskStatusEnum = pgEnum("task_status", TASK_STATUSES);
export const taskActivityKindEnum = pgEnum("task_activity_kind", TASK_ACTIVITY_KINDS);

// --- Auth.js (the shape @auth/drizzle-adapter expects) ----------------------

export const users = pgTable("users", {
  id: id(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: tstz("email_verified"),
  image: text("image"),
  /** Overrides the organization's timezone when set. */
  timezone: text("timezone"),
  createdAt: createdAt(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] }), index("accounts_user_idx").on(t.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: tstz("expires").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: tstz("expires").notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// --- tenancy ----------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default(DEFAULT_TIMEZONE),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("member"),
    joinedAt: tstz("joined_at").notNull().defaultNow(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index("organization_members_user_idx").on(t.userId)],
);

export const teams = pgTable(
  "teams",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [unique("teams_org_name_unique").on(t.orgId, t.name)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: teamRoleEnum("role").notNull().default("member"),
    addedAt: tstz("added_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] }), index("team_members_user_idx").on(t.userId)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Always stored lowercased. */
    email: text("email").notNull(),
    orgRole: orgRoleEnum("org_role").notNull().default("member"),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    teamRole: teamRoleEnum("team_role"),
    /** sha256 (hex) of the 32-byte token in the link; the token itself is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: tstz("expires_at").notNull(),
    acceptedAt: tstz("accepted_at"),
    createdAt: createdAt(),
  },
  (t) => [index("invitations_org_idx").on(t.orgId)],
);

// --- work -------------------------------------------------------------------

export const projects = pgTable("projects", {
  id: id(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: projectStatusEnum("status").notNull().default("active"),
  createdAt: createdAt(),
});

export const goals = pgTable("goals", {
  id: id(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  targetDate: day("target_date"),
  successCriteria: text("success_criteria"),
  status: goalStatusEnum("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const teamExpectations = pgTable("team_expectations", {
  id: id(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  kind: expectationKindEnum("kind").notNull().default("milestone"),
  targetCount: integer("target_count"),
  periodStart: day("period_start").notNull(),
  periodEnd: day("period_end").notNull(),
  goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
  status: expectationStatusEnum("status").notNull().default("open"),
  createdAt: createdAt(),
});

export const requests = pgTable(
  "requests",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    desiredOutcome: text("desired_outcome"),
    urgency: requestUrgencyEnum("urgency").notNull().default("normal"),
    link: text("link"),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id),
    status: requestStatusEnum("status").notNull().default("new"),
    decidedAt: tstz("decided_at"),
    decidedBy: text("decided_by").references(() => users.id),
    decisionReason: text("decision_reason"),
    deferUntil: day("defer_until"),
    convertedTaskId: text("converted_task_id").references((): AnyPgColumn => tasks.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("requests_org_team_status_idx").on(t.orgId, t.teamId, t.status),
    index("requests_org_requester_idx").on(t.orgId, t.requesterId),
  ],
);

/** Append-only. */
export const requestDecisions = pgTable(
  "request_decisions",
  {
    id: id(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    deciderId: text("decider_id")
      .notNull()
      .references(() => users.id),
    decision: requestDecisionEnum("decision").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("request_decisions_request_idx").on(t.requestId, t.createdAt.desc())],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    requestId: text("request_id").references((): AnyPgColumn => requests.id, { onDelete: "set null" }),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    expectationId: text("expectation_id").references(() => teamExpectations.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    approverId: text("approver_id").references(() => users.id, { onDelete: "set null" }),
    priority: taskPriorityEnum("priority").notNull().default("normal"),
    size: taskSizeEnum("size"),
    status: taskStatusEnum("status").notNull().default("not_started"),
    dueDate: day("due_date"),
    startedAt: tstz("started_at"),
    completedAt: tstz("completed_at"),
    blockedReason: text("blocked_reason"),
    /** Who or what could unblock it (free text). */
    blockedBy: text("blocked_by"),
    rejectionReason: text("rejection_reason"),
    /** Denormalized from the newest task_updates row. */
    latestProgress: text("latest_progress"),
    nextAction: text("next_action"),
    completionSummary: text("completion_summary"),
    impactNote: text("impact_note"),
    /** Manual importance; higher sorts first. */
    sortRank: doublePrecision("sort_rank").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tasks_org_team_status_idx").on(t.orgId, t.teamId, t.status),
    index("tasks_org_assignee_status_idx").on(t.orgId, t.assigneeId, t.status),
    index("tasks_org_due_idx").on(t.orgId, t.dueDate),
    index("tasks_request_idx").on(t.requestId),
    index("tasks_goal_idx").on(t.goalId),
  ],
);

/** Append-only: the Resume history. */
export const taskUpdates = pgTable(
  "task_updates",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    progress: text("progress").notNull(),
    /** Null only on the update that completes a task. */
    nextAction: text("next_action"),
    blocker: text("blocker"),
    createdAt: createdAt(),
  },
  (t) => [index("task_updates_task_idx").on(t.taskId, t.createdAt.desc())],
);

export const taskEvidenceLinks = pgTable(
  "task_evidence_links",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    label: text("label"),
    addedBy: text("added_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("task_evidence_links_task_idx").on(t.taskId)],
);

/** Append-only audit trail. */
export const taskActivity = pgTable(
  "task_activity",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    kind: taskActivityKindEnum("kind").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("task_activity_task_idx").on(t.taskId, t.createdAt.desc()),
    index("task_activity_org_idx").on(t.orgId, t.createdAt.desc()),
  ],
);

// --- notifications (Phase 3) --------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href").notNull(),
    readAt: tstz("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.readAt)],
);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  emailAssignment: boolean("email_assignment").notNull().default(true),
  emailApproval: boolean("email_approval").notNull().default(true),
  emailRequestDecision: boolean("email_request_decision").notNull().default(true),
  emailHandover: boolean("email_handover").notNull().default(true),
  emailDueSoon: boolean("email_due_soon").notNull().default(false),
});

// --- row types ----------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type TeamExpectation = typeof teamExpectations.$inferSelect;
export type RequestRow = typeof requests.$inferSelect;
export type RequestDecisionRow = typeof requestDecisions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskUpdate = typeof taskUpdates.$inferSelect;
export type TaskEvidenceLink = typeof taskEvidenceLinks.$inferSelect;
export type TaskActivity = typeof taskActivity.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
