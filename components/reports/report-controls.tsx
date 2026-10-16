"use client";

import { cn } from "cn";
import { Copy, Download, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reportHref, REPORT_LABELS, REPORT_TYPES, type ReportParams, type ReportType } from "@/lib/reports/params";
import { RANGE_LABELS, RANGE_PRESETS, type RangePreset } from "@/lib/reports/range";

/** Report type, team, person and period. Every change is a URL change so a report can be shared as a link. */
export function ReportControls({
  base,
  params,
  teams,
  people,
  showType = true,
}: {
  base: "/reports" | "/my-impact";
  params: ReportParams;
  teams: { id: string; name: string }[];
  /** People the viewer may report on; empty hides the picker. */
  people: { id: string; name: string | null; email: string | null }[];
  showType?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(params.range.from);
  const [to, setTo] = useState(params.range.to);
  const go = (patch: Partial<ReportParams>) => startTransition(() => router.replace(reportHref(base, { ...params, ...patch }), { scroll: false }));

  return (
    <div className={cn("mb-6 grid gap-3 print:hidden", pending && "opacity-70")}>
      {showType ? (
        <div className="inline-flex w-fit rounded-md border bg-background p-0.5" role="tablist" aria-label="Report">
          {REPORT_TYPES.map((type: ReportType) => {
            const active = type === params.type;
            return (
              <Link
                key={type}
                role="tab"
                aria-selected={active}
                href={reportHref(base, { ...params, type })}
                replace
                scroll={false}
                className={cn(
                  "h-7 rounded-[5px] px-2.5 text-xs leading-7 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {REPORT_LABELS[type]}
              </Link>
            );
          })}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {params.type !== "contributions" && teams.length > 1 ? (
          <NativeSelect aria-label="Team" className="w-44" value={params.team} onChange={(event) => go({ team: event.target.value })}>
            <option value="">All teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        {params.type === "contributions" && people.length > 0 ? (
          <NativeSelect aria-label="Person" className="w-48" value={params.person} onChange={(event) => go({ person: event.target.value })}>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name ?? person.email}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        <NativeSelect aria-label="Period" className="w-40" value={params.range.preset} onChange={(event) => go({ range: { ...params.range, preset: event.target.value as RangePreset } })}>
          {RANGE_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {RANGE_LABELS[preset]}
            </option>
          ))}
        </NativeSelect>
        {params.range.preset === "custom" ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              go({ range: { preset: "custom", from, to } });
            }}
          >
            <Input type="date" aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} className="w-36" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} className="w-36" />
            <Button type="submit" variant="outline" size="sm">
              Apply
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

/** Export as Markdown or CSV (server-rendered files), copy the Markdown, or print. */
export function ExportButtons({ params, markdown }: { params: ReportParams; markdown: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(markdown);
          toast.success("Summary copied as Markdown.");
        }}
      >
        <Copy aria-hidden />
        Copy summary
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={reportHref("/reports/export", { ...params, format: "md" })} download>
          <Download aria-hidden />
          Markdown
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={reportHref("/reports/export", { ...params, format: "csv" })} download>
          <Download aria-hidden />
          CSV
        </a>
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer aria-hidden />
        Print
      </Button>
    </div>
  );
}
