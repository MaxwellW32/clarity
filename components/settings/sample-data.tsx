"use client";

import { Sparkles, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { loadSampleData, removeSampleData } from "@/actions/demo";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toastResult } from "@/lib/toast-result";

/** Load or remove the labelled sample work. Admin only; the server checks. */
export function SampleDataControls({ loaded, compact = false }: { loaded: boolean; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  if (loaded) {
    return (
      <ConfirmDialog
        title="Remove the sample data?"
        description="Every task, request, goal and outcome whose title starts with “Sample ·” is deleted, with its history. Real work is untouched."
        confirmLabel="Remove sample data"
        onConfirm={() => startTransition(async () => void toastResult(await removeSampleData()))}
        trigger={
          <Button variant="outline" size={compact ? "sm" : "default"} disabled={pending}>
            <Trash2 aria-hidden />
            Remove sample data
          </Button>
        }
      />
    );
  }
  return (
    <Button variant="outline" size={compact ? "sm" : "default"} disabled={pending} onClick={() => startTransition(async () => void toastResult(await loadSampleData({})))}>
      <Sparkles aria-hidden />
      {pending ? "Loading…" : "Load sample data"}
    </Button>
  );
}
