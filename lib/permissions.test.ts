import { describe, expect, it } from "vitest";
import type { OrgRole, TeamRole } from "@/lib/constants";
import {
  canApproveTask,
  canCreateTask,
  canEditTask,
  canManageOrg,
  canReadRequest,
  canReadTask,
  canSubmitRequest,
  canTriageRequest,
  canUpdateProgress,
  isManager,
  leadsTeam,
  navFor,
  type RequestScope,
  type TaskScope,
  type Viewer,
} from "./permissions";

const ORG = "org-demo";
const OTHER_ORG = "org-other";
const ENG = "team-eng";
const DESIGN = "team-design";

function viewer(userId: string, orgRole: OrgRole, teams: [string, TeamRole][] = [], orgId = ORG): Viewer {
  return { userId, orgId, orgRole, teamRoles: new Map(teams), timezone: "America/Jamaica" };
}

const admin = viewer("avery", "admin");
const lead = viewer("morgan", "member", [[ENG, "lead"]]);
const member = viewer("jordan", "member", [[ENG, "member"]]);
const designer = viewer("dana", "member", [[DESIGN, "member"]]);
const stakeholder = viewer("taylor", "stakeholder");
const otherAdmin = viewer("riley", "admin", [[ENG, "lead"]], OTHER_ORG);

const task = (overrides: Partial<TaskScope> = {}): TaskScope => ({
  orgId: ORG,
  teamId: ENG,
  assigneeId: "sam",
  createdBy: "sam",
  approverId: null,
  requesterId: null,
  ...overrides,
});

const request = (overrides: Partial<RequestScope> = {}): RequestScope => ({
  orgId: ORG,
  teamId: ENG,
  requesterId: "taylor",
  ...overrides,
});

describe("cross-org isolation", () => {
  // Riley is an admin and even holds a team role keyed by the same team id: none of it carries across orgs.
  it("an admin of another org can neither read nor change anything here", () => {
    expect(canReadTask(otherAdmin, task())).toBe(false);
    expect(canEditTask(otherAdmin, task())).toBe(false);
    expect(canUpdateProgress(otherAdmin, task())).toBe(false);
    expect(canApproveTask(otherAdmin, task({ approverId: "riley" }))).toBe(false);
    expect(canReadRequest(otherAdmin, request())).toBe(false);
    expect(canTriageRequest(otherAdmin, request())).toBe(false);
    expect(canSubmitRequest(otherAdmin, { orgId: ORG })).toBe(false);
    expect(canCreateTask(otherAdmin, { id: ENG, orgId: ORG })).toBe(false);
  });

  it("being the assignee or creator does not leak across orgs", () => {
    const foreign = task({ orgId: OTHER_ORG, assigneeId: "jordan", createdBy: "jordan" });
    expect(canReadTask(member, foreign)).toBe(false);
    expect(canEditTask(member, foreign)).toBe(false);
  });
});

describe("tasks", () => {
  it("everyone but stakeholders reads every task in the org", () => {
    for (const each of [admin, lead, member, designer]) expect(canReadTask(each, task())).toBe(true);
    expect(canReadTask(stakeholder, task())).toBe(false);
  });

  it("a stakeholder reads only tasks created from their own requests", () => {
    expect(canReadTask(stakeholder, task({ requesterId: "taylor" }))).toBe(true);
    expect(canReadTask(stakeholder, task({ requesterId: "someone-else" }))).toBe(false);
  });

  it("tasks are created in teams the viewer belongs to (admins anywhere)", () => {
    expect(canCreateTask(member, { id: ENG, orgId: ORG })).toBe(true);
    expect(canCreateTask(member, { id: DESIGN, orgId: ORG })).toBe(false);
    expect(canCreateTask(admin, { id: DESIGN, orgId: ORG })).toBe(true);
    expect(canCreateTask(stakeholder, { id: ENG, orgId: ORG })).toBe(false);
  });

  it("edits belong to the assignee, the creator, the team lead and admins", () => {
    expect(canEditTask(member, task({ assigneeId: "jordan" }))).toBe(true);
    expect(canEditTask(member, task({ createdBy: "jordan" }))).toBe(true);
    expect(canEditTask(member, task())).toBe(false);
    expect(canEditTask(lead, task())).toBe(true);
    expect(canEditTask(admin, task())).toBe(true);
    expect(canEditTask(designer, task())).toBe(false);
    expect(canEditTask(stakeholder, task({ requesterId: "taylor", assigneeId: "taylor" }))).toBe(false);
  });

  it("progress can be added to any task in the viewer's teams", () => {
    expect(canUpdateProgress(member, task())).toBe(true);
    expect(canUpdateProgress(designer, task())).toBe(false);
    expect(canUpdateProgress(designer, task({ assigneeId: "dana" }))).toBe(true);
    expect(canUpdateProgress(stakeholder, task({ requesterId: "taylor" }))).toBe(false);
  });

  it("approval is for the named approver and the team's leads", () => {
    expect(canApproveTask(member, task({ approverId: "jordan" }))).toBe(true);
    expect(canApproveTask(member, task({ approverId: "morgan" }))).toBe(false);
    expect(canApproveTask(lead, task())).toBe(true);
    expect(canApproveTask(admin, task())).toBe(true);
    expect(canApproveTask(stakeholder, task({ approverId: "taylor" }))).toBe(false);
  });
});

describe("requests", () => {
  it("stakeholders read only their own requests; members read all", () => {
    expect(canReadRequest(stakeholder, request())).toBe(true);
    expect(canReadRequest(stakeholder, request({ requesterId: "jordan" }))).toBe(false);
    expect(canReadRequest(member, request({ requesterId: "someone" }))).toBe(true);
  });

  it("anyone in the org may submit", () => {
    for (const each of [admin, lead, member, stakeholder]) expect(canSubmitRequest(each, { orgId: ORG })).toBe(true);
  });

  it("only the team's leads and admins triage", () => {
    expect(canTriageRequest(lead, request())).toBe(true);
    expect(canTriageRequest(admin, request({ teamId: DESIGN }))).toBe(true);
    expect(canTriageRequest(lead, request({ teamId: DESIGN }))).toBe(false);
    expect(canTriageRequest(member, request())).toBe(false);
    expect(canTriageRequest(stakeholder, request())).toBe(false);
  });
});

describe("roles", () => {
  it("a stakeholder never counts as a lead, even with a stray team row", () => {
    const odd = viewer("taylor", "stakeholder", [[ENG, "lead"]]);
    expect(leadsTeam(odd, ENG)).toBe(false);
    expect(isManager(odd)).toBe(false);
    expect(canTriageRequest(odd, request())).toBe(false);
  });

  it("managers are admins and anyone who leads a team", () => {
    expect(isManager(admin)).toBe(true);
    expect(isManager(lead)).toBe(true);
    expect(isManager(member)).toBe(false);
  });

  it("only admins manage the organization", () => {
    expect(canManageOrg(admin)).toBe(true);
    for (const each of [lead, member, stakeholder]) expect(canManageOrg(each)).toBe(false);
  });

  it("stakeholders see Overview and Requests only", () => {
    expect(navFor(stakeholder)).toEqual(["overview", "requests"]);
    expect(navFor(member)).toEqual(["overview", "my-work", "team", "requests"]);
  });
});
