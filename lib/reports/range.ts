import { calendarDaysBetween } from "@/lib/time";

// Report date ranges are calendar days ("YYYY-MM-DD", inclusive) in the viewer's timezone.

export const RANGE_PRESETS = ["this-month", "last-month", "last-30", "this-quarter", "last-quarter", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type ReportRange = { preset: RangePreset; from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function rangeFor(preset: RangePreset, today: string, custom?: { from?: string; to?: string }): ReportRange {
  const [year, month] = today.split("-").map(Number);
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
  switch (preset) {
    case "this-month":
      return { preset, from: iso(year, month, 1), to: today };
    case "last-month": {
      const y = month === 1 ? year - 1 : year;
      const m = month === 1 ? 12 : month - 1;
      return { preset, from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)) };
    }
    case "last-30":
      return { preset, from: shiftDays(today, -29), to: today };
    case "this-quarter":
      return { preset, from: iso(year, quarterStartMonth, 1), to: today };
    case "last-quarter": {
      const startMonth = quarterStartMonth - 3;
      const y = startMonth < 1 ? year - 1 : year;
      const m = startMonth < 1 ? startMonth + 12 : startMonth;
      return { preset, from: iso(y, m, 1), to: iso(y, m + 2, lastDay(y, m + 2)) };
    }
    case "custom": {
      const from = custom?.from && /^\d{4}-\d{2}-\d{2}$/.test(custom.from) ? custom.from : shiftDays(today, -29);
      const to = custom?.to && /^\d{4}-\d{2}-\d{2}$/.test(custom.to) ? custom.to : today;
      return from <= to ? { preset, from, to } : { preset, from: to, to: from };
    }
  }
}

export function parseRange(raw: Record<string, string | string[] | undefined>, today: string): ReportRange {
  const one = (key: string) => {
    const value = raw[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  const preset = one("range");
  const chosen = (RANGE_PRESETS as readonly string[]).includes(preset) ? (preset as RangePreset) : "this-month";
  return rangeFor(chosen, today, { from: one("from"), to: one("to") });
}

export const RANGE_LABELS: Record<RangePreset, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "last-30": "Last 30 days",
  "this-quarter": "This quarter",
  "last-quarter": "Last quarter",
  custom: "Custom",
};

export function rangeDays(range: ReportRange): number {
  return calendarDaysBetween(range.from, range.to) + 1;
}
