import type { Metadata } from "next";
import { InvitationsSection } from "@/components/settings/invitations-section";
import { MembersSection } from "@/components/settings/members-section";
import { OrgName } from "@/components/settings/org-name";
import { SampleDataControls } from "@/components/settings/sample-data";
import { TeamsSection } from "@/components/settings/teams-section";
import { hasSampleData } from "@/lib/demo/status";
import { listMembers, listPendingInvitations, listTeams } from "@/lib/dal/orgs";
import { canManageOrg } from "@/lib/permissions";
import { formatAbsolute, formatRelative, formatShortDate } from "@/lib/time";
import { requireViewerContext } from "@/lib/viewer";

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationSettingsPage() {
  const { viewer, org } = await requireViewerContext();
  const canManage = canManageOrg(viewer);
  const [members, teams, invitations, sample] = await Promise.all([
    listMembers(viewer),
    listTeams(viewer),
    canManage ? listPendingInvitations(viewer) : Promise.resolve([]),
    canManage ? hasSampleData(org.orgId) : Promise.resolve(false),
  ]);
  const now = new Date();
  const tz = viewer.timezone;

  return (
    <div className="space-y-8">
      <OrgName
        name={org.name}
        canManage={canManage}
        facts={[
          `${members.length} ${members.length === 1 ? "member" : "members"}`,
          `${teams.length} ${teams.length === 1 ? "team" : "teams"}`,
          org.timezone.replaceAll("_", " "),
          canManage ? null : "Only admins can change members and teams.",
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <MembersSection
        viewerId={viewer.userId}
        canManage={canManage}
        members={members.map((member) => ({
          userId: member.userId,
          name: member.name,
          email: member.email ?? "",
          image: member.image,
          role: member.role,
          joined: formatShortDate(member.joinedAt, tz, true),
        }))}
      />

      {canManage ? (
        <InvitationsSection
          teams={teams.map((team) => ({ id: team.id, name: team.name }))}
          invitations={invitations.map((invite) => ({
            id: invite.id,
            email: invite.email,
            orgRole: invite.orgRole,
            teamName: invite.teamName,
            teamRole: invite.teamRole,
            expired: invite.expiresAt <= now,
            expires: formatRelative(invite.expiresAt, now, tz),
            expiresAbsolute: formatAbsolute(invite.expiresAt, tz),
            invitedBy: invite.invitedByName,
          }))}
        />
      ) : null}

      <TeamsSection
        canManage={canManage}
        teams={teams}
        members={members
          .filter((member) => member.role !== "stakeholder")
          .map((member) => ({ userId: member.userId, name: member.name, email: member.email ?? "" }))}
      />

      {canManage ? (
        <section aria-labelledby="sample-heading" className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
            <div>
              <h2 id="sample-heading" className="text-base font-semibold">
                Sample data
              </h2>
              <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
                {sample
                  ? "Sample work is loaded. Every sample item starts with “Sample ·” and can be removed in one go; real work is never touched."
                  : "Load a handful of labelled tasks, requests, a goal and an agreed outcome to see how the screens read before real work arrives."}
              </p>
            </div>
            <SampleDataControls loaded={sample} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
