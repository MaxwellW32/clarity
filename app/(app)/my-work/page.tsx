import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { canSeeTeamPages } from "@/lib/permissions";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "My Work" };

export default async function MyWorkPage() {
  const viewer = await requireViewer();
  if (!canSeeTeamPages(viewer)) redirect("/overview");
  return (
    <>
      <PageHeader title="My Work" description="Where you stopped, and what's next." />
      <EmptyState
        icon={ListChecks}
        title="Your work list is coming in the next step"
        description="Once tasks arrive, this page groups yours into Continue working, Waiting on others, Needs attention and Recently finished."
      />
    </>
  );
}
