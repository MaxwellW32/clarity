import { describe, expect, it } from "vitest";
import { planTransition, type TaskState } from "./transitions";

const now = new Date("2026-10-15T12:00:00Z");
const task = (overrides: Partial<TaskState> = {}): TaskState => ({ status: "in_progress", startedAt: new Date("2026-10-01"), approverId: null, blockedReason: null, ...overrides });
const kinds = (plan: ReturnType<typeof planTransition>) => (plan.ok ? plan.activities.map((a) => a.kind) : plan.error);

describe("status transitions (PLAN §5)", () => {
  it("blocking needs a reason and records who unblocks", () => {
    expect(planTransition(task(), "blocked", {}, now).ok).toBe(false);
    const plan = planTransition(task(), "blocked", { reason: " Waiting on Finance ", blockedBy: "Procurement" }, now);
    expect(plan).toMatchObject({ ok: true, patch: { status: "blocked", blockedReason: "Waiting on Finance", blockedBy: "Procurement" } });
    expect(kinds(plan)).toEqual(["blocked"]);
  });

  it("leaving blocked clears the reason and writes unblocked", () => {
    const plan = planTransition(task({ status: "blocked", blockedReason: "PO" }), "in_progress", {}, now);
    expect(plan).toMatchObject({ ok: true, patch: { blockedReason: null, blockedBy: null } });
    expect(kinds(plan)).toEqual(["unblocked"]);
  });

  it("asking for approval needs an approver", () => {
    expect(planTransition(task(), "awaiting_approval", {}, now).ok).toBe(false);
    expect(planTransition(task(), "awaiting_approval", { approverId: "morgan" }, now)).toMatchObject({ ok: true, patch: { approverId: "morgan" } });
  });

  it("approving completes with both events; sending back returns to in progress with the note", () => {
    const awaiting = task({ status: "awaiting_approval", approverId: "morgan" });
    expect(kinds(planTransition(awaiting, "completed", { note: "LGTM" }, now, "approve"))).toEqual(["approved", "completed"]);
    const back = planTransition(awaiting, "in_progress", { note: "Add the dashboard link" }, now, "send_back");
    expect(back).toMatchObject({ ok: true, activities: [{ kind: "sent_back", note: "Add the dashboard link" }] });
    expect(planTransition(task(), "completed", {}, now, "approve").ok).toBe(false);
  });

  it("completing sets completed_at; leaving completed is a reopen that clears it", () => {
    expect(planTransition(task(), "completed", { summary: "Done" }, now)).toMatchObject({ ok: true, patch: { completedAt: now, completionSummary: "Done" } });
    const reopened = planTransition(task({ status: "completed" }), "in_progress", {}, now);
    expect(reopened).toMatchObject({ ok: true, patch: { completedAt: null } });
    expect(kinds(reopened)).toEqual(["reopened"]);
  });

  it("rejecting needs a reason", () => {
    expect(planTransition(task(), "rejected", { reason: "  " }, now).ok).toBe(false);
    expect(planTransition(task(), "rejected", { reason: "Out of scope" }, now)).toMatchObject({ ok: true, patch: { rejectionReason: "Out of scope" } });
  });

  it("the first move to in progress sets started_at, later ones keep it", () => {
    expect(planTransition(task({ status: "not_started", startedAt: null }), "in_progress", {}, now)).toMatchObject({ ok: true, patch: { startedAt: now } });
    const again = planTransition(task({ status: "not_started" }), "in_progress", {}, now);
    expect(again.ok && "startedAt" in again.patch).toBe(false);
    expect(kinds(again)).toEqual(["status_changed"]);
  });

  it("asking for the status it already has changes nothing", () => {
    expect(planTransition(task(), "in_progress", {}, now)).toEqual({ ok: true, patch: {}, activities: [] });
  });
});
