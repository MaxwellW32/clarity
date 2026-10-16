import "server-only";
import { listMembers, listTeams } from "@/lib/dal/orgs";
import { isManager, isStakeholder, type Viewer } from "@/lib/permissions";
import { buildContributions, buildStakeholderUpdate, buildTeamSummary, type Report } from "./build";
import { REPORT_TYPES, type ReportParams, type ReportType } from "./params";
import { parseRange } from "./range";
import type { Person } from "@/lib/tasks/types";

export const canViewReports = (viewer: Viewer) => !isStakeholder(viewer);

/** Who the viewer may report on: everyone (managers), or only themselves. */
export const canReportOn = (viewer: Viewer, userId: string) => userId === viewer.userId || isManager(viewer);

type Raw = Record<string, string | string[] | undefined>;
const one = (raw: Raw, key: string): string => {
  const value = raw[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
};

/** Parses the URL into report params the viewer is allowed to ask for, resolving names for the heading. */
export async function resolveReport(viewer: Viewer, raw: Raw, today: string, forced?: { type: ReportType; person?: string }) {
  const [teams, members] = await Promise.all([listTeams(viewer), listMembers(viewer)]);
  const typeRaw = forced?.type ?? one(raw, "type");
  const type: ReportType = (REPORT_TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as ReportType) : "team";
  const teamRaw = one(raw, "team");
  const team = teams.find((each) => each.id === teamRaw) ?? null;
  const people = members.filter((member) => member.role !== "stakeholder").map(({ userId, name, email, image }) => ({ id: userId, name, email, image }));
  const personRaw = forced?.person ?? one(raw, "person");
  const person: Person =
    (canReportOn(viewer, personRaw) ? people.find((each) => each.id === personRaw) : undefined) ?? (people.find((each) => each.id === viewer.userId) ?? { id: viewer.userId, name: null, email: null, image: null });
  const params: ReportParams = { type, team: team?.id ?? "", person: person.id, range: parseRange(raw, today) };
  return { params, teams, people, person, teamName: team?.name ?? null };
}

export async function buildReport(viewer: Viewer, params: ReportParams, person: Person, teamName: string | null, today: string): Promise<Report> {
  const scope = { teamId: params.team || null, teamName };
  switch (params.type) {
    case "team":
      return buildTeamSummary(viewer, scope, params.range, today);
    case "contributions":
      return buildContributions(viewer, person, params.range);
    case "stakeholder":
      return buildStakeholderUpdate(viewer, scope, params.range, today);
  }
}
