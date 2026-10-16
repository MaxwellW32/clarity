"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitRequest } from "@/actions/requests";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_URGENCIES, REQUEST_URGENCY_LABELS, type RequestUrgency } from "@/lib/constants";

/** The intake form. Quick on purpose: a title and a team is enough; the business reason is what triage reads. */
export function NewRequestDialog({ teams, variant = "default" }: { teams: { id: string; name: string }[]; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [urgency, setUrgency] = useState<RequestUrgency>("normal");
  const [link, setLink] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setTitle("");
    setDescription("");
    setDesiredOutcome("");
    setUrgency("normal");
    setLink("");
    setErrors({});
  };

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={teams.length === 0}>
        <Plus aria-hidden />
        New request
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New request</DialogTitle>
            <DialogDescription>It goes to the team&apos;s review queue. Nothing is committed until they decide.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await submitRequest({ title, teamId, description, desiredOutcome, urgency, link: link.trim() });
                if (!result.ok) {
                  setErrors(result.fieldErrors ?? { title: [result.error] });
                  return;
                }
                const id = result.data.id;
                toast.success("Request submitted.", { action: { label: "Open", onClick: () => router.push(`/requests/${id}`) } });
                setOpen(false);
                reset();
              });
            }}
          >
            <Field id="request-title" label="What do you need?" error={errors.title?.[0]}>
              <Input id="request-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Export invoices as CSV for finance" maxLength={200} autoFocus aria-invalid={errors.title ? true : undefined} />
            </Field>
            {teams.length > 1 ? (
              <Field id="request-team" label="Team">
                <NativeSelect id="request-team" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            <Field id="request-outcome" label="Why does it matter?" hint="The business reason, and what should be true once it's done." error={errors.desiredOutcome?.[0]}>
              <Textarea id="request-outcome" value={desiredOutcome} onChange={(event) => setDesiredOutcome(event.target.value)} rows={2} placeholder="e.g. Month-end close takes two days of copying by hand." />
            </Field>
            <Field id="request-description" label="Details" hint="Optional.">
              <Textarea id="request-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </Field>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Suggested urgency</span>
              <Segmented label="Suggested urgency" value={urgency} onChange={setUrgency} options={REQUEST_URGENCIES.map((value) => ({ value, label: REQUEST_URGENCY_LABELS[value] }))} />
            </div>
            <Field id="request-link" label="Supporting link" hint="Optional." error={errors.link?.[0]}>
              <Input id="request-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://…" inputMode="url" aria-invalid={errors.link ? true : undefined} />
            </Field>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || title.trim() === "" || teamId === ""}>
                {pending ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
