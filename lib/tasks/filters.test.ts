import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filtersToParams, parseFilters, tasksHref } from "./filters";

describe("task list URL state", () => {
  it("round-trips through the URL", () => {
    const filters = { ...DEFAULT_FILTERS, q: "backup", status: ["blocked" as const, "in_progress" as const], assignee: "me", due: "overdue" as const, closed: true, sort: "due" as const };
    expect(parseFilters(Object.fromEntries(filtersToParams(filters)))).toEqual(filters);
  });

  it("drops anything it does not recognise", () => {
    const parsed = parseFilters({ status: "blocked,bogus,blocked", priority: "huge", due: "someday", sort: "random", assignee: "x'; drop", closed: "yes" });
    expect(parsed).toEqual({ ...DEFAULT_FILTERS, status: ["blocked"] });
  });

  it("keeps the defaults out of the URL", () => {
    expect(tasksHref({})).toBe("/tasks");
    expect(tasksHref({ assignee: "me", status: ["completed"], sort: "updated" })).toBe("/tasks?status=completed&assignee=me&sort=updated");
  });
});
