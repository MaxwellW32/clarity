import type { ReportRange } from "./range";

export const REPORT_TYPES = ["team", "contributions", "stakeholder"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABELS: Record<ReportType, string> = {
  team: "Team summary",
  contributions: "Contributions",
  stakeholder: "Stakeholder update",
};

export type ReportParams = { type: ReportType; team: string; person: string; range: ReportRange };

/** The URL for a report (the page and its exports share it). */
export function reportHref(base: "/reports" | "/reports/export" | "/my-impact", params: Partial<ReportParams> & { format?: "md" | "csv" }): string {
  const query = new URLSearchParams();
  if (params.type && params.type !== "team" && base !== "/my-impact") query.set("type", params.type);
  if (params.team) query.set("team", params.team);
  if (params.person) query.set("person", params.person);
  if (params.range) {
    if (params.range.preset !== "this-month") query.set("range", params.range.preset);
    if (params.range.preset === "custom") {
      query.set("from", params.range.from);
      query.set("to", params.range.to);
    }
  }
  if (params.format) query.set("format", params.format);
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}
