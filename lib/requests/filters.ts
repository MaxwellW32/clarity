import { REQUEST_VIEWS, type RequestFilters, type RequestView } from "./types";

type Raw = Record<string, string | string[] | undefined>;

const one = (raw: Raw, key: string): string => {
  const value = raw[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
};

export const DEFAULT_REQUEST_FILTERS: RequestFilters = { view: "open", team: "", mine: false };

export function parseRequestFilters(raw: Raw): RequestFilters {
  const view = one(raw, "view");
  const team = one(raw, "team");
  return {
    view: (REQUEST_VIEWS as readonly string[]).includes(view) ? (view as RequestView) : "open",
    team: /^[\w-]{1,64}$/.test(team) ? team : "",
    mine: one(raw, "mine") === "1",
  };
}

export function requestsHref(filters: Partial<RequestFilters>): string {
  const full = { ...DEFAULT_REQUEST_FILTERS, ...filters };
  const params = new URLSearchParams();
  if (full.view !== "open") params.set("view", full.view);
  if (full.team) params.set("team", full.team);
  if (full.mine) params.set("mine", "1");
  const query = params.toString();
  return query ? `/requests?${query}` : "/requests";
}
