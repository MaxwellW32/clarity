import { LayoutGrid, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ORG_ROLE_LABELS, TEAM_ROLE_LABELS } from "@/lib/constants";
import { listTeams } from "@/lib/dal/orgs";
import { canManageOrg, isAdmin } from "@/lib/permissions";
import { requireViewerContext } from "@/lib/viewer";

export const metadata: Metadata = { title: "Overview" };

function greeting(timeZone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function OverviewPage() {
  const { viewer, user, org } = await requireViewerContext();
  const firstName = (user.name ?? "").split(" ")[0] || null;
  const teams = (await listTeams(viewer)).filter((team) => isAdmin(viewer) || viewer.teamRoles.has(team.id));
  const leads = teams.filter((team) => viewer.teamRoles.get(team.id) === "lead").map((team) => team.name);

  return (
    <>
      <PageHeader
        title={`${greeting(viewer.timezone)}${firstName ? `, ${firstName}` : ""}`}
        description={[org.name, ORG_ROLE_LABELS[viewer.orgRole], leads.length > 0 ? `Leads ${leads.join(", ")}` : null]
          .filter(Boolean)
          .join(" · ")}
        action={
          canManageOrg(viewer) ? (
            <Button asChild>
              <Link href="/settings/organization#invite">
                <UserPlus aria-hidden />
                Invite people
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <EmptyState
          icon={LayoutGrid}
          title="Your overview fills in once tasks arrive"
          description={
            viewer.orgRole === "stakeholder"
              ? "Your requests, their decisions and the work they turned into will show up here."
              : "Task tracking is coming in the next step. Attention items, team health and requests will show up here."
          }
        />

        {viewer.orgRole !== "stakeholder" ? (
          <section aria-labelledby="teams-heading" className="rounded-lg border bg-card">
            <h2 id="teams-heading" className="border-b px-4 py-3 text-sm font-medium">
              {isAdmin(viewer) ? "Teams" : "Your teams"}
            </h2>
            {teams.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">You aren&apos;t on a team yet.</p>
            ) : (
              <ul className="divide-y">
                {teams.map((team) => {
                  const role = viewer.teamRoles.get(team.id);
                  return (
                    <li key={team.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted">
                        <Users className="size-4 text-muted-foreground" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{team.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {team.members.length} {team.members.length === 1 ? "member" : "members"}
                          {role ? ` · You're ${TEAM_ROLE_LABELS[role].toLowerCase()}` : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}
