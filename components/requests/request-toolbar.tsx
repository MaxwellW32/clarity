"use client";

import { cn } from "cn";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { requestsHref } from "@/lib/requests/filters";
import type { RequestFilters, RequestView } from "@/lib/requests/types";

const VIEWS: { value: RequestView; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "deferred", label: "Deferred" },
  { value: "decided", label: "Decided" },
  { value: "all", label: "All" },
];

/** View pills, a team picker when there is more than one team, and "Only mine". All of it lives in the URL. */
export function RequestToolbar({
  filters,
  teams,
  showMine,
}: {
  filters: RequestFilters;
  teams: { id: string; name: string }[];
  showMine: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const apply = (patch: Partial<RequestFilters>) => startTransition(() => router.replace(requestsHref({ ...filters, ...patch }), { scroll: false }));

  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-3 transition-opacity", pending && "opacity-70")}>
      <div className="inline-flex rounded-md border bg-background p-0.5" role="tablist" aria-label="View">
        {VIEWS.map((view) => {
          const active = view.value === filters.view;
          return (
            <Link
              key={view.value}
              role="tab"
              aria-selected={active}
              href={requestsHref({ ...filters, view: view.value })}
              replace
              scroll={false}
              className={cn(
                "h-7 rounded-[5px] px-2.5 text-xs leading-7 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {view.label}
            </Link>
          );
        })}
      </div>
      {teams.length > 1 ? (
        <NativeSelect aria-label="Team" className="w-40" value={filters.team} onChange={(event) => apply({ team: event.target.value })}>
          <option value="">All teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      {showMine ? (
        <div className="flex items-center gap-2 px-1">
          <Switch id="requests-mine" checked={filters.mine} onCheckedChange={(mine) => apply({ mine })} />
          <Label htmlFor="requests-mine" className="text-xs font-normal text-muted-foreground">
            Only mine
          </Label>
        </div>
      ) : null}
    </div>
  );
}
