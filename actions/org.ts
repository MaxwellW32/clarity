"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { organizationMembers, organizations } from "@/db/schema";
import { fail, GuardError, ok, runAction, type ActionResult } from "@/lib/action-result";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { findMembership, uniqueSlug } from "@/lib/dal/orgs";
import { log } from "@/lib/log";
import { setActiveOrgCookie } from "@/lib/org-cookie";
import { isValidTimeZone } from "@/lib/time";
import { requireUser } from "@/lib/viewer";

const createSchema = z.object({
  name: z.string().trim().min(2, "Give the organization a name (2 characters or more).").max(80),
  timezone: z
    .string()
    .trim()
    .default(DEFAULT_TIMEZONE)
    .refine(isValidTimeZone, "Pick a timezone from the list."),
});

/** Onboarding step 1 (and "New organization"): the creator becomes its first admin. */
export async function createOrganization(input: z.input<typeof createSchema>): Promise<ActionResult<{ orgId: string }>> {
  const result = await runAction("org.create", createSchema, input, async (data) => {
    const user = await requireUser();
    const orgId = await db.transaction(async (tx) => {
      const slug = await uniqueSlug(tx, data.name);
      const [org] = await tx
        .insert(organizations)
        .values({ name: data.name, slug, timezone: data.timezone, createdBy: user.id })
        .returning({ id: organizations.id });
      await tx.insert(organizationMembers).values({ orgId: org.id, userId: user.id, role: "admin" });
      return org.id;
    });
    await setActiveOrgCookie(orgId);
    log.info("org.created", { orgId, userId: user.id });
    return ok({ orgId });
  });
  if (result.ok) redirect("/onboarding?step=team");
  return result;
}

const switchSchema = z.object({ orgId: z.string().min(1) });

/** The org switcher: only an org the user really belongs to can become active. */
export async function switchOrganization(input: z.input<typeof switchSchema>): Promise<ActionResult> {
  const result = await runAction("org.switch", switchSchema, input, async ({ orgId }) => {
    const user = await requireUser();
    const membership = await findMembership(db, orgId, user.id);
    if (membership === null) throw new GuardError("not_found");
    await setActiveOrgCookie(orgId);
    return ok(undefined);
  });
  if (!result.ok) return fail(result.error);
  redirect("/overview");
}
