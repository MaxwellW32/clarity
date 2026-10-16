"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, type Tx } from "@/db";
import { goals, organizationMembers, projects, taskEvidenceLinks, taskUpdates, tasks, teamExpectations, teamMembers } from "@/db/schema";
import { fail, GuardError, ok, runAction, type ActionResult } from "@/lib/action-result";
import { TASK_PRIORITIES, TASK_SIZES, TASK_STATUSES, type TaskStatus } from "@/lib/constants";
import { recordActivity } from "@/lib/dal/activity";
import { listHistory } from "@/lib/dal/history";
import { findTeam } from "@/lib/dal/orgs";
import { getTaskBasics, listTasks, lockTask, searchTasks, taskFormOptions, taskPeople } from "@/lib/dal/tasks";
import { log } from "@/lib/log";
import { teamLeadIds } from "@/lib/dal/notifications";
import { dispatch, type Notice } from "@/lib/notify";
import { canApproveTask, canCreateTask, canEditTask, canReadTask, canUpdateProgress, type TaskScope, type Viewer } from "@/lib/permissions";
import { defaultApproverFor } from "@/lib/tasks/approver";
import { parseFilters } from "@/lib/tasks/filters";
import { planTransition, type ActivityDraft, type TransitionInput, type TransitionVia } from "@/lib/tasks/transitions";
import type { HistoryPage, TaskFormOptions, TaskListItem, TaskPage } from "@/lib/tasks/types";
import { dayKey } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

// --- shared checks -----------------------------------------------------------------------------------------

const id = z.string().min(1).max(64);
const optionalText = (max: number) => z.string().trim().max(max).default("");
const httpUrl = z.union([z.literal(""), z.url({ protocol: /^https?$/, error: "Use a full http(s) link." })]).default("");
const day = z.union([z.literal(""), z.iso.date({ error: "Pick a date." })]).default("");

async function isTeamMember(tx: Tx, teamId: string, userId: string): Promise<boolean> {
  const [row] = await tx.select({ userId: teamMembers.userId }).from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  return Boolean(row);
}

/** An approver is someone on the task's team, or an org admin (admins may act as lead anywhere). */
async function canBeApprover(tx: Tx, orgId: string, teamId: string, userId: string): Promise<boolean> {
  if (await isTeamMember(tx, teamId, userId)) return true;
  const [row] = await tx
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)));
  return row?.role === "admin";
}

async function addEvidence(tx: Tx, taskId: string, userId: string, url: string, label: string, at: Date): Promise<ActivityDraft[]> {
  if (url === "") return [];
  const clean = label === "" ? null : label;
  await tx.insert(taskEvidenceLinks).values({ taskId, url, label: clean, addedBy: userId, createdAt: at });
  return [{ kind: "evidence_added", after: { url, label: clean } }];
}

/** Who may move a task to `to`: rejecting is an edit, finishing an approval is the approver's, the rest is progress. */
function mayMove(viewer: Viewer, scope: TaskScope, from: TaskStatus, to: TaskStatus, via: TransitionVia): boolean {
  if (via !== "status" || (from === "awaiting_approval" && to === "completed")) return canApproveTask(viewer, scope);
  if (to === "rejected") return canEditTask(viewer, scope);
  return canUpdateProgress(viewer, scope);
}

/** Who to tell about a status change: the approver asked, the assignee decided on, the leads of a blocked task. */
async function noticesFor(
  tx: Tx,
  viewer: Viewer,
  task: { id: string; title: string; teamId: string; assigneeId: string | null },
  activities: ActivityDraft[],
  approverId: string | null,
  note: string | null,
): Promise<Notice[]> {
  const base = { orgId: viewer.orgId, actorId: viewer.userId, href: `/tasks/${task.id}` };
  const out: Notice[] = [];
  for (const activity of activities) {
    if (activity.kind === "approval_requested" && approverId) out.push({ ...base, recipients: [approverId], kind: "approval_requested", title: `Approval needed: ${task.title}`, body: null });
    if (activity.kind === "approved" && task.assigneeId) out.push({ ...base, recipients: [task.assigneeId], kind: "approval_decided", title: `Approved: ${task.title}`, body: note });
    if (activity.kind === "sent_back" && task.assigneeId) out.push({ ...base, recipients: [task.assigneeId], kind: "approval_decided", title: `Sent back: ${task.title}`, body: note });
    if (activity.kind === "blocked") {
      const leads = await teamLeadIds(tx, task.teamId);
      const reason = typeof activity.note === "string" ? activity.note : null;
      if (leads.length > 0) out.push({ ...base, recipients: leads, kind: "blocked", title: `Blocked: ${task.title}`, body: reason });
    }
  }
  return out;
}

// --- create ---------------------------------------------------------------------------------------------------

const createSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  teamId: id,
  assigneeId: z.string().default(""),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  dueDate: day,
  size: z.union([z.literal(""), z.enum(TASK_SIZES)]).default(""),
  description: optionalText(10_000),
  nextAction: optionalText(1000),
  projectId: z.string().default(""),
});

export async function createTask(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction("tasks.create", createSchema, input, async (data) => {
    const viewer = await requireViewer();
    const now = new Date();
    const taskId = await db.transaction(async (tx) => {
      const team = await findTeam(tx, viewer.orgId, data.teamId);
      if (team === null) throw new GuardError("not_found");
      if (!canCreateTask(viewer, team)) throw new GuardError("forbidden");
      if (data.assigneeId && !(await isTeamMember(tx, team.id, data.assigneeId))) throw new GuardError("forbidden", "The assignee must be on the team.");
      if (data.projectId) {
        const [project] = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.id, data.projectId), eq(projects.teamId, team.id)));
        if (!project) throw new GuardError("not_found");
      }
      const [created] = await tx
        .insert(tasks)
        .values({
          orgId: viewer.orgId,
          teamId: team.id,
          projectId: data.projectId || null,
          title: data.title,
          description: data.description || null,
          assigneeId: data.assigneeId || null,
          createdBy: viewer.userId,
          priority: data.priority,
          size: data.size || null,
          dueDate: data.dueDate || null,
          nextAction: data.nextAction || null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: tasks.id });
      const drafts: ActivityDraft[] = [{ kind: "created", after: { title: data.title } }];
      if (data.assigneeId && data.assigneeId !== viewer.userId) drafts.push({ kind: "assigned", after: { assigneeId: data.assigneeId } });
      await recordActivity(tx, { orgId: viewer.orgId, taskId: created.id, actorId: viewer.userId }, drafts, now);
      return created.id;
    });
    log.info("tasks.created", { orgId: viewer.orgId, taskId, by: viewer.userId });
    if (data.assigneeId && data.assigneeId !== viewer.userId) {
      await dispatch([{ orgId: viewer.orgId, actorId: viewer.userId, recipients: [data.assigneeId], kind: "assigned", title: `New task for you: ${data.title}`, body: data.nextAction ? `First step: ${data.nextAction}` : null, href: `/tasks/${taskId}` }]);
    }
    refresh();
    return ok({ id: taskId }, "Task created.");
  });
}

// --- edit fields ------------------------------------------------------------------------------------------------

const editSchema = z.discriminatedUnion("field", [
  z.object({ taskId: id, field: z.literal("title"), value: z.string().trim().min(1, "A task needs a title.").max(200) }),
  z.object({ taskId: id, field: z.literal("description"), value: z.string().trim().max(10_000) }),
  z.object({ taskId: id, field: z.literal("priority"), value: z.enum(TASK_PRIORITIES) }),
  z.object({ taskId: id, field: z.literal("dueDate"), value: day }),
  z.object({ taskId: id, field: z.literal("assigneeId"), value: z.string().max(64) }),
  z.object({ taskId: id, field: z.literal("size"), value: z.union([z.literal(""), z.enum(TASK_SIZES)]) }),
  z.object({ taskId: id, field: z.literal("goalId"), value: z.string().max(64) }),
  z.object({ taskId: id, field: z.literal("expectationId"), value: z.string().max(64) }),
  z.object({ taskId: id, field: z.literal("impactNote"), value: z.string().trim().max(2000) }),
]);

export async function editTask(input: z.input<typeof editSchema>): Promise<ActionResult> {
  return runAction("tasks.edit", editSchema, input, async (data) => {
    const viewer = await requireViewer();
    const now = new Date();
    const notices: Notice[] = [];
    await db.transaction(async (tx) => {
      const locked = await lockTask(tx, viewer.orgId, data.taskId);
      if (locked === null) throw new GuardError("not_found");
      const { task, scope } = locked;
      if (!canEditTask(viewer, scope)) throw new GuardError("forbidden");
      const value = data.value === "" ? null : data.value;
      const before = task[data.field] ?? null;
      if (before === value) return;
      if (data.field === "assigneeId" && value !== null && !(await isTeamMember(tx, task.teamId, value))) {
        throw new GuardError("forbidden", "The assignee must be on the team.");
      }
      if (data.field === "goalId" && value !== null) {
        const [goal] = await tx.select({ teamId: goals.teamId }).from(goals).where(and(eq(goals.id, value), eq(goals.orgId, viewer.orgId)));
        if (!goal || (goal.teamId !== null && goal.teamId !== task.teamId)) throw new GuardError("not_found", "That goal isn't available to this team.");
      }
      if (data.field === "expectationId" && value !== null) {
        const [expectation] = await tx.select({ teamId: teamExpectations.teamId }).from(teamExpectations).where(and(eq(teamExpectations.id, value), eq(teamExpectations.orgId, viewer.orgId)));
        if (!expectation || expectation.teamId !== task.teamId) throw new GuardError("not_found", "That expectation belongs to another team.");
      }
      const short = (v: unknown) => (typeof v === "string" && v.length > 500 ? `${v.slice(0, 500)}…` : v);
      const draft: ActivityDraft =
        data.field === "priority"
          ? { kind: "priority_changed", before: { priority: before }, after: { priority: value } }
          : data.field === "dueDate"
            ? { kind: "due_changed", before: { dueDate: before }, after: { dueDate: value } }
            : data.field === "assigneeId"
              ? { kind: "assigned", before: { assigneeId: before }, after: { assigneeId: value } }
              : { kind: "edited", before: { [data.field]: short(before) }, after: { [data.field]: short(value) } };
      await tx.update(tasks).set({ [data.field]: value, updatedAt: now }).where(eq(tasks.id, task.id));
      await recordActivity(tx, { orgId: viewer.orgId, taskId: task.id, actorId: viewer.userId }, [draft], now);
      if (data.field === "assigneeId" && value !== null) {
        notices.push({ orgId: viewer.orgId, actorId: viewer.userId, recipients: [value], kind: "assigned", title: `Assigned to you: ${task.title}`, body: task.nextAction ? `Next: ${task.nextAction}` : null, href: `/tasks/${task.id}` });
      }
    });
    await dispatch(notices);
    refresh();
    return ok(undefined);
  });
}

// --- status ---------------------------------------------------------------------------------------------------

const statusSchema = z.object({
  taskId: id,
  status: z.enum(TASK_STATUSES),
  reason: optionalText(500),
  blockedBy: optionalText(200),
  approverId: z.string().default(""),
  summary: optionalText(2000),
  note: optionalText(1000),
  evidenceUrl: httpUrl,
  evidenceLabel: optionalText(120),
  via: z.enum(["status", "approve", "send_back"]).default("status"),
});

/** Status control, quick actions, Approve / Send back and Mark unblocked all land here. */
export async function changeStatus(input: z.input<typeof statusSchema>): Promise<ActionResult> {
  return runAction("tasks.status", statusSchema, input, async (data) => {
    const viewer = await requireViewer();
    const now = new Date();
    const notices: Notice[] = [];
    const outcome = await db.transaction(async (tx) => {
      const locked = await lockTask(tx, viewer.orgId, data.taskId);
      if (locked === null) throw new GuardError("not_found");
      const { task, scope } = locked;
      const via: TransitionVia = data.via === "status" && task.status === "awaiting_approval" && data.status === "completed" ? "approve" : data.via;
      if (!mayMove(viewer, scope, task.status, data.status, via)) throw new GuardError("forbidden");
      if (data.status === "awaiting_approval" && data.approverId && !(await canBeApprover(tx, viewer.orgId, task.teamId, data.approverId))) {
        throw new GuardError("forbidden", "The approver must be on the team, or an admin.");
      }
      const transition: TransitionInput = { reason: data.reason, blockedBy: data.blockedBy, approverId: data.approverId || null, summary: data.summary, note: data.note };
      const plan = planTransition(task, data.status, transition, now, via);
      if (!plan.ok) return plan.error;
      if (plan.activities.length === 0) return null;
      const evidence = data.status === "completed" ? await addEvidence(tx, task.id, viewer.userId, data.evidenceUrl, data.evidenceLabel, now) : [];
      await tx.update(tasks).set({ ...plan.patch, updatedAt: now }).where(eq(tasks.id, task.id));
      await recordActivity(tx, { orgId: viewer.orgId, taskId: task.id, actorId: viewer.userId }, [...plan.activities, ...evidence], now);
      notices.push(...(await noticesFor(tx, viewer, { id: task.id, title: task.title, teamId: task.teamId, assigneeId: task.assigneeId }, plan.activities, data.approverId || task.approverId, data.note)));
      return null;
    });
    if (outcome !== null) return fail(outcome);
    await dispatch(notices);
    refresh();
    const messages: Partial<Record<TaskStatus, string>> = { completed: data.via === "approve" ? "Approved." : "Marked complete.", blocked: "Marked blocked.", awaiting_approval: "Sent for approval." };
    return ok(undefined, data.via === "send_back" ? "Sent back." : (messages[data.status] ?? "Status updated."));
  });
}

// --- update progress --------------------------------------------------------------------------------------------

const progressSchema = z
  .object({
    taskId: id,
    progress: z.string().trim().min(1, "Say what you got done.").max(4000),
    nextAction: optionalText(1000),
    blocked: z.boolean().default(false),
    blockedReason: optionalText(500),
    blockedBy: optionalText(200),
    evidenceUrl: httpUrl,
    evidenceLabel: optionalText(120),
    handOverTo: z.string().default(""),
    markAs: z.enum(["", "in_progress", "awaiting_approval", "completed"]).default(""),
    approverId: z.string().default(""),
    summary: optionalText(2000),
  })
  .superRefine((value, ctx) => {
    if (value.markAs !== "completed" && value.nextAction === "") ctx.addIssue({ code: "custom", path: ["nextAction"], message: "Say what happens next." });
    if (value.blocked && value.blockedReason === "") ctx.addIssue({ code: "custom", path: ["blockedReason"], message: "Say what is blocking it." });
    if (value.blocked && value.markAs !== "") ctx.addIssue({ code: "custom", path: ["markAs"], message: "A blocked task can't also be marked done or sent for approval." });
    if (value.markAs === "awaiting_approval" && value.approverId === "") ctx.addIssue({ code: "custom", path: ["approverId"], message: "Choose who approves it." });
  });

/**
 * The signature action: progress, next action, optional blocker / evidence / handover / new status, written in
 * one transaction (update row, the task's denormalised fields, activity).
 */
export async function updateProgress(input: z.input<typeof progressSchema>): Promise<ActionResult> {
  return runAction("tasks.progress", progressSchema, input, async (data) => {
    const viewer = await requireViewer();
    const now = new Date();
    const notices: Notice[] = [];
    const outcome = await db.transaction(async (tx) => {
      const locked = await lockTask(tx, viewer.orgId, data.taskId);
      if (locked === null) throw new GuardError("not_found");
      const { task, scope } = locked;
      if (!canUpdateProgress(viewer, scope)) throw new GuardError("forbidden");

      // Which status the update leaves the task in: blocked if ticked; else the "Mark as" choice; un-ticking
      // "I'm blocked" on a blocked task unblocks it.
      let target: TaskStatus | null = null;
      if (data.blocked) target = task.status === "blocked" ? null : "blocked";
      else if (data.markAs !== "") target = data.markAs;
      else if (task.status === "blocked") target = "in_progress";

      const drafts: ActivityDraft[] = [{ kind: "progress_updated", after: { progress: data.progress.slice(0, 500), nextAction: data.nextAction || null } }];
      let patch: Record<string, unknown> = {};
      if (target !== null) {
        const via: TransitionVia = task.status === "awaiting_approval" && target === "completed" ? "approve" : "status";
        if (!mayMove(viewer, scope, task.status, target, via)) throw new GuardError("forbidden", "Only the approver can complete a task that is waiting for approval.");
        if (target === "awaiting_approval" && !(await canBeApprover(tx, viewer.orgId, task.teamId, data.approverId))) {
          throw new GuardError("forbidden", "The approver must be on the team, or an admin.");
        }
        const plan = planTransition(task, target, { reason: data.blockedReason, blockedBy: data.blockedBy, approverId: data.approverId || null, summary: data.summary }, now, via);
        if (!plan.ok) return plan.error;
        patch = plan.patch;
        drafts.push(...plan.activities);
      } else if (data.blocked && (data.blockedReason !== task.blockedReason || (data.blockedBy || null) !== task.blockedBy)) {
        patch = { blockedReason: data.blockedReason, blockedBy: data.blockedBy || null };
      }

      let assigneeId = task.assigneeId;
      if (data.handOverTo !== "" && data.handOverTo !== task.assigneeId) {
        if (!(await isTeamMember(tx, task.teamId, data.handOverTo))) throw new GuardError("forbidden", "You can only hand over to someone on the team.");
        drafts.push({ kind: "handed_over", before: { assigneeId: task.assigneeId }, after: { assigneeId: data.handOverTo } });
        assigneeId = data.handOverTo;
        notices.push({ orgId: viewer.orgId, actorId: viewer.userId, recipients: [data.handOverTo], kind: "handover", title: `Handed over to you: ${task.title}`, body: data.nextAction ? `Next: ${data.nextAction}` : data.progress.slice(0, 200), href: `/tasks/${task.id}` });
      }
      notices.push(...(await noticesFor(tx, viewer, { id: task.id, title: task.title, teamId: task.teamId, assigneeId }, drafts, data.approverId || task.approverId, null)));
      drafts.push(...(await addEvidence(tx, task.id, viewer.userId, data.evidenceUrl, data.evidenceLabel, now)));

      await tx.insert(taskUpdates).values({
        taskId: task.id,
        authorId: viewer.userId,
        progress: data.progress,
        nextAction: data.nextAction || null,
        blocker: data.blocked ? data.blockedReason : null,
        createdAt: now,
      });
      await tx
        .update(tasks)
        .set({ ...patch, latestProgress: data.progress, nextAction: data.nextAction || null, assigneeId, updatedAt: now })
        .where(eq(tasks.id, task.id));
      await recordActivity(tx, { orgId: viewer.orgId, taskId: task.id, actorId: viewer.userId }, drafts, now);
      return null;
    });
    if (outcome !== null) return fail(outcome);
    await dispatch(notices);
    refresh();
    return ok(undefined, "Update saved.");
  });
}

// --- reads for client components ----------------------------------------------------------------------------------

const moreSchema = z.object({ query: z.record(z.string(), z.string()), cursor: id });

export async function loadMoreTasks(input: z.input<typeof moreSchema>): Promise<ActionResult<TaskPage>> {
  return runAction("tasks.more", moreSchema, input, async ({ query, cursor }) => {
    const viewer = await requireViewer();
    return ok(await listTasks(viewer, parseFilters(query), { today: dayKey(new Date(), viewer.timezone), cursor }));
  });
}

const historySchema = z.object({ taskId: id, cursor: id });

export async function loadHistory(input: z.input<typeof historySchema>): Promise<ActionResult<HistoryPage>> {
  return runAction("tasks.history", historySchema, input, async ({ taskId, cursor }) => {
    const viewer = await requireViewer();
    const task = await getTaskBasics(viewer, taskId);
    if (task === null || !canReadTask(viewer, task.scope)) throw new GuardError("not_found");
    return ok(await listHistory(viewer, taskId, cursor));
  });
}

const searchSchema = z.object({ q: z.string().max(100) });

export async function paletteSearch(input: z.input<typeof searchSchema>): Promise<ActionResult<TaskListItem[]>> {
  return runAction("tasks.search", searchSchema, input, async ({ q }) => {
    const viewer = await requireViewer();
    return ok(await searchTasks(viewer, q));
  });
}

export async function getTaskFormOptions(): Promise<ActionResult<TaskFormOptions>> {
  return runAction("tasks.form_options", z.object({}), {}, async () => ok(await taskFormOptions(await requireViewer())));
}

/** What the Update Progress form and the status dialogs need about one task. */
export async function getUpdateContext(input: { taskId: string }) {
  return runAction("tasks.update_context", z.object({ taskId: id }), input, async ({ taskId }) => {
    const viewer = await requireViewer();
    const [task, people] = await Promise.all([getTaskBasics(viewer, taskId), taskPeople(viewer, taskId)]);
    if (task === null || !canReadTask(viewer, task.scope)) throw new GuardError("not_found");
    const defaultApprover = defaultApproverFor(people, task.approverId, task.assigneeId);
    return ok({
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        assigneeId: task.assigneeId,
        nextAction: task.nextAction,
        blockedReason: task.blockedReason,
        blockedBy: task.blockedBy,
      },
      people,
      defaultApprover,
      abilities: {
        edit: canEditTask(viewer, task.scope),
        progress: canUpdateProgress(viewer, task.scope),
        approve: canApproveTask(viewer, task.scope),
        reject: canEditTask(viewer, task.scope),
      },
    });
  });
}
