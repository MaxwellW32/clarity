import { Users } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { canSeeTeamPages } from "@/lib/permissions";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const viewer = await requireViewer();
  if (!canSeeTeamPages(viewer)) redirect("/overview");
  return (
    <>
      <PageHeader title="Team" description="Operational health at a glance." />
      <EmptyState
        icon={Users}
        title="The team dashboard is coming in a later step"
        description="Counts, attention items, workload and recent decisions will appear here once tasks and requests exist."
      />
    </>
  );
}
