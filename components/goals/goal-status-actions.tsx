"use client";

import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useTransition } from "react";
import { setGoalStatus } from "@/actions/goals";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { GoalStatus } from "@/lib/constants";
import { toastResult } from "@/lib/toast-result";

export function GoalStatusActions({ goalId, status }: { goalId: string; status: GoalStatus }) {
  const [pending, startTransition] = useTransition();
  const change = (next: GoalStatus) => startTransition(async () => void toastResult(await setGoalStatus({ goalId, status: next })));
  if (status !== "active") {
    return (
      <Button variant="outline" size="sm" disabled={pending} onClick={() => change("active")}>
        <RotateCcw aria-hidden />
        Reactivate
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={pending} onClick={() => change("achieved")}>
        <CheckCircle2 aria-hidden />
        Mark achieved
      </Button>
      <ConfirmDialog
        title="Drop this goal?"
        description="It stays in the list as dropped, and its linked work keeps the link. You can reactivate it later."
        confirmLabel="Drop goal"
        onConfirm={() => change("dropped")}
        trigger={
          <Button variant="outline" size="sm" className="text-muted-foreground" disabled={pending}>
            <XCircle aria-hidden />
            Drop
          </Button>
        }
      />
    </div>
  );
}
