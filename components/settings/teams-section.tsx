"use client";

import { Plus, Users, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createTeam, removeTeamMember, setTeamMember } from "@/actions/teams";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { TEAM_ROLE_LABELS, TEAM_ROLES, type TeamRole } from "@/lib/constants";
import type { TeamWithMembers } from "@/lib/dal/orgs";
import { toastResult } from "@/lib/toast-result";
import { Section } from "./section";

type OrgMember = { userId: string; name: string | null; email: string };

function TeamCard({ team, members, canManage }: { team: TeamWithMembers; members: OrgMember[]; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState("");
  const [addRole, setAddRole] = useState<TeamRole>("member");
  const onTeam = new Set(team.members.map((member) => member.userId));
  const candidates = members.filter((member) => !onTeam.has(member.userId));
  const run = (work: () => Promise<unknown>) => startTransition(async () => void (await work()));

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="truncate text-sm font-semibold">{team.name}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">
          {team.members.length} {team.members.length === 1 ? "member" : "members"}
        </span>
      </div>
      {team.description ? <p className="-mt-2 mb-3 text-sm text-muted-foreground">{team.description}</p> : null}

      <ul className="space-y-1">
        {team.members.map((member) => {
          const label = member.name ?? member.email ?? "Member";
          return (
            <li key={member.userId} className="flex items-center gap-2.5 rounded-md py-1">
              <UserAvatar name={member.name} email={member.email} image={member.image} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
              {canManage ? (
                <>
                  <NativeSelect
                    aria-label={`${label}'s role on ${team.name}`}
                    className="w-28"
                    value={member.role}
                    disabled={pending}
                    onChange={(event) => {
                      const role = event.target.value as TeamRole;
                      run(async () => toastResult(await setTeamMember({ teamId: team.id, userId: member.userId, role })));
                    }}
                  >
                    {TEAM_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {TEAM_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${label} from ${team.name}`}
                    className="text-muted-foreground"
                    disabled={pending}
                    onClick={() => run(async () => toastResult(await removeTeamMember({ teamId: team.id, userId: member.userId })))}
                  >
                    <X />
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">{TEAM_ROLE_LABELS[member.role]}</span>
              )}
            </li>
          );
        })}
      </ul>

      {canManage && candidates.length > 0 ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (adding === "") return;
            run(async () => {
              if (toastResult(await setTeamMember({ teamId: team.id, userId: adding, role: addRole }))) setAdding("");
            });
          }}
        >
          <NativeSelect
            aria-label={`Add someone to ${team.name}`}
            className="min-w-[10rem] flex-1"
            value={adding}
            onChange={(event) => setAdding(event.target.value)}
          >
            <option value="">Add a member…</option>
            {candidates.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name ?? member.email}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Their role on the team"
            className="w-28"
            value={addRole}
            onChange={(event) => setAddRole(event.target.value as TeamRole)}
          >
            {TEAM_ROLES.map((role) => (
              <option key={role} value={role}>
                {TEAM_ROLE_LABELS[role]}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" disabled={pending || adding === ""}>
            Add
          </Button>
        </form>
      ) : null}
    </li>
  );
}

function CreateTeamForm() {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2 border-t px-4 py-3 sm:px-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          if (toastResult(await createTeam({ name, lead: false }))) setName("");
        });
      }}
    >
      <Input
        aria-label="New team name"
        placeholder="New team name"
        className="min-w-[10rem] flex-1"
        value={name}
        maxLength={60}
        onChange={(event) => setName(event.target.value)}
      />
      <Button type="submit" variant="outline" disabled={pending || name.trim().length < 2}>
        <Plus aria-hidden />
        Create team
      </Button>
    </form>
  );
}

export function TeamsSection({
  teams,
  members,
  canManage,
}: {
  teams: TeamWithMembers[];
  members: OrgMember[];
  canManage: boolean;
}) {
  return (
    <Section id="teams" title="Teams" description="Leads triage their team's requests and approve its work.">
      {teams.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-4 text-sm text-muted-foreground sm:px-5">
          <Users className="size-4" aria-hidden />
          No teams yet.
        </div>
      ) : (
        <ul className="divide-y">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} members={members} canManage={canManage} />
          ))}
        </ul>
      )}
      {canManage ? <CreateTeamForm /> : null}
    </Section>
  );
}
