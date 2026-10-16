// Shared by the server page and the client toolbar: a client component file can't export plain values to the server.
export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export function parsePeriod(raw: string | string[] | undefined): Period {
  const value = Number(typeof raw === "string" ? raw : 30);
  return (PERIODS as readonly number[]).includes(value) ? (value as Period) : 30;
}

export function teamHref(teamId: string, days: Period): string {
  const params = new URLSearchParams();
  if (teamId) params.set("team", teamId);
  if (days !== 30) params.set("days", String(days));
  const query = params.toString();
  return query ? `/team?${query}` : "/team";
}
