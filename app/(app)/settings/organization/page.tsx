import type { Metadata } from "next";
import { InvitationsSection } from "@/components/settings/invitations-section";
import { MembersSection } from "@/components/settings/members-section";
import { TeamsSection } from "@/components/settings/teams-section";
import { listMembers, listPendingInvitations, listTeams } from "@/lib/dal/orgs";
import { canManageOrg } from "@/lib/permissions";
import { formatAbsolute, formatRelative, formatShortDate } from "@/lib/time";
import { requireViewerContext } from "@/lib/viewer";

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationSettingsPage() {
  const { viewer, org } = await requireViewerContext();
  const canManage = canManageOrg(viewer);
  const [members, teams, invitations] = await Promise.all([
    listMembers(viewer),
    listTeams(viewer),
    canManage ? listPendingInvitations(viewer) : Promise.resolve([]),
  ]);
  const now = new Date();
  const tz = viewer.timezone;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold">{org.name}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? "member" : "members"} · {teams.length}{" "}
          {teams.length === 1 ? "team" : "teams"} · {org.timezone.replaceAll("_", " ")}
          {canManage ? null : " · Only admins can change members and teams."}
        </p>
      </div>

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
    </div>
  );
}
