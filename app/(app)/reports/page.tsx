import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ExportButtons, ReportControls } from "@/components/reports/report-controls";
import { ContributionsView, StakeholderView, TeamSummaryView } from "@/components/reports/report-views";
import { buildReport, canViewReports, resolveReport } from "@/lib/reports/access";
import { REPORT_LABELS } from "@/lib/reports/params";
import { reportMarkdown } from "@/lib/reports/render";
import { isManager } from "@/lib/permissions";
import { dayKey, formatDay } from "@/lib/time";
import { requireViewerContext } from "@/lib/viewer";

export const metadata: Metadata = { title: "Reports" };

const BLURBS = {
  team: "What was planned, delivered, left open or blocked, which decisions are outstanding, and which goals moved.",
  contributions: "A factual record of one person's completed work and the impact they documented. Not a comparison.",
  stakeholder: "A plain update for people outside the team: outcomes, work in progress, blockers, pending requests, what's next.",
} as const;

/** Reports are built from stored records on every load; the exports are the same data as text. */
export default async function ReportsPage(props: PageProps<"/reports">) {
  const { viewer, org } = await requireViewerContext();
  if (!canViewReports(viewer)) redirect("/overview");
  const today = dayKey(new Date(), viewer.timezone);
  const { params, teams, people, person, teamName } = await resolveReport(viewer, await props.searchParams, today);
  const report = await buildReport(viewer, params, person, teamName, today);
  const markdown = reportMarkdown(report, org.name, viewer.timezone, today);
  const scopeLabel = params.type === "contributions" ? (person.name ?? person.email ?? "You") : (teamName ?? org.name);

  return (
    <div className="print:text-black">
      <PageHeader title="Reports" description={BLURBS[params.type]} action={<ExportButtons params={params} markdown={markdown} />} />
      <ReportControls base="/reports" params={params} teams={teams.map(({ id, name }) => ({ id, name }))} people={isManager(viewer) ? people : []} />
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
        <h2 className="text-base font-semibold">
          {REPORT_LABELS[params.type]} · {scopeLabel}
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatDay(params.range.from, today)} – {formatDay(params.range.to, today)} · generated {formatDay(today, today)}
        </p>
      </div>
      {report.kind === "team" ? (
        <TeamSummaryView report={report} timeZone={viewer.timezone} today={today} />
      ) : report.kind === "contributions" ? (
        <ContributionsView report={report} timeZone={viewer.timezone} today={today} />
      ) : (
        <StakeholderView report={report} timeZone={viewer.timezone} today={today} />
      )}
    </div>
  );
}
