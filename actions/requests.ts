"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requestDecisions, requests, tasks } from "@/db/schema";
import { fail, GuardError, ok, runAction, type ActionResult } from "@/lib/action-result";
import { REQUEST_URGENCIES, TASK_PRIORITIES, TASK_SIZES, type RequestStatus } from "@/lib/constants";
import { recordActivity } from "@/lib/dal/activity";
import { findTeam, isTeamMemberRow } from "@/lib/dal/orgs";
import { lockRequest } from "@/lib/dal/requests";
import { log } from "@/lib/log";
import { dispatch } from "@/lib/notify";
import { canSubmitRequest, canTriageRequest } from "@/lib/permissions";
import type { ActivityDraft } from "@/lib/tasks/transitions";
import { requireViewer } from "@/lib/viewer";

const id = z.string().min(1).max(64);
const optionalText = (max: number) => z.string().trim().max(max).default("");
const httpUrl = z.union([z.literal(""), z.url({ protocol: /^https?$/, error: "Use a full http(s) link." })]).default("");
const day = z.union([z.literal(""), z.iso.date({ error: "Pick a date." })]).default("");

// --- submit ---------------------------------------------------------------------------------------------------

const submitSchema = z.object({
  title: z.string().trim().min(1, "Give the request a title.").max(200),
  teamId: id,
  description: optionalText(10_000),
  desiredOutcome: optionalText(2000),
  urgency: z.enum(REQUEST_URGENCIES).default("normal"),
  link: httpUrl,
});

/** Anyone in the organization can ask a team for work. It lands in triage; nothing is committed yet. */
export async function submitRequest(input: z.input<typeof submitSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction("requests.submit", submitSchema, input, async (data) => {
    const viewer = await requireViewer();
    const team = await findTeam(db, viewer.orgId, data.teamId);
    if (team === null) throw new GuardError("not_found");
    if (!canSubmitRequest(viewer, team)) throw new GuardError("forbidden");
    const [created] = await db
      .insert(requests)
      .values({
        orgId: viewer.orgId,
        teamId: team.id,
        title: data.title,
        description: data.description || null,
        desiredOutcome: data.desiredOutcome || null,
        urgency: data.urgency,
        link: data.link || null,
        requesterId: viewer.userId,
      })
      .returning({ id: requests.id });
    log.info("requests.submitted", { orgId: viewer.orgId, requestId: created.id, by: viewer.userId });
    refresh();
    return ok({ id: created.id }, "Request submitted. The team will see it in their review.");
  });
}

// --- decide -----------------------------------------------------------------------------------------------------

const decideSchema = z.object({
  requestId: id,
  decision: z.enum(["under_review", "approved", "deferred", "rejected", "reopened"]),
  reason: optionalText(1000),
  deferUntil: day,
});

const MESSAGES: Record<z.infer<typeof decideSchema>["decision"], string> = {
  under_review: "Marked as under review.",
  approved: "Approved.",
  deferred: "Deferred.",
  rejected: "Rejected.",
  reopened: "Reopened.",
};

/** Records a decision: the request's current state changes and the decision itself is kept forever. */
export async function decideRequest(input: z.input<typeof decideSchema>): Promise<ActionResult> {
  return runAction("requests.decide", decideSchema, input, async (data) => {
    const viewer = await requireViewer();
    const now = new Date();
    const outcome = await db.transaction(async (tx) => {
      const request = await lockRequest(tx, viewer.orgId, data.requestId);
      if (request === null) throw new GuardError("not_found");
      if (!canTriageRequest(viewer, { orgId: request.orgId, teamId: request.teamId, requesterId: request.requesterId })) throw new GuardError("forbidden");
      if (request.status === "converted") return "This request already became a task; decide on the task instead.";
      if (data.decision === "rejected" && data.reason === "") return "Give a reason for rejecting it.";
      if (data.decision === "reopened" && request.status !== "deferred" && request.status !== "rejected") return "Only a deferred or rejected request can be reopened.";
      const status: RequestStatus = data.decision === "reopened" ? "new" : data.decision;
      if (status === request.status && data.reason === "" && data.deferUntil === (request.deferUntil ?? "")) return null;
      await tx
        .update(requests)
        .set({
          status,
          decidedAt: now,
          decidedBy: viewer.userId,
          decisionReason: data.reason || null,
          deferUntil: data.decision === "deferred" ? data.deferUntil || null : null,
          updatedAt: now,
        })
        .where(eq(requests.id, request.id));
      await tx.insert(requestDecisions).values({ requestId: request.id, deciderId: viewer.userId, decision: data.decision, reason: data.reason || null, createdAt: now });
      return { requesterId: request.requesterId, title: request.title };
    });
    if (typeof outcome === "string") return fail(outcome);
    if (outcome !== null && data.decision !== "under_review") {
      const verb = { approved: "approved", deferred: "deferred", rejected: "rejected", reopened: "reopened" }[data.decision];
      await dispatch([{ orgId: viewer.orgId, actorId: viewer.userId, recipients: [outcome.requesterId], kind: "request_decided", title: `Your request was ${verb}: ${outcome.title}`, body: data.reason || null, href: `/requests/${data.requestId}` }]);
    }
    refresh();
    return ok(undefined, MESSAGES[data.decision]);
  });
}

// --- convert to a task ------------------------------------------------------------------------------------------

const convertSchema = z.object({
  requestId: id,
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  assigneeId: z.string().default(""),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  size: z.union([z.literal(""), z.enum(TASK_SIZES)]).default(""),
  dueDate: day,
  nextAction: optionalText(1000),
  reason: optionalText(1000),
});

/** Turns an approved (or new) request into real work: the task keeps a link back to the request. */
export async function convertRequest(input: z.input<typeof convertSchema>): Promise<ActionResult<{ taskId: string }>> {
  return runAction("requests.convert", convertSchema, input, async (data) => {
    const viewer = await requireViewer();
    const now = new Date();
    const result: { taskId: string; requesterId: string; title: string } | { error: string } = await db.transaction(async (tx) => {
      const request = await lockRequest(tx, viewer.orgId, data.requestId);
      if (request === null) throw new GuardError("not_found");
      if (!canTriageRequest(viewer, { orgId: request.orgId, teamId: request.teamId, requesterId: request.requesterId })) throw new GuardError("forbidden");
      if (request.status === "converted") return { error: "This request already became a task." };
      if (data.assigneeId && !(await isTeamMemberRow(tx, request.teamId, data.assigneeId))) throw new GuardError("forbidden", "The assignee must be on the team.");
      const description = [request.description, request.desiredOutcome ? `Desired outcome: ${request.desiredOutcome}` : null].filter(Boolean).join("\n\n") || null;
      const [task] = await tx
        .insert(tasks)
        .values({
          orgId: viewer.orgId,
          teamId: request.teamId,
          requestId: request.id,
          title: data.title,
          description,
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
      const drafts: ActivityDraft[] = [{ kind: "created", after: { title: data.title, fromRequest: request.id } }];
      if (data.assigneeId && data.assigneeId !== viewer.userId) drafts.push({ kind: "assigned", after: { assigneeId: data.assigneeId } });
      await recordActivity(tx, { orgId: viewer.orgId, taskId: task.id, actorId: viewer.userId }, drafts, now);
      await tx
        .update(requests)
        .set({ status: "converted", convertedTaskId: task.id, decidedAt: now, decidedBy: viewer.userId, decisionReason: data.reason || request.decisionReason, deferUntil: null, updatedAt: now })
        .where(eq(requests.id, request.id));
      await tx.insert(requestDecisions).values({ requestId: request.id, deciderId: viewer.userId, decision: "converted", reason: data.reason || null, createdAt: now });
      return { taskId: task.id, requesterId: request.requesterId, title: request.title };
    });
    if ("error" in result) return fail(result.error);
    log.info("requests.converted", { orgId: viewer.orgId, requestId: data.requestId, taskId: result.taskId, by: viewer.userId });
    await dispatch([
      { orgId: viewer.orgId, actorId: viewer.userId, recipients: [result.requesterId], kind: "request_decided", title: `Your request is now a task: ${result.title}`, body: data.reason || null, href: `/tasks/${result.taskId}` },
      ...(data.assigneeId ? [{ orgId: viewer.orgId, actorId: viewer.userId, recipients: [data.assigneeId], kind: "assigned" as const, title: `New task for you: ${data.title}`, body: data.nextAction || null, href: `/tasks/${result.taskId}` }] : []),
    ]);
    refresh();
    return ok({ taskId: result.taskId }, "Task created from the request.");
  });
}
