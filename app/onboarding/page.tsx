import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { InviteStep, OrgStep, TeamStep } from "@/components/onboarding/steps";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSetupState } from "@/lib/dal/orgs";
import { canManageOrg } from "@/lib/permissions";
import { timeZoneOptions } from "@/lib/time";
import { getViewerContext, requireUser } from "@/lib/viewer";

export const metadata: Metadata = { title: "Set up" };

const STEPS = ["Organisation", "Team", "Invite"] as const;
type Step = "org" | "team" | "invite" | "done";

function Progress({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-2 text-xs" aria-label="Setup progress">
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

function Back({ to }: { to: string }) {
  return (
    <Link
      href={to}
      className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back
    </Link>
  );
}

/**
 * The step comes from what exists, never from client state: no org → organisation; no team → team; nobody
 * else yet → invite (skippable); otherwise done. `?step=` only goes back to a step whose prerequisites exist.
 */
async function Onboarding({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const query = await searchParams;
  const user = await requireUser();
  const context = await getViewerContext();

  if (context === null || query.new === "1") {
    return (
      <>
        {context === null ? <Progress current={0} /> : <Back to="/overview" />}
        <OrgStep zones={timeZoneOptions()} mode={context === null ? "first" : "another"} />
      </>
    );
  }
  if (!canManageOrg(context.viewer)) redirect("/overview");

  const setup = await getSetupState(context.org.orgId, user.id);
  const hasTeam = setup.firstTeamId !== null;
  const derived: Step = !hasTeam ? "team" : setup.otherMembers === 0 && setup.pendingInvitations === 0 ? "invite" : "done";
  const asked = typeof query.step === "string" ? query.step : null;
  const step: Step = asked === "org" || ((asked === "team" || asked === "invite" || asked === "done") && hasTeam) ? (asked as Step) : derived;

  if (step === "org") {
    return (
      <>
        <Progress current={0} />
        <OrgStep zones={timeZoneOptions()} mode="rename" currentName={context.org.name} />
      </>
    );
  }
  if (step === "team") {
    return (
      <>
        <Back to="/onboarding?step=org" />
        <Progress current={1} />
        <TeamStep team={setup.firstTeamId !== null ? { id: setup.firstTeamId, name: setup.firstTeamName ?? "" } : null} />
      </>
    );
  }
  if (step === "invite") {
    return (
      <>
        <Back to="/onboarding?step=team" />
        <Progress current={2} />
        <InviteStep teamId={setup.firstTeamId} teamName={setup.firstTeamName} />
      </>
    );
  }
  return (
    <div>
      <Back to="/onboarding?step=invite" />
      <div className="mb-5 grid size-11 place-items-center rounded-full bg-status-completed-bg">
        <CheckCircle2 className="size-5 text-status-completed-fg" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold">
        You&apos;re set up{user.name ? `, ${user.name.split(" ")[0]}` : ""}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {context.org.name} and {setup.firstTeamName ?? "your team"} are ready. You can change members and teams any time under
        Settings → Organization.
      </p>
      <Button asChild className="mt-8 h-10">
        <Link href="/overview">Go to overview</Link>
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
