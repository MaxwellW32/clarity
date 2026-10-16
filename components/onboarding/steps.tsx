"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { inviteMembers } from "@/actions/invitations";
import { createOrganization, renameOrganization } from "@/actions/org";
import { createTeam, renameTeam } from "@/actions/teams";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { toastResult } from "@/lib/toast-result";

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/** first: no org yet · another: "New organization" from the switcher · rename: Back from the team step. */
export function OrgStep({
  zones,
  mode,
  currentName = "",
}: {
  zones: string[];
  mode: "first" | "another" | "rename";
  currentName?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const renaming = mode === "rename";

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          if (renaming) {
            const result = await renameOrganization({ name });
            if (result.ok) router.push("/onboarding");
            else setErrors(result.fieldErrors ?? { name: [result.error] });
            return;
          }
          // On success the action redirects to the next step.
          const result = await createOrganization({ name, timezone });
          if (result && !result.ok) setErrors(result.fieldErrors ?? { name: [result.error] });
        });
      }}
    >
      <Heading
        title={renaming ? "Your organisation" : mode === "another" ? "Create another organisation" : "Create your organisation"}
        text={renaming ? "Fix the name if it isn't right. Your team and settings stay as they are." : "You can invite people in a moment."}
      />
      <Field id="org-name" label="Organisation name" hint="Your company or group, e.g. Intellibus" error={errors.name?.[0]}>
        <Input
          id="org-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your company or group"
          maxLength={80}
          autoFocus
          autoComplete="organization"
          aria-invalid={errors.name ? true : undefined}
        />
      </Field>
      {renaming ? null : (
        <Field id="org-timezone" label="Timezone" hint="Used for due dates and reports." error={errors.timezone?.[0]}>
          <NativeSelect id="org-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Button type="submit" className="h-10" disabled={pending || name.trim().length < 2}>
        {pending ? "Saving…" : renaming ? "Save organisation" : "Create organisation"}
      </Button>
    </form>
  );
}

/** Creates the first team, or (Back from the invite step) renames it. */
export function TeamStep({ team }: { team: { id: string; name: string } | null }) {
  const router = useRouter();
  const [name, setName] = useState(team?.name ?? "");
  const [lead, setLead] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = team ? await renameTeam({ teamId: team.id, name }) : await createTeam({ name, lead });
          if (result.ok) router.push("/onboarding");
          else setError(result.fieldErrors?.name?.[0] ?? result.error);
        });
      }}
    >
      <Heading
        title={team ? "Your first team" : "Create your first team"}
        text="Work belongs to a team. Its leads see its health and approve its work."
      />
      <Field id="team-name" label="Team name" hint="The group that works together, e.g. Apex" error={error}>
        <Input
          id="team-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your team's name"
          maxLength={60}
          autoFocus
          aria-invalid={error ? true : undefined}
        />
      </Field>
      {team ? null : (
        <div className="flex items-center gap-2.5">
          <Checkbox id="team-lead" checked={lead} onCheckedChange={(value) => setLead(value === true)} />
          <Label htmlFor="team-lead" className="font-normal">
            I lead this team
          </Label>
        </div>
      )}
      <Button type="submit" className="h-10" disabled={pending || name.trim().length < 2}>
        {pending ? "Saving…" : team ? "Save team" : "Create team"}
      </Button>
    </form>
  );
}

export function InviteStep({ teamId, teamName }: { teamId: string | null; teamName: string | null }) {
  const router = useRouter();
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<"member" | "stakeholder" | "admin">("member");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await inviteMembers({ emails, orgRole: role, teamId: teamId ?? undefined });
          if (!result.ok) {
            setError(result.fieldErrors?.emails?.[0] ?? result.error);
            return;
          }
          toastResult(result);
          router.push("/onboarding?step=done");
        });
      }}
    >
      <Heading
        title="Invite your colleagues"
        text={teamName ? `They'll join ${teamName}. You can skip this and invite people later.` : "You can skip this and invite people later."}
      />
      <Field id="onboarding-emails" label="Email addresses" hint="Separate several with commas." error={error}>
        <Input
          id="onboarding-emails"
          value={emails}
          onChange={(event) => setEmails(event.target.value)}
          placeholder="name@company.com, another@company.com"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
        />
      </Field>
      <Field id="onboarding-role" label="Role">
        <NativeSelect id="onboarding-role" value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
          <option value="member">Member: works on tasks in the team</option>
          <option value="stakeholder">Stakeholder: submits requests</option>
          <option value="admin">Admin: manages the organisation</option>
        </NativeSelect>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-10 flex-1" disabled={pending || emails.trim() === ""}>
          {pending ? "Sending…" : "Send invitations"}
        </Button>
        <Button asChild variant="ghost" className="h-10">
          <Link href="/onboarding?step=done">Skip for now</Link>
        </Button>
      </div>
    </form>
  );
}
