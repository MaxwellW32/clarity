"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ok, runAction, type ActionResult } from "@/lib/action-result";
import { isValidTimeZone } from "@/lib/time";
import { requireUser } from "@/lib/viewer";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  /** Empty = use the organization's timezone. */
  timezone: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidTimeZone(value), "Pick a timezone from the list."),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  return runAction("profile.update", profileSchema, input, async ({ name, timezone }) => {
    const user = await requireUser();
    await db
      .update(users)
      .set({ name, timezone: timezone === "" ? null : timezone })
      .where(eq(users.id, user.id));
    refresh();
    return ok(undefined, "Profile saved.");
  });
}
