import "server-only";
import { and } from "drizzle-orm";
import { listExpectations, type ExpectationItem } from "@/lib/dal/goals";
import type { Viewer } from "@/lib/permissions";
import type { Person } from "@/lib/tasks/types";
import { pendingRequests, reportTasks, slice, type ReportRequest, type ReportTask } from "./data";
import type { ReportRange } from "./range";

// The three reports, built deterministically from stored rows. Each returns facts; the page and the Markdown
// renderer phrase them. No report invents a percentage or a ranking.

export type Scope = { teamId: string | null; teamName: string | null };

export type TeamSummary = {
  kind: "team";
  scope: Scope;
  range: ReportRange;
  planned: { total: number; completed: number; open: number; rejected: number };
  delivered: ReportTask[];
  stillOpen: ReportTask[];
  blocked: ReportTask[];
  awaitingApproval: ReportTask[];
  pendingRequests: ReportRequest[];
  goalsAdvanced: { id: string; title: string; completed: number }[];
  outcomes: ExpectationItem[];
};

function overlaps(item: ExpectationItem, range: ReportRange): boolean {
  return item.periodStart <= range.to && item.periodEnd >= range.from;
}

export async function buildTeamSummary(viewer: Viewer, scope: Scope, range: ReportRange, today: string): Promise<TeamSummary> {
  const team = slice.team(scope.teamId);
  const [delivered, planned, stillOpen, blocked, awaitingApproval, requests, expectations] = await Promise.all([
    reportTasks(viewer, and(team, slice.completedBetween(range.from, range.to, viewer.timezone)), "completed"),
    reportTasks(viewer, and(team, slice.dueBetween(range.from, range.to)), "due"),
    reportTasks(viewer, and(team, slice.open(), slice.dueBetween(range.from, range.to)), "due"),
    reportTasks(viewer, and(team, slice.status("blocked")), "due"),
    reportTasks(viewer, and(team, slice.status("awaiting_approval")), "due"),
    pendingRequests(viewer, scope.teamId),
    listExpectations(viewer, scope.teamId ? { teamId: scope.teamId } : {}),
  ]);
  const goalsMap = new Map<string, { id: string; title: string; completed: number }>();
  for (const task of delivered) {
    if (!task.goal) continue;
    const entry = goalsMap.get(task.goal.id) ?? { ...task.goal, completed: 0 };
    entry.completed += 1;
    goalsMap.set(task.goal.id, entry);
  }
  const overdueOpen = await reportTasks(viewer, and(team, slice.overdue(today)), "due");
  const openIds = new Set(stillOpen.map((task) => task.id));
  return {
    kind: "team",
    scope,
    range,
    planned: {
      total: planned.length,
      completed: planned.filter((task) => task.status === "completed").length,
      open: planned.filter((task) => task.status !== "completed" && task.status !== "rejected").length,
      rejected: planned.filter((task) => task.status === "rejected").length,
    },
    delivered,
    stillOpen: [...stillOpen, ...overdueOpen.filter((task) => !openIds.has(task.id))],
    blocked,
    awaitingApproval,
    pendingRequests: requests,
    goalsAdvanced: [...goalsMap.values()].sort((a, b) => b.completed - a.completed),
    outcomes: expectations.filter((item) => overlaps(item, range)),
  };
}

export type Contributions = {
  kind: "contributions";
  person: Person;
  range: ReportRange;
  delivered: ReportTask[];
  problemsSolved: ReportTask[];
  goalsSupported: { id: string; title: string; completed: number }[];
  outstanding: ReportTask[];
  waitingOnOthers: ReportTask[];
  evidenceCount: number;
};

export async function buildContributions(viewer: Viewer, person: Person, range: ReportRange): Promise<Contributions> {
  const mine = slice.assignee(person.id);
  const [delivered, outstanding] = await Promise.all([
    reportTasks(viewer, and(mine, slice.completedBetween(range.from, range.to, viewer.timezone)), "completed"),
    reportTasks(viewer, and(mine, slice.open()), "due"),
  ]);
  const goalsMap = new Map<string, { id: string; title: string; completed: number }>();
  for (const task of delivered) {
    if (!task.goal) continue;
    const entry = goalsMap.get(task.goal.id) ?? { ...task.goal, completed: 0 };
    entry.completed += 1;
    goalsMap.set(task.goal.id, entry);
  }
  return {
    kind: "contributions",
    person,
    range,
    delivered,
    problemsSolved: delivered.filter((task) => task.priority === "urgent" || task.priority === "high" || task.wasBlocked),
    goalsSupported: [...goalsMap.values()].sort((a, b) => b.completed - a.completed),
    outstanding: outstanding.filter((task) => task.status !== "blocked" && task.status !== "awaiting_approval"),
    waitingOnOthers: outstanding.filter((task) => task.status === "blocked" || task.status === "awaiting_approval"),
    evidenceCount: delivered.reduce((sum, task) => sum + task.evidence.length, 0),
  };
}

export type StakeholderUpdate = {
  kind: "stakeholder";
  scope: Scope;
  range: ReportRange;
  completed: ReportTask[];
  inProgress: ReportTask[];
  blocked: ReportTask[];
  pendingRequests: ReportRequest[];
  upcoming: ReportTask[];
  upcomingUntil: string;
};

export async function buildStakeholderUpdate(viewer: Viewer, scope: Scope, range: ReportRange, today: string): Promise<StakeholderUpdate> {
  const team = slice.team(scope.teamId);
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 14);
  const upcomingUntil = horizon.toISOString().slice(0, 10);
  const [completed, inProgress, blocked, requests, upcoming] = await Promise.all([
    reportTasks(viewer, and(team, slice.completedBetween(range.from, range.to, viewer.timezone)), "completed"),
    reportTasks(viewer, and(team, slice.status("in_progress")), "due"),
    reportTasks(viewer, and(team, slice.status("blocked")), "due"),
    pendingRequests(viewer, scope.teamId),
    reportTasks(viewer, and(team, slice.open(), slice.dueBetween(today, upcomingUntil)), "due"),
  ]);
  return { kind: "stakeholder", scope, range, completed, inProgress, blocked, pendingRequests: requests, upcoming, upcomingUntil };
}

export type Report = TeamSummary | Contributions | StakeholderUpdate;
