import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { InviteStep, OrgStep, TeamStep } from "@/components/onboarding/steps";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listTeams } from "@/lib/dal/orgs";
import { canManageOrg } from "@/lib/permissions";
import { timeZoneOptions } from "@/lib/time";
import { getViewer, requireUser } from "@/lib/viewer";

export const metadata: Metadata = { title: "Set up" };

const STEPS = ["Organization", "Team", "Invite"] as const;

function Progress({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2 text-xs" aria-label="Setup progress">
      {STEPS.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <span
            aria-current={index === current ? "step" : undefined}
            className={
              index <= current
                ? "grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
                : "grid size-5 place-items-center rounded-full border text-[10px] text-muted-foreground"
            }
          >
            {index + 1}
          </span>
          <span className={index === current ? "font-medium" : "text-muted-foreground"}>{label}</span>
          {index < STEPS.length - 1 ? <span className="h-px w-6 bg-border" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

async function Onboarding({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const query = await searchParams;
  const user = await requireUser();
  const viewer = await getViewer();
  const step = typeof query.step === "string" ? query.step : "org";
  const creatingAnother = query.new === "1";

  if (step === "org") {
    if (viewer !== null && !creatingAnother) redirect("/overview");
    return (
      <>
        <Progress current={0} />
        <OrgStep zones={timeZoneOptions()} firstOrg={viewer === null} />
      </>
    );
  }

  if (viewer === null) redirect("/onboarding");
  if (!canManageOrg(viewer)) redirect("/overview");

  if (step === "team") {
    return (
      <>
        <Progress current={1} />
        <TeamStep />
      </>
    );
  }

  if (step === "invite") {
    const teams = await listTeams(viewer);
    return (
      <>
        <Progress current={2} />
        <InviteStep teamId={teams[0]?.id ?? null} teamName={teams[0]?.name ?? null} />
      </>
    );
  }

  return (
    <div>
      <div className="mb-5 grid size-11 place-items-center rounded-full bg-status-completed-bg">
        <CheckCircle2 className="size-5 text-status-completed-fg" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold">You&apos;re set up{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your organization and team are ready. Invitations and teams can be changed any time under Settings → Organization.
      </p>
      <Button asChild className="mt-8">
        <Link href="/overview">Go to Overview</Link>
      </Button>
    </div>
  );
}

export default function OnboardingPage(props: PageProps<"/onboarding">) {
  return (
    <AuthShell wide>
      <Suspense
        fallback={
          <div className="grid gap-4">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        }
      >
        <Onboarding searchParams={props.searchParams} />
      </Suspense>
    </AuthShell>
  );
}
