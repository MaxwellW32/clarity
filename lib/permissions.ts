import type { OrgRole, TeamRole } from "@/lib/constants";

/**
 * Who may do what (docs/PLAN.md §3). Pure predicates over a Viewer and the scope of a resource,
 * no I/O, so every DAL query and action can call them and they can be unit-tested.
 *
 * Every predicate that takes a resource checks the organization first: an id that belongs to
 * another org is simply not visible, whatever the role.
 */
export type Viewer = {
  userId: string;
  orgId: string;
  orgRole: OrgRole;
  /** The teams of this org the viewer belongs to, and their role on each. */
  teamRoles: Map<string, TeamRole>;
  timezone: string;
};

type OrgScoped = { orgId: string };

export type TaskScope = OrgScoped & {
  teamId: string;
  assigneeId: string | null;
  createdBy: string;
  approverId?: string | null;
  /** Requester of the request the task was converted from, if any. */
  requesterId?: string | null;
};

export type RequestScope = OrgScoped & { teamId: string; requesterId: string };

export const inOrg = (viewer: Viewer, resource: OrgScoped) => viewer.orgId === resource.orgId;
export const isAdmin = (viewer: Viewer) => viewer.orgRole === "admin";
export const isStakeholder = (viewer: Viewer) => viewer.orgRole === "stakeholder";

export const isOnTeam = (viewer: Viewer, teamId: string) => !isStakeholder(viewer) && viewer.teamRoles.has(teamId);

/** Admins may act as lead on every team. */
export const leadsTeam = (viewer: Viewer, teamId: string) =>
  isAdmin(viewer) || (!isStakeholder(viewer) && viewer.teamRoles.get(teamId) === "lead");

/** A manager is anyone who leads at least one team (admins count). */
export const isManager = (viewer: Viewer) =>
  isAdmin(viewer) || (!isStakeholder(viewer) && [...viewer.teamRoles.values()].includes("lead"));

// --- tasks ------------------------------------------------------------------

export function canReadTask(viewer: Viewer, task: TaskScope): boolean {
  if (!inOrg(viewer, task)) return false;
  if (isStakeholder(viewer)) return task.requesterId != null && task.requesterId === viewer.userId;
  return true;
}

export function canCreateTask(viewer: Viewer, team: OrgScoped & { id: string }): boolean {
  return inOrg(viewer, team) && (isAdmin(viewer) || isOnTeam(viewer, team.id));
}

export function canEditTask(viewer: Viewer, task: TaskScope): boolean {
  if (!inOrg(viewer, task) || isStakeholder(viewer)) return false;
  return (
    isAdmin(viewer) ||
    task.assigneeId === viewer.userId ||
    task.createdBy === viewer.userId ||
    leadsTeam(viewer, task.teamId)
  );
}

/** Progress may be added to any task in the viewer's teams, and to any task they may edit. */
export function canUpdateProgress(viewer: Viewer, task: TaskScope): boolean {
  return canEditTask(viewer, task) || (inOrg(viewer, task) && isOnTeam(viewer, task.teamId));
}

export function canApproveTask(viewer: Viewer, task: TaskScope): boolean {
  if (!inOrg(viewer, task) || isStakeholder(viewer)) return false;
  return (task.approverId != null && task.approverId === viewer.userId) || leadsTeam(viewer, task.teamId);
}

// --- requests -----------------------------------------------------------------

export function canReadRequest(viewer: Viewer, request: RequestScope): boolean {
  if (!inOrg(viewer, request)) return false;
  return !isStakeholder(viewer) || request.requesterId === viewer.userId;
}

/** Anyone in the org may submit a request to one of its teams (stakeholders included). */
export const canSubmitRequest = (viewer: Viewer, team: OrgScoped) => inOrg(viewer, team);

/** Triage belongs to the team's leads and the org's admins. */
export function canTriageRequest(viewer: Viewer, request: RequestScope): boolean {
  return inOrg(viewer, request) && leadsTeam(viewer, request.teamId);
}

// --- goals and team pages ------------------------------------------------------

export const canReadGoals = (viewer: Viewer) => !isStakeholder(viewer);
export const canManageGoal = (viewer: Viewer, teamId: string | null) =>
  teamId === null ? isAdmin(viewer) : leadsTeam(viewer, teamId);
export const canSeeTeamPages = (viewer: Viewer) => !isStakeholder(viewer);

// --- organization administration --------------------------------------------

export const canManageOrg = (viewer: Viewer) => isAdmin(viewer);

// --- navigation -------------------------------------------------------------

export type NavKey = "overview" | "my-work" | "team" | "requests" | "goals" | "reports";

/** What the navigation shows. Goals and Reports stay hidden until Phase 2 ships. */
export function navFor(viewer: Pick<Viewer, "orgRole">): NavKey[] {
  if (viewer.orgRole === "stakeholder") return ["overview", "requests"];
  return ["overview", "my-work", "team", "requests"];
}
