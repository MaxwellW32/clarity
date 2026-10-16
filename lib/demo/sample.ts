import "server-only";
import { and, eq, like } from "drizzle-orm";
import type { Tx } from "@/db";
import { goals, requestDecisions, requests, taskActivity, taskEvidenceLinks, taskUpdates, tasks, teamExpectations } from "@/db/schema";

/** Every sample row's title starts with this, so it is obvious on screen and trivial to remove. */
export const SAMPLE_TAG = "Sample · ";

const day = (offset: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);

/**
 * A small, realistic set of work for a brand-new organization: one goal, one agreed outcome, six tasks in
 * different states with updates and evidence, two requests. Everything is attributed to the person who
 * loads it and clearly labelled as sample.
 */
export async function insertSampleData(tx: Tx, input: { orgId: string; teamId: string; userId: string }): Promise<void> {
  const { orgId, teamId, userId } = input;
  const [goal] = await tx
    .insert(goals)
    .values({
      orgId,
      teamId,
      title: `${SAMPLE_TAG}Make releases boring`,
      description: "Deploys should be routine, reversible and quick.",
      successCriteria: "Ten production releases in a row with no rollback.",
      ownerId: userId,
      targetDate: day(60),
    })
    .returning({ id: goals.id });
  const [expectation] = await tx
    .insert(teamExpectations)
    .values({
      orgId,
      teamId,
      title: `${SAMPLE_TAG}Ship two release improvements this month`,
      description: "Agreed in planning: automated smoke test and a rollback runbook.",
      kind: "count",
      targetCount: 2,
      periodStart: day(0).slice(0, 7) + "-01",
      periodEnd: day(30),
      goalId: goal.id,
    })
    .returning({ id: teamExpectations.id });

  type Spec = {
    title: string;
    status: "not_started" | "in_progress" | "awaiting_approval" | "blocked" | "completed";
    priority: "low" | "normal" | "high" | "urgent";
    size: "s" | "m" | "l";
    due: number | null;
    progress?: string;
    next?: string;
    blocked?: string;
    summary?: string;
    impact?: string;
    evidence?: { url: string; label: string };
    expectation?: boolean;
    completedDaysAgo?: number;
  };
  const specs: Spec[] = [
    { title: "Write the rollback runbook", status: "in_progress", priority: "high", size: "m", due: 3, progress: "Drafted the steps for the API and the worker; database section still to do.", next: "Write the database rollback section and ask for review.", evidence: { url: "https://example.com/docs/rollback-runbook", label: "Runbook draft" }, expectation: true },
    { title: "Add a smoke test to the deploy pipeline", status: "awaiting_approval", priority: "normal", size: "s", due: 1, progress: "Smoke test runs after every deploy and fails the pipeline on a 5xx.", next: "Approve and merge.", evidence: { url: "https://example.com/pr/42", label: "PR #42" }, expectation: true },
    { title: "Upgrade the staging database", status: "blocked", priority: "normal", size: "l", due: 10, progress: "Upgrade plan written; waiting on a maintenance window.", next: "Run the upgrade in the agreed window.", blocked: "Waiting on infrastructure for a maintenance window." },
    { title: "Document the on-call handover", status: "not_started", priority: "low", size: "s", due: null, next: "Outline the five things a new on-call needs to know." },
    { title: "Fix the flaky checkout test", status: "completed", priority: "high", size: "s", due: -2, progress: "Replaced the shared fixture with a per-test user.", summary: "Twenty green runs in a row.", impact: "Unblocked merges for the whole team.", evidence: { url: "https://example.com/pr/39", label: "PR #39" }, completedDaysAgo: 2 },
    { title: "Trim the Docker image", status: "completed", priority: "normal", size: "m", due: -5, progress: "Multi-stage build; dropped the dev dependencies from the runtime image.", summary: "Image is 70% smaller; deploys pull in a third of the time.", impact: "Faster, cheaper deploys.", completedDaysAgo: 5 },
  ];

  for (const [index, spec] of specs.entries()) {
    const createdAt = ago(8 - index);
    const completedAt = spec.completedDaysAgo !== undefined ? ago(spec.completedDaysAgo) : null;
    const [task] = await tx
      .insert(tasks)
      .values({
        orgId,
        teamId,
        goalId: goal.id,
        expectationId: spec.expectation ? expectation.id : null,
        title: `${SAMPLE_TAG}${spec.title}`,
        assigneeId: userId,
        createdBy: userId,
        approverId: spec.status === "awaiting_approval" ? userId : null,
        priority: spec.priority,
        size: spec.size,
        status: spec.status,
        dueDate: spec.due === null ? null : day(spec.due),
        startedAt: spec.status === "not_started" ? null : createdAt,
        completedAt,
        completionSummary: spec.summary ?? null,
        impactNote: spec.impact ?? null,
        blockedReason: spec.blocked ?? null,
        blockedBy: spec.blocked ? "Infrastructure team" : null,
        latestProgress: spec.progress ?? null,
        nextAction: spec.next ?? null,
        createdAt,
        updatedAt: completedAt ?? ago(0, index + 1),
      })
      .returning({ id: tasks.id });
    await tx.insert(taskActivity).values({ orgId, taskId: task.id, actorId: userId, kind: "created", after: { title: spec.title, sample: true }, createdAt });
    if (spec.progress) {
      await tx.insert(taskUpdates).values({ taskId: task.id, authorId: userId, progress: spec.progress, nextAction: spec.next ?? null, blocker: spec.blocked ?? null, createdAt: ago(0, index + 1) });
    }
    if (spec.blocked) await tx.insert(taskActivity).values({ orgId, taskId: task.id, actorId: userId, kind: "blocked", before: { status: "in_progress" }, after: { status: "blocked", blockedReason: spec.blocked }, note: spec.blocked, createdAt: ago(0, index) });
    if (spec.status === "awaiting_approval") await tx.insert(taskActivity).values({ orgId, taskId: task.id, actorId: userId, kind: "approval_requested", before: { status: "in_progress" }, after: { status: "awaiting_approval", approverId: userId }, createdAt: ago(0, index) });
    if (completedAt) await tx.insert(taskActivity).values({ orgId, taskId: task.id, actorId: userId, kind: "completed", before: { status: "in_progress" }, after: { status: "completed" }, note: spec.summary ?? null, createdAt: completedAt });
    if (spec.evidence) await tx.insert(taskEvidenceLinks).values({ taskId: task.id, url: spec.evidence.url, label: spec.evidence.label, addedBy: userId, createdAt: ago(0, index) });
  }

  const [approved] = await tx
    .insert(requests)
    .values({
      orgId,
      teamId,
      title: `${SAMPLE_TAG}Export invoices as CSV for finance`,
      description: "Finance rebuilds the monthly invoice list by hand.",
      desiredOutcome: "Month-end close takes an hour instead of two days.",
      urgency: "high",
      requesterId: userId,
      status: "approved",
      decidedAt: ago(1),
      decidedBy: userId,
      decisionReason: "Worth it; scheduling for next sprint.",
      createdAt: ago(3),
    })
    .returning({ id: requests.id });
  await tx.insert(requestDecisions).values({ requestId: approved.id, deciderId: userId, decision: "approved", reason: "Worth it; scheduling for next sprint.", createdAt: ago(1) });
  await tx.insert(requests).values({
    orgId,
    teamId,
    title: `${SAMPLE_TAG}Dark mode for the status page`,
    description: "A few customers asked for it.",
    desiredOutcome: "The status page follows the visitor's system theme.",
    urgency: "low",
    requesterId: userId,
    status: "new",
    createdAt: ago(0, 6),
  });
}

/** Removes every sample row in the organization. Linked rows go with their parents (cascades). */
export async function deleteSampleData(tx: Tx, orgId: string): Promise<void> {
  const tagged = (column: typeof tasks.title | typeof requests.title | typeof goals.title | typeof teamExpectations.title) => like(column, `${SAMPLE_TAG}%`);
  await tx.delete(tasks).where(and(eq(tasks.orgId, orgId), tagged(tasks.title)));
  await tx.delete(requests).where(and(eq(requests.orgId, orgId), tagged(requests.title)));
  await tx.delete(teamExpectations).where(and(eq(teamExpectations.orgId, orgId), tagged(teamExpectations.title)));
  await tx.delete(goals).where(and(eq(goals.orgId, orgId), tagged(goals.title)));
}
