"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/actions/profile";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastResult } from "@/lib/toast-result";

export function ProfileForm(props: {
  name: string;
  email: string;
  timezone: string;
  orgTimezone: string;
  orgName: string;
  zones: string[];
}) {
  const [name, setName] = useState(props.name);
  const [timezone, setTimezone] = useState(props.timezone);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const dirty = name !== props.name || timezone !== props.timezone;

  return (
    <form
      className="rounded-lg border bg-card"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await updateProfile({ name, timezone });
          setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
          toastResult(result);
        });
      }}
    >
      <div className="border-b px-5 py-4">
        <h2 className="text-sm font-medium">Profile</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">How you appear to your teammates.</p>
      </div>
      <div className="grid gap-5 px-5 py-5">
        <Field id="profile-email" label="Email" hint="You sign in with this address.">
          <Input id="profile-email" value={props.email} disabled readOnly />
        </Field>
        <Field id="profile-name" label="Name" error={errors.name?.[0]}>
          <Input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={80}
            aria-invalid={errors.name ? true : undefined}
          />
        </Field>
        <Field
          id="profile-timezone"
          label="Timezone"
          hint="Dates and times are shown in this timezone."
          error={errors.timezone?.[0]}
        >
          <NativeSelect id="profile-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            <option value="">
              {props.orgName} default ({props.orgTimezone.replaceAll("_", " ")})
            </option>
            {props.zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="flex justify-end border-t px-5 py-3">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
