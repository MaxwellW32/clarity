import { describe, expect, it } from "vitest";
import { groupMyWork, type MyWorkRow } from "./my-work";
import type { TaskListItem } from "./types";

const ME = "me";
const TODAY = "2026-10-15";

let n = 0;
function row(partial: Partial<TaskListItem> & Partial<Omit<MyWorkRow, "item">> = {}): MyWorkRow {
  n += 1;
  const { approverId = null, assigneeId = ME, sortRank = 0, completedAt = null, sentBack = false, ...item } = partial;
  return {
    item: {
      id: `t${n}`,
      title: `Task ${n}`,
      status: "in_progress",
      priority: "normal",
      dueDate: null,
      nextAction: null,
      assignee: null,
      teamName: "Engineering",
      updatedAt: `2026-10-${String(10 + n).padStart(2, "0")}T00:00:00.000Z`,
      ...item,
    },
    approverId,
    assigneeId,
    sortRank,
    completedAt,
    sentBack,
  };
}

describe("groupMyWork", () => {
  it("puts each task in exactly one section", () => {
    const rows = [
      row({ title: "overdue", dueDate: "2026-10-10" }),
      row({ title: "soon", dueDate: "2026-10-16" }),
      row({ title: "plain" }),
      row({ title: "blocked", status: "blocked" }),
      row({ title: "awaiting mine", status: "awaiting_approval" }),
      row({ title: "to approve", status: "awaiting_approval", assigneeId: "other", approverId: ME }),
      row({ title: "sent back", sentBack: true }),
      row({ title: "done", status: "completed", completedAt: new Date("2026-10-14T10:00:00Z") }),
    ];
    const groups = groupMyWork(rows, ME, TODAY);
    const titles = (items: TaskListItem[]) => items.map((item) => item.title);
    expect(titles(groups.attention)).toEqual(["overdue", "soon", "sent back", "to approve"]);
    expect(titles(groups.waiting)).toEqual(["awaiting mine", "blocked"]);
    expect(titles(groups.continueWorking)).toEqual(["plain"]);
    expect(titles(groups.finished)).toEqual(["done"]);
    const all = [...groups.attention, ...groups.waiting, ...groups.continueWorking, ...groups.finished];
    expect(new Set(all.map((item) => item.id)).size).toBe(rows.length);
  });

  it("badges only the reasons the due label cannot show", () => {
    const groups = groupMyWork(
      [
        row({ dueDate: "2026-10-01" }),
        row({ dueDate: TODAY }),
        row({ dueDate: "2026-10-16" }),
        row({ dueDate: "2026-10-17" }),
        row({ status: "awaiting_approval", assigneeId: "other", approverId: ME }),
        row({ sentBack: true }),
      ],
      ME,
      TODAY,
    );
    expect(groups.attention.map((item) => item.reason)).toEqual([undefined, undefined, undefined, undefined, "Sent back", "Your approval"]);
  });

  it("orders continue-working by due date, then priority, then manual rank, then recency", () => {
    const groups = groupMyWork(
      [
        row({ title: "normal, no date, old", updatedAt: "2026-10-01T00:00:00.000Z" }),
        row({ title: "normal, no date, new", updatedAt: "2026-10-14T00:00:00.000Z" }),
        row({ title: "urgent, no date", priority: "urgent" }),
        row({ title: "ranked up", sortRank: 5 }),
        row({ title: "due next week", dueDate: "2026-10-22", priority: "low" }),
      ],
      ME,
      TODAY,
    );
    expect(groups.continueWorking.map((item) => item.title)).toEqual([
      "due next week",
      "urgent, no date",
      "ranked up",
      "normal, no date, new",
      "normal, no date, old",
    ]);
  });

  it("keeps a blocked task due soon in needs attention, and a blocked task without a date in waiting", () => {
    const groups = groupMyWork([row({ status: "blocked", dueDate: "2026-10-16" }), row({ status: "blocked" })], ME, TODAY);
    expect(groups.attention).toHaveLength(1);
    expect(groups.waiting).toHaveLength(1);
  });

  it("lists finished work most recent first and ignores other people's tasks", () => {
    const groups = groupMyWork(
      [
        row({ title: "older", status: "completed", completedAt: new Date("2026-10-10T00:00:00Z") }),
        row({ title: "newer", status: "completed", completedAt: new Date("2026-10-14T00:00:00Z") }),
        row({ title: "someone else's", assigneeId: "other" }),
      ],
      ME,
      TODAY,
    );
    expect(groups.finished.map((item) => item.title)).toEqual(["newer", "older"]);
    expect(groups.continueWorking).toHaveLength(0);
  });
});
