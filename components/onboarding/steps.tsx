"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { inviteMembers } from "@/actions/invitations";
import { createOrganization } from "@/actions/org";
import { createTeam } from "@/actions/teams";
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

export function OrgStep({ zones, firstOrg }: { zones: string[]; firstOrg: boolean }) {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await createOrganization({ name, timezone });
          if (result && !result.ok) setErrors(result.fieldErrors ?? { name: [result.error] });
        });
      }}
    >
      <Heading
        title={firstOrg ? "Create your organization" : "Create another organization"}
        text="Usually your company or department. You can invite people in a moment."
      />
      <Field id="org-name" label="Organization name" error={errors.name?.[0]}>
        <Input
          id="org-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Acme Inc."
          maxLength={80}
          autoFocus
          aria-invalid={errors.name ? true : undefined}
        />
      </Field>
      <Field id="org-timezone" label="Timezone" hint="Used for due dates and reports." error={errors.timezone?.[0]}>
        <NativeSelect id="org-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Button type="submit" className="h-10" disabled={pending || name.trim().length < 2}>
        {pending ? "Creating…" : "Continue"}
      </Button>
    </form>
  );
}

export function TeamStep() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [lead, setLead] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await createTeam({ name, lead });
          if (result.ok) router.push("/onboarding?step=invite");
          else setError(result.fieldErrors?.name?.[0] ?? result.error);
        });
      }}
    >
      <Heading title="Create your first team" text="Work belongs to a team. Leads see its health and approve its work." />
      <Field id="team-name" label="Team name" error={error}>
        <Input
          id="team-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Engineering"
          maxLength={60}
          autoFocus
          aria-invalid={error ? true : undefined}
        />
      </Field>
      <div className="flex items-center gap-2.5">
        <Checkbox id="team-lead" checked={lead} onCheckedChange={(value) => setLead(value === true)} />
        <Label htmlFor="team-lead" className="font-normal">
          I lead this team
        </Label>
      </div>
      <Button type="submit" className="h-10" disabled={pending || name.trim().length < 2}>
        {pending ? "Creating…" : "Continue"}
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
          <option value="admin">Admin: manages the organization</option>
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
