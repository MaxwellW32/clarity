import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <AuthShell>
      <div className="mb-5 grid size-11 place-items-center rounded-full bg-muted">
        <MailCheck className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent you a sign-in link. It works once and expires in 24 hours. You can close this tab.
      </p>
      {process.env.NODE_ENV !== "production" ? (
        <p className="mt-4 rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          Developing locally: <code className="font-mono">.test</code> addresses never receive mail. The link is printed in
          the dev server log.
        </p>
      ) : null}
      <Button asChild variant="outline" className="mt-8">
        <Link href="/login">Use a different email</Link>
      </Button>
    </AuthShell>
  );
}
