import { NextResponse, type NextRequest } from "next/server";
import { buildReport, canViewReports, resolveReport } from "@/lib/reports/access";
import { reportCsv, reportMarkdown } from "@/lib/reports/render";
import { dayKey } from "@/lib/time";
import { getViewerContext } from "@/lib/viewer";

/** The same report as the page, as a downloadable Markdown or CSV file. Same permissions, same data. */
export async function GET(request: NextRequest) {
  const context = await getViewerContext();
  if (context === null) return new NextResponse("Sign in to export a report.", { status: 401 });
  const { viewer, org } = context;
  if (!canViewReports(viewer)) return new NextResponse("Not allowed.", { status: 403 });
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const today = dayKey(new Date(), viewer.timezone);
  const { params, person, teamName } = await resolveReport(viewer, raw, today);
  const report = await buildReport(viewer, params, person, teamName, today);
  const format = raw.format === "csv" ? "csv" : "md";
  const stem = `clarity-${params.type}-${params.range.from}-to-${params.range.to}`;
  if (format === "csv") {
    return new NextResponse(reportCsv(report, viewer.timezone), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${stem}.csv"`, "cache-control": "no-store" },
    });
  }
  return new NextResponse(reportMarkdown(report, org.name, viewer.timezone, today), {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${stem}.md"`, "cache-control": "no-store" },
  });
}
