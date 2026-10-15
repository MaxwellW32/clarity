import { Search } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { canSeeTeamPages } from "@/lib/permissions";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const viewer = await requireViewer();
  if (!canSeeTeamPages(viewer)) redirect("/overview");
  return (
    <>
      <PageHeader title="Tasks" description="Every task in the organization, searchable and filterable." />
      <EmptyState
        icon={Search}
        title="Tasks are coming in the next step"
        description="Search, filters and sorting arrive with task tracking."
      />
    </>
  );
}
