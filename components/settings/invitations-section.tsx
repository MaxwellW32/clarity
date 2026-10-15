"use client";

import { cn } from "cn";
import { Mail, RotateCw, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { inviteMembers, resendInvitation, revokeInvitation } from "@/actions/invitations";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ORG_ROLE_LABELS, ORG_ROLES, TEAM_ROLE_LABELS, TEAM_ROLES, type OrgRole, type TeamRole } from "@/lib/constants";
import { toastResult } from "@/lib/toast-result";
import { Section } from "./section";

type Invite = {
  id: string;
  email: string;
  orgRole: OrgRole;
  teamName: string | null;
  teamRole: TeamRole | null;
  expired: boolean;
  expires: string;
  expiresAbsolute: string;
  invitedBy: string | null;
};

function InviteForm({ teams }: { teams: { id: string; name: string }[] }) {
  const [emails, setEmails] = useState("");
  const [orgRole, setOrgRole] = useState<OrgRole>("member");
  const [teamId, setTeamId] = useState(teams.length === 1 ? teams[0].id : "");
  const [teamRole, setTeamRole] = useState<TeamRole>("member");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const onTeam = orgRole !== "stakeholder" && teamId !== "";

  return (
    <form
      className="grid gap-4 border-b px-4 py-4 sm:px-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await inviteMembers({ emails, orgRole, teamId: onTeam ? teamId : undefined, teamRole });
          if (!result.ok) {
            setError(result.fieldErrors?.emails?.[0] ?? result.error);
            return;
          }
          setError(undefined);
          const { invited, alreadyMembers, failed } = result.data;
          if (invited.length > 0) {
            toastResult(result);
            setEmails("");
          }
          if (alreadyMembers.length > 0) toast.info(`Already a member: ${alreadyMembers.join(", ")}`);
          if (failed.length > 0) toast.error(`Couldn't email ${failed.join(", ")}. Try resending.`);
        });
      }}
    >
      <Field id="invite-emails" label="Email addresses" hint="Separate several with commas." error={error}>
        <Input
          id="invite-emails"
          value={emails}
          onChange={(event) => setEmails(event.target.value)}
          placeholder="name@company.com, another@company.com"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="invite-role" label="Role">
          <NativeSelect id="invite-role" value={orgRole} onChange={(event) => setOrgRole(event.target.value as OrgRole)}>
            {ORG_ROLES.map((role) => (
              <option key={role} value={role}>
                {ORG_ROLE_LABELS[role]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="invite-team" label="Team">
          <NativeSelect
            id="invite-team"
            value={orgRole === "stakeholder" ? "" : teamId}
            disabled={orgRole === "stakeholder"}
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">No team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="invite-team-role" label="On the team as">
          <NativeSelect
            id="invite-team-role"
            value={teamRole}
            disabled={!onTeam}
            onChange={(event) => setTeamRole(event.target.value as TeamRole)}
          >
            {TEAM_ROLES.map((role) => (
              <option key={role} value={role}>
                {TEAM_ROLE_LABELS[role]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || emails.trim() === ""}>
          <Mail aria-hidden />
          {pending ? "Sending…" : "Send invitations"}
        </Button>
      </div>
    </form>
  );
}

function InviteRow({ invite }: { invite: Invite }) {
  const [pending, startTransition] = useTransition();
  const detail = [
    ORG_ROLE_LABELS[invite.orgRole],
    invite.teamName ? `${invite.teamName}${invite.teamRole === "lead" ? " (lead)" : ""}` : null,
    invite.invitedBy ? `invited by ${invite.invitedBy}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
      <div className="min-w-[10rem] flex-1">
        <p className="truncate text-sm font-medium">{invite.email}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs whitespace-nowrap",
              invite.expired ? "bg-status-blocked-bg text-status-blocked-fg" : "text-muted-foreground",
            )}
          >
            {invite.expired ? "Expired" : `Expires ${invite.expires}`}
          </span>
        </TooltipTrigger>
        <TooltipContent>{invite.expiresAbsolute}</TooltipContent>
      </Tooltip>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(async () => void toastResult(await resendInvitation({ id: invite.id })))}
        >
          <RotateCw aria-hidden />
          Resend
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Revoke invitation for ${invite.email}`}
          disabled={pending}
          className="text-muted-foreground"
          onClick={() => startTransition(async () => void toastResult(await revokeInvitation({ id: invite.id })))}
        >
          <X />
        </Button>
      </div>
    </li>
  );
}

export function InvitationsSection({ invitations, teams }: { invitations: Invite[]; teams: { id: string; name: string }[] }) {
  return (
    <Section id="invite" title="Invite people" description="They get an email with a link that works for 7 days.">
      <InviteForm teams={teams} />
      {invitations.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">No pending invitations.</p>
      ) : (
        <>
          <h3 className="px-4 pt-4 text-xs font-medium text-muted-foreground sm:px-5">
            Pending ({invitations.length})
          </h3>
          <ul className="divide-y">
            {invitations.map((invite) => (
              <InviteRow key={invite.id} invite={invite} />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
