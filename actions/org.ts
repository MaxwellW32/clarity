"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { organizationMembers, organizations } from "@/db/schema";
import { fail, GuardError, ok, runAction, type ActionResult } from "@/lib/action-result";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { findMembership, slugForRename, uniqueSlug } from "@/lib/dal/orgs";
import { requireOrgAdmin } from "@/lib/guards";
import { log } from "@/lib/log";
import { setActiveOrgCookie } from "@/lib/org-cookie";
import { isValidTimeZone } from "@/lib/time";
import { requireUser } from "@/lib/viewer";

const nameSchema = z.string().trim().min(2, "Give the organisation a name (2 characters or more).").max(80);

const createSchema = z.object({
  name: nameSchema,
  timezone: z.string().trim().default(DEFAULT_TIMEZONE).refine(isValidTimeZone, "Pick a timezone from the list."),
});

/**
 * Onboarding's first step (and "New organization"): the creator becomes its first admin. Onboarding then
 * works out the next step from what exists, so a refresh can never lose it.
 */
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
  if (result.ok) redirect("/onboarding");
  return result;
}

const renameSchema = z.object({ name: nameSchema });

/** Renames the active org; the slug follows the new name only when no other org has that slug. */
export async function renameOrganization(input: z.input<typeof renameSchema>): Promise<ActionResult<{ slug: string }>> {
  return runAction("org.rename", renameSchema, input, async ({ name }) => {
    const { viewer, org } = await requireOrgAdmin();
    const slug = await db.transaction(async (tx) => {
      const next = await slugForRename(tx, viewer.orgId, name, org.slug);
      await tx.update(organizations).set({ name, slug: next }).where(eq(organizations.id, viewer.orgId));
      return next;
    });
    log.info("org.renamed", { orgId: viewer.orgId, by: viewer.userId });
    refresh();
    return ok({ slug }, "Organisation renamed.");
  });
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
