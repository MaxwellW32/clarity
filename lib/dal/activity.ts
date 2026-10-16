import "server-only";
import type { Tx } from "@/db";
import { taskActivity } from "@/db/schema";
import type { ActivityDraft } from "@/lib/tasks/transitions";

/** Appends audit rows for one task inside the caller's transaction. History is never rewritten. */
export async function recordActivity(
  tx: Tx,
  scope: { orgId: string; taskId: string; actorId: string },
  drafts: ActivityDraft[],
  at: Date = new Date(),
): Promise<void> {
  if (drafts.length === 0) return;
  await tx.insert(taskActivity).values(
    drafts.map((draft) => ({
      orgId: scope.orgId,
      taskId: scope.taskId,
      actorId: scope.actorId,
      kind: draft.kind,
      before: draft.before ?? null,
      after: draft.after ?? null,
      note: draft.note ?? null,
      createdAt: at,
    })),
  );
}
