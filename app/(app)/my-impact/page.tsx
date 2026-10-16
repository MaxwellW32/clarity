import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ExportButtons, ReportControls } from "@/components/reports/report-controls";
import { ContributionsView } from "@/components/reports/report-views";
import { buildReport, canViewReports, resolveReport } from "@/lib/reports/access";
import { reportMarkdown } from "@/lib/reports/render";
import { dayKey, formatDay } from "@/lib/time";
import { requireViewerContext } from "@/lib/viewer";

export const metadata: Metadata = { title: "My Impact" };

/** "What did I accomplish, and why did it matter?" The contributions report for yourself, ready to share. */
export default async function MyImpactPage(props: PageProps<"/my-impact">) {
  const { viewer, org } = await requireViewerContext();
  if (!canViewReports(viewer)) redirect("/overview");
  const today = dayKey(new Date(), viewer.timezone);
  const { params, teams, person } = await resolveReport(viewer, await props.searchParams, today, { type: "contributions", person: viewer.userId });
  const report = await buildReport(viewer, params, person, null, today);
  if (report.kind !== "contributions") redirect("/reports");
  const markdown = reportMarkdown(report, org.name, viewer.timezone, today);

  return (
    <div className="print:text-black">
      <PageHeader
        title="My Impact"
        description="What you accomplished and why it mattered, from your own task records. Pick a period, then copy or print it for a one-on-one or a review."
        action={<ExportButtons params={params} markdown={markdown} />}
      />
      <ReportControls base="/my-impact" params={params} teams={teams.map(({ id, name }) => ({ id, name }))} people={[]} showType={false} />
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
        <h2 className="text-base font-semibold">{person.name ?? person.email}</h2>
        <p className="text-sm text-muted-foreground">
          {formatDay(params.range.from, today)} – {formatDay(params.range.to, today)}
        </p>
      </div>
      <ContributionsView report={report} timeZone={viewer.timezone} today={today} />
    </div>
  );
}
