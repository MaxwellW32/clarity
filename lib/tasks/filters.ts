import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/constants";

// The task list's state lives in the URL. These two functions are the only translation between the two.

export const TASK_SORTS = ["smart", "due", "priority", "updated", "created"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

export const DUE_FILTERS = ["overdue", "week", "none"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export type TaskFilters = {
  q: string;
  status: TaskStatus[];
  /** "" anyone · "me" · "none" (unassigned) · a user id */
  assignee: string;
  priority: TaskPriority | "";
  due: DueFilter | "";
  team: string;
  /** Show completed and rejected tasks (hidden by default). */
  closed: boolean;
  sort: TaskSort;
};

export const DEFAULT_FILTERS: TaskFilters = { q: "", status: [], assignee: "", priority: "", due: "", team: "", closed: false, sort: "smart" };

type Raw = Record<string, string | string[] | undefined>;

const one = (raw: Raw, key: string): string => {
  const value = raw[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
};

const pick = <T extends string>(value: string, allowed: readonly T[]): T | "" => ((allowed as readonly string[]).includes(value) ? (value as T) : "");

export function parseFilters(raw: Raw): TaskFilters {
  const statuses = one(raw, "status")
    .split(",")
    .map((value) => pick(value, TASK_STATUSES))
    .filter((value): value is TaskStatus => value !== "");
  return {
    q: one(raw, "q").slice(0, 100),
    status: [...new Set(statuses)],
    assignee: /^[\w-]{1,64}$/.test(one(raw, "assignee")) ? one(raw, "assignee") : "",
    priority: pick(one(raw, "priority"), TASK_PRIORITIES),
    due: pick(one(raw, "due"), DUE_FILTERS),
    team: /^[\w-]{1,64}$/.test(one(raw, "team")) ? one(raw, "team") : "",
    closed: one(raw, "closed") === "1",
    sort: pick(one(raw, "sort"), TASK_SORTS) || "smart",
  };
}

/** Only what differs from the defaults goes into the URL. */
export function filtersToParams(filters: TaskFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status.length > 0) params.set("status", filters.status.join(","));
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.due) params.set("due", filters.due);
  if (filters.team) params.set("team", filters.team);
  if (filters.closed) params.set("closed", "1");
  if (filters.sort !== "smart") params.set("sort", filters.sort);
  return params;
}

export function tasksHref(filters: Partial<TaskFilters>): string {
  const query = filtersToParams({ ...DEFAULT_FILTERS, ...filters }).toString();
  return query ? `/tasks?${query}` : "/tasks";
}

export function isFiltered(filters: TaskFilters): boolean {
  return filtersToParams({ ...filters, sort: "smart" }).toString() !== "";
}
