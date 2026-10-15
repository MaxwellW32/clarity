import { ArrowRight, Gauge, Inbox, RotateCcw } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/viewer";

const POINTS = [
  {
    icon: RotateCcw,
    title: "Resume where you stopped",
    text: "Every task leads with its next action and latest progress, so picking work back up takes seconds.",
  },
  {
    icon: Gauge,
    title: "Team health in a minute",
    text: "Blockers, approvals and overdue work surface on their own. No status meetings to find out.",
  },
  {
    icon: Inbox,
    title: "Requests get a decision",
    text: "Asks are triaged, decided with a reason, and linked to the work that delivers them.",
  },
];

/** Signed-in visitors go straight to their overview. */
async function SignedInRedirect() {
  if ((await getSessionUser()) !== null) redirect("/overview");
  return null;
}

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={null}>
        <SignedInRedirect />
      </Suspense>
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        <section className="pt-16 pb-14 sm:pt-28 sm:pb-20">
          <h1 className="max-w-2xl text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            Less time managing work. More time doing it.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Clarity keeps a small team&apos;s work, progress and decisions in one calm place, with clear evidence of what
            matters.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Get started
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>

        <section aria-label="What Clarity does" className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-card p-6">
              <Icon className="size-5 text-muted-foreground" aria-hidden />
              <h2 className="mt-4 text-sm font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-10 text-xs text-muted-foreground sm:px-6">
        No time tracking, no screenshots, no productivity scores. Just the work.
      </footer>
    </div>
  );
}
