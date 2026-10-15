"use client";

import { useTransition } from "react";
import { acceptInvitation } from "@/actions/invitations";
import { Button } from "@/components/ui/button";
import { toastResult } from "@/lib/toast-result";

export function AcceptInvitationButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="h-10 w-full"
      disabled={pending}
      onClick={() => startTransition(async () => void toastResult(await acceptInvitation({ token })))}
    >
      {pending ? "Joining…" : "Accept invitation"}
    </Button>
  );
}
