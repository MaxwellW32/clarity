"use client";

import { useState, useTransition } from "react";
import { savePreferences } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Preferences } from "@/lib/dal/notifications";
import { toastResult } from "@/lib/toast-result";

const OPTIONS: { key: keyof Preferences; label: string; hint: string }[] = [
  { key: "emailAssignment", label: "A task is assigned to me", hint: "When someone creates a task for you or reassigns one to you." },
  { key: "emailHandover", label: "Work is handed over to me", hint: "When a teammate passes a task on with their notes." },
  { key: "emailApproval", label: "Approvals", hint: "When you're asked to approve a task, and when your own task is approved or sent back." },
  { key: "emailBlocked", label: "A task on my team is blocked", hint: "Leads only: when a task in a team you lead is marked blocked." },
  { key: "emailRequestDecision", label: "A decision on my request", hint: "When a request you submitted is approved, deferred, rejected or turned into a task." },
];

/** Which events also send an email. Everything still shows in the in-app list. */
export function NotificationPreferencesForm({ initial, email }: { initial: Preferences; email: string }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = OPTIONS.some(({ key }) => values[key] !== initial[key]);
  return (
    <form
      className="rounded-lg border bg-card"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => void toastResult(await savePreferences(values)));
      }}
    >
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold">Email notifications</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Sent to {email}. Everything also appears in your notifications list, whatever you choose here.</p>
      </div>
      <div className="divide-y px-5">
        {OPTIONS.map(({ key, label, hint }) => (
          <div key={key} className="flex items-start justify-between gap-4 py-3">
            <div>
              <Label htmlFor={`pref-${key}`} className="font-medium">
                {label}
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            </div>
            <Switch id={`pref-${key}`} checked={values[key]} onCheckedChange={(checked) => setValues((current) => ({ ...current, [key]: checked }))} />
          </div>
        ))}
      </div>
      <div className="flex justify-end border-t px-5 py-3">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </form>
  );
}
