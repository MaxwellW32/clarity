"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { NativeSelect } from "@/components/native-select";
import { Segmented } from "@/components/segmented";
import { cn } from "cn";
import { PERIODS, teamHref, type Period } from "@/lib/team/period";

/** Which team, and how far back "completed" looks. Both live in the URL. */
export function TeamToolbar({ teams, teamId, days }: { teams: { id: string; name: string }[]; teamId: string; days: Period }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (nextTeam: string, nextDays: Period) => startTransition(() => router.replace(teamHref(nextTeam, nextDays), { scroll: false }));
  return (
    <div className={cn("mb-5 flex flex-wrap items-center gap-3 transition-opacity", pending && "opacity-70")}>
      {teams.length > 1 ? (
        <NativeSelect aria-label="Team" className="w-48" value={teamId} onChange={(event) => go(event.target.value, days)}>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      <Segmented
        label="Period"
        value={String(days) as `${Period}`}
        onChange={(value) => go(teamId, Number(value) as Period)}
        options={PERIODS.map((period) => ({ value: String(period) as `${Period}`, label: `${period} days` }))}
      />
    </div>
  );
}
