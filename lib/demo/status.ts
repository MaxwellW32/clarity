import "server-only";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { SAMPLE_TAG } from "./sample";

/** Whether the organization currently holds sample work. */
export async function hasSampleData(orgId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), like(tasks.title, `${SAMPLE_TAG}%`)));
  return (row?.n ?? 0) > 0;
}
