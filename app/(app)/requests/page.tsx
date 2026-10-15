import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { isStakeholder } from "@/lib/permissions";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Requests" };

export default async function RequestsPage() {
  const viewer = await requireViewer();
  return (
    <>
      <PageHeader
        title="Requests"
        description={isStakeholder(viewer) ? "What you've asked for, and what was decided." : "Incoming work, triaged weekly."}
      />
      <EmptyState
        icon={Inbox}
        title="Requests are coming in a later step"
        description="Submitting a request, triage and the weekly review queue will live here."
      />
    </>
  );
}
