import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { NewTaskPageForm } from "@/components/tasks/new-task-page-form";
import { canSeeTeamPages } from "@/lib/permissions";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "New task" };

/** The same form as the N dialog, for links and bookmarks. */
export default async function NewTaskPage() {
  const viewer = await requireViewer();
  if (!canSeeTeamPages(viewer)) redirect("/overview");
  return (
    <div className="max-w-xl">
      <PageHeader title="New task" />
      <div className="rounded-lg border bg-card p-5">
        <NewTaskPageForm />
      </div>
    </div>
  );
}
