/**
 * The seeded test personas and demo organizations for test mode (see lib/test-mode.ts).
 *
 *   npm run test:seed     create / reset everything below (and rewrite docs/TEST-ACCOUNTS.md)
 *   npm run test:status   what exists right now
 *   npm run test:tidy     put the demo orgs back to the seeded state (removes orgs a test run created)
 *   npm run test:clean    delete the demo orgs and every .test account
 *
 * Run with: npx tsx scripts/test-accounts.ts <seed|status|tidy|clean>
 *
 * Only organizations whose every member is a .test account are ever reset or deleted.
 */
import "./load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import { eq, inArray, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { ORG_ROLE_LABELS, TEAM_ROLE_LABELS } from "@/lib/constants";
import {
  OTHER_ORG,
  OTHER_TEAM,
  TEST_EMAIL_DOMAIN,
  TEST_ORG,
  TEST_PERSONAS,
  TEST_PROJECT,
  TEST_TEAM,
  type TestPersona,
} from "@/lib/test-mode";
import { dayKey } from "@/lib/time";
import { EXPECTATIONS, GOALS, REQUESTS, TASKS, type Person } from "./seed-data";

const {
  organizations,
  organizationMembers,
  teams,
  teamMembers,
  users,
  projects,
  goals,
  teamExpectations,
  requests,
  requestDecisions,
  tasks,
  taskUpdates,
  taskEvidenceLinks,
  taskActivity,
  invitations,
} = schema;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const LIKE_TEST = `%${TEST_EMAIL_DOMAIN}`;
const DAY = 24 * 60 * 60 * 1000;

/** A second member of Other Co who is not a sign-in persona. */
const OTHER_MEMBER = { email: `casey${TEST_EMAIL_DOMAIN}`, name: "Casey Other" };

type Ids = Record<TestPersona, string> & { casey: string };

/** The personas, created or refreshed in place (ids survive, so open sessions stay valid). */
async function ensureUsers(tx: Tx): Promise<Ids> {
  const ids = {} as Ids;
  const all: [keyof Ids, { email: string; name: string }][] = [
    ...(Object.entries(TEST_PERSONAS) as [TestPersona, { email: string; name: string }][]),
    ["casey", OTHER_MEMBER],
  ];
  for (const [key, account] of all) {
    const [row] = await tx
      .insert(users)
      .values({ email: account.email, name: account.name, emailVerified: new Date() })
      .onConflictDoUpdate({ target: users.email, set: { name: account.name, image: null, timezone: null } })
      .returning({ id: users.id });
    ids[key] = row.id;
  }
  return ids;
}

/** Orgs that belong to test accounts alone: every member is a .test account. A real member anywhere = untouched. */
async function testOnlyOrgIds(tx: Tx): Promise<string[]> {
  const rows = await tx.execute<{ id: string }>(sql`
    select o.id from organizations o
    where exists (select 1 from organization_members m join users u on u.id = m.user_id where m.org_id = o.id and u.email like ${LIKE_TEST})
      and not exists (select 1 from organization_members m join users u on u.id = m.user_id
                      where m.org_id = o.id and (u.email is null or u.email not like ${LIKE_TEST}))`);
  return rows.rows.map((row) => row.id);
}

/** The org row for a seeded slug, kept (stable id) when it exists and is test-only; refused otherwise. */
async function claimOrg(tx: Tx, spec: { name: string; slug: string; timezone: string }, createdBy: string, testOnly: Set<string>) {
  const [existing] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, spec.slug));
  if (existing) {
    const [members] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(organizationMembers)
      .where(eq(organizationMembers.orgId, existing.id));
    if (members.n > 0 && !testOnly.has(existing.id)) {
      throw new Error(`An organization with slug "${spec.slug}" has real members; refusing to touch it.`);
    }
    await tx.update(organizations).set({ name: spec.name, timezone: spec.timezone }).where(eq(organizations.id, existing.id));
    await wipeOrgContents(tx, existing.id);
    return existing.id;
  }
  const [created] = await tx
    .insert(organizations)
    .values({ name: spec.name, slug: spec.slug, timezone: spec.timezone, createdBy })
    .returning({ id: organizations.id });
  return created.id;
}

async function wipeOrgContents(tx: Tx, orgId: string): Promise<void> {
  // Order matters only for the no-action foreign keys; tasks take their updates, evidence and activity with them.
  await tx.delete(taskActivity).where(eq(taskActivity.orgId, orgId));
  await tx.update(requests).set({ convertedTaskId: null }).where(eq(requests.orgId, orgId));
  await tx.delete(tasks).where(eq(tasks.orgId, orgId));
  await tx.delete(requests).where(eq(requests.orgId, orgId));
  await tx.delete(teamExpectations).where(eq(teamExpectations.orgId, orgId));
  await tx.delete(goals).where(eq(goals.orgId, orgId));
  await tx.delete(projects).where(eq(projects.orgId, orgId));
  await tx.delete(invitations).where(eq(invitations.orgId, orgId));
  await tx.delete(schema.notifications).where(eq(schema.notifications.orgId, orgId));
  await tx.delete(teams).where(eq(teams.orgId, orgId));
  await tx.delete(organizationMembers).where(eq(organizationMembers.orgId, orgId));
}

async function deleteOrgs(tx: Tx, orgIds: string[]): Promise<void> {
  for (const orgId of orgIds) await wipeOrgContents(tx, orgId);
  if (orgIds.length > 0) await tx.delete(organizations).where(inArray(organizations.id, orgIds));
}

async function seedDemoOrg(tx: Tx, ids: Ids, testOnly: Set<string>): Promise<{ orgId: string; tasks: number; requests: number }> {
  const now = Date.now();
  const at = (daysAgo: number) => new Date(now - daysAgo * DAY);
  const due = (inDays: number) => dayKey(new Date(now + inDays * DAY), TEST_ORG.timezone);
  const who = (person: Person) => ids[person];

  const orgId = await claimOrg(tx, TEST_ORG, ids.admin, testOnly);
  for (const persona of ["admin", "lead", "member", "member2", "stakeholder"] as const) {
    await tx.insert(organizationMembers).values({ orgId, userId: ids[persona], role: TEST_PERSONAS[persona].orgRole, joinedAt: at(30) });
  }
  const [team] = await tx.insert(teams).values({ orgId, name: TEST_TEAM.name, description: TEST_TEAM.description, createdAt: at(30) }).returning();
  for (const persona of ["lead", "member", "member2"] as const) {
    await tx.insert(teamMembers).values({ teamId: team.id, userId: ids[persona], role: TEST_PERSONAS[persona].teamRole ?? "member", addedAt: at(30) });
  }
  const [project] = await tx.insert(projects).values({ orgId, teamId: team.id, name: TEST_PROJECT.name, createdAt: at(30) }).returning();

  const goalIds: Record<string, string> = {};
  for (const goal of GOALS) {
    const [row] = await tx
      .insert(goals)
      .values({
        orgId,
        teamId: goal.team ? team.id : null,
        title: goal.title,
        description: goal.description,
        ownerId: who(goal.owner),
        targetDate: due(goal.targetInDays),
        successCriteria: goal.successCriteria,
        createdAt: at(25),
        updatedAt: at(25),
      })
      .returning({ id: goals.id });
    goalIds[goal.key] = row.id;
  }

  const today = new Date(now);
  const monthStart = dayKey(new Date(today.getFullYear(), today.getMonth(), 1), TEST_ORG.timezone);
  const monthEnd = dayKey(new Date(today.getFullYear(), today.getMonth() + 1, 0), TEST_ORG.timezone);
  const quarter = Math.floor(today.getMonth() / 3);
  const quarterStart = dayKey(new Date(today.getFullYear(), quarter * 3, 1), TEST_ORG.timezone);
  const quarterEnd = dayKey(new Date(today.getFullYear(), quarter * 3 + 3, 0), TEST_ORG.timezone);
  for (const expectation of EXPECTATIONS) {
    await tx.insert(teamExpectations).values({
      orgId,
      teamId: team.id,
      title: expectation.title,
      description: expectation.description,
      kind: expectation.kind,
      targetCount: expectation.targetCount,
      periodStart: expectation.period === "month" ? monthStart : quarterStart,
      periodEnd: expectation.period === "month" ? monthEnd : quarterEnd,
      goalId: expectation.goal ? goalIds[expectation.goal] : null,
      createdAt: at(20),
    });
  }

  const requestIds: Record<string, string> = {};
  for (const request of REQUESTS) {
    const decided = request.decision;
    const [row] = await tx
      .insert(requests)
      .values({
        orgId,
        teamId: team.id,
        title: request.title,
        description: request.description,
        desiredOutcome: request.desiredOutcome,
        urgency: request.urgency,
        link: request.link ?? null,
        requesterId: who(request.requester),
        status: request.status,
        decidedAt: decided ? at(decided.daysAgo) : null,
        decidedBy: decided ? who(decided.by) : null,
        decisionReason: decided?.reason ?? null,
        deferUntil: decided?.deferInDays !== undefined ? due(decided.deferInDays) : null,
        createdAt: at(request.createdDaysAgo),
        updatedAt: decided ? at(decided.daysAgo) : at(request.createdDaysAgo),
      })
      .returning({ id: requests.id });
    requestIds[request.key] = row.id;
    if (decided) {
      await tx.insert(requestDecisions).values({
        requestId: row.id,
        deciderId: who(decided.by),
        decision: request.status === "new" ? "under_review" : request.status,
        reason: decided.reason,
        createdAt: at(decided.daysAgo),
      });
    }
  }

  for (const [index, spec] of TASKS.entries()) {
    const taskId = crypto.randomUUID();
    const createdAt = at(spec.createdDaysAgo);
    const last = spec.updates.at(-1);
    const startedAt = spec.status === "not_started" ? null : at(spec.updates[0]?.daysAgo ?? spec.createdDaysAgo - 0.1);
    const endAt = spec.completed ? at(spec.completed.daysAgo) : spec.rejection ? at(spec.rejection.daysAgo) : last ? at(last.daysAgo) : createdAt;

    await tx.insert(tasks).values({
      id: taskId,
      orgId,
      teamId: team.id,
      projectId: project.id,
      requestId: spec.request ? requestIds[spec.request] : null,
      goalId: spec.goal ? goalIds[spec.goal] : null,
      title: spec.title,
      description: spec.description ?? null,
      assigneeId: spec.assignee ? who(spec.assignee) : null,
      createdBy: who(spec.createdBy),
      approverId: spec.approver ? who(spec.approver) : null,
      priority: spec.priority,
      size: spec.size,
      status: spec.status,
      dueDate: spec.dueInDays === null ? null : due(spec.dueInDays),
      startedAt,
      completedAt: spec.completed ? at(spec.completed.daysAgo) : null,
      blockedReason: spec.blocked?.reason ?? null,
      blockedBy: spec.blocked?.by ?? null,
      rejectionReason: spec.rejection?.reason ?? null,
      latestProgress: last?.progress ?? null,
      nextAction: last?.next ?? null,
      completionSummary: spec.completed?.summary ?? null,
      impactNote: spec.completed?.impact ?? null,
      sortRank: TASKS.length - index,
      createdAt,
      updatedAt: endAt,
    });
    if (spec.request) await tx.update(requests).set({ convertedTaskId: taskId }).where(eq(requests.id, requestIds[spec.request]));

    const activity: (typeof taskActivity.$inferInsert)[] = [
      { orgId, taskId, actorId: who(spec.createdBy), kind: "created", createdAt },
    ];
    if (spec.assignee && spec.assignee !== spec.createdBy) {
      activity.push({ orgId, taskId, actorId: who(spec.createdBy), kind: "assigned", after: { assigneeId: who(spec.assignee) }, createdAt });
    }
    if (startedAt) {
      activity.push({ orgId, taskId, actorId: who(spec.assignee ?? spec.createdBy), kind: "status_changed", before: { status: "not_started" }, after: { status: "in_progress" }, createdAt: startedAt });
    }
    for (const update of spec.updates) {
      await tx.insert(taskUpdates).values({ taskId, authorId: who(update.author), progress: update.progress, nextAction: update.next, blocker: update.blocker ?? null, createdAt: at(update.daysAgo) });
      activity.push({ orgId, taskId, actorId: who(update.author), kind: "progress_updated", createdAt: at(update.daysAgo) });
    }
    for (const link of spec.evidence ?? []) {
      const addedAt = last ? at(last.daysAgo) : createdAt;
      await tx.insert(taskEvidenceLinks).values({ taskId, url: link.url, label: link.label, addedBy: who(spec.assignee ?? spec.createdBy), createdAt: addedAt });
      activity.push({ orgId, taskId, actorId: who(spec.assignee ?? spec.createdBy), kind: "evidence_added", after: { url: link.url, label: link.label }, createdAt: addedAt });
    }
    if (spec.blocked && last) {
      activity.push({ orgId, taskId, actorId: who(last.author), kind: "blocked", after: { status: "blocked", blockedReason: spec.blocked.reason }, note: spec.blocked.reason, createdAt: at(last.daysAgo) });
    }
    if (spec.approver && last) {
      activity.push({ orgId, taskId, actorId: who(last.author), kind: "approval_requested", after: { status: "awaiting_approval", approverId: who(spec.approver) }, createdAt: at(last.daysAgo) });
    }
    if (spec.rejection) {
      activity.push({ orgId, taskId, actorId: ids.lead, kind: "rejected", after: { status: "rejected" }, note: spec.rejection.reason, createdAt: at(spec.rejection.daysAgo) });
    }
    if (spec.completed) {
      activity.push({ orgId, taskId, actorId: who(spec.assignee ?? spec.createdBy), kind: "completed", after: { status: "completed" }, note: spec.completed.summary, createdAt: at(spec.completed.daysAgo) });
    }
    await tx.insert(taskActivity).values(activity);
  }

  return { orgId, tasks: TASKS.length, requests: REQUESTS.length };
}

/** Other Co: a separate tenant with its own .test people and a little data, to prove isolation. */
async function seedOtherOrg(tx: Tx, ids: Ids, testOnly: Set<string>): Promise<string> {
  const now = Date.now();
  const at = (daysAgo: number) => new Date(now - daysAgo * DAY);
  const orgId = await claimOrg(tx, OTHER_ORG, ids.other, testOnly);
  await tx.insert(organizationMembers).values([
    { orgId, userId: ids.other, role: "admin", joinedAt: at(20) },
    { orgId, userId: ids.casey, role: "member", joinedAt: at(20) },
  ]);
  const [team] = await tx.insert(teams).values({ orgId, name: OTHER_TEAM.name, description: OTHER_TEAM.description }).returning();
  await tx.insert(teamMembers).values([
    { teamId: team.id, userId: ids.other, role: "lead" },
    { teamId: team.id, userId: ids.casey, role: "member" },
  ]);
  await tx
    .insert(requests)
    .values({ orgId, teamId: team.id, title: "Phone support on weekends", description: "Enterprise customers ask for weekend cover.", requesterId: ids.casey, urgency: "normal", createdAt: at(2), updatedAt: at(2) });
  const seeded = [
    { title: "Reply to the Acme escalation", assigneeId: ids.casey, status: "in_progress" as const, latestProgress: "Drafted the reply with the timeline.", nextAction: "Send it after Riley reviews." },
    { title: "Refresh the help-center macros", assigneeId: ids.other, status: "not_started" as const, latestProgress: null, nextAction: null },
  ];
  for (const task of seeded) {
    const [row] = await tx
      .insert(tasks)
      .values({ orgId, teamId: team.id, createdBy: ids.other, ...task, createdAt: at(3), updatedAt: at(1) })
      .returning({ id: tasks.id });
    await tx.insert(taskActivity).values({ orgId, taskId: row.id, actorId: ids.other, kind: "created", createdAt: at(3) });
  }
  return orgId;
}

async function reset(): Promise<{ demo: Awaited<ReturnType<typeof seedDemoOrg>>; removed: number }> {
  return db.transaction(async (tx) => {
    const ids = await ensureUsers(tx);
    const testOnly = new Set(await testOnlyOrgIds(tx));
    const demo = await seedDemoOrg(tx, ids, testOnly);
    const other = await seedOtherOrg(tx, ids, testOnly);
    // Anything else the test accounts own goes: orgs a walkthrough created through onboarding.
    const extras = [...testOnly].filter((id) => id !== demo.orgId && id !== other);
    await deleteOrgs(tx, extras);
    // Personas start every run with a clean profile and without stale invitations to them elsewhere.
    await tx.delete(invitations).where(like(invitations.email, LIKE_TEST));
    return { demo, removed: extras.length };
  });
}

export async function seed(): Promise<void> {
  const { demo, removed } = await reset();
  for (const persona of Object.values(TEST_PERSONAS)) console.log(`ready: ${persona.email.padEnd(24)} ${persona.name}`);
  console.log(`org:   ${TEST_ORG.name} (${demo.tasks} tasks, ${demo.requests} requests) · ${OTHER_ORG.name}`);
  if (removed > 0) console.log(`removed ${removed} extra test organization(s)`);
  writeAccountsDoc();
  console.log("\nSign in with /api/test-login?as=<persona>&secret=<TEST_MODE_SECRET> while `npm run dev` is running.");
}

export async function tidy(): Promise<void> {
  const { removed } = await reset();
  console.log(`Tidy: ${TEST_ORG.name} and ${OTHER_ORG.name} are back to the seeded state${removed > 0 ? `; removed ${removed} extra test organization(s)` : ""}.`);
}

export async function status(): Promise<void> {
  const people = await db.execute<{ email: string; name: string | null; orgs: string }>(sql`
    select u.email, u.name,
           coalesce(string_agg(o.name || ' (' || m.role || coalesce(', ' || tm.roles, '') || ')', '; ' order by o.name), '-') as orgs
    from users u
    left join organization_members m on m.user_id = u.id
    left join organizations o on o.id = m.org_id
    left join lateral (
      select string_agg(t.name || ' ' || x.role, ', ') as roles
      from team_members x join teams t on t.id = x.team_id
      where x.user_id = u.id and t.org_id = o.id
    ) tm on true
    where u.email like ${LIKE_TEST}
    group by u.id order by u.email`);
  if (people.rows.length === 0) {
    console.log("No test accounts. Run: npm run test:seed");
    return;
  }
  console.table(people.rows);
  const counts = await db.execute<{ org: string; status: string; n: number }>(sql`
    select o.name as org, t.status, count(*)::int as n from tasks t join organizations o on o.id = t.org_id
    where o.slug in (${TEST_ORG.slug}, ${OTHER_ORG.slug}) group by o.name, t.status order by o.name, t.status`);
  console.table(counts.rows);
  const testOnly = await db.transaction(async (tx) => testOnlyOrgIds(tx));
  const extra = testOnly.length - 2;
  if (extra > 0) console.log(`${extra} extra test organization(s) exist (npm run test:tidy removes them).`);
}

export async function clean(): Promise<void> {
  await db.transaction(async (tx) => {
    const testUsers = await tx.select({ id: users.id }).from(users).where(like(users.email, LIKE_TEST));
    if (testUsers.length === 0) {
      console.log("No test accounts to remove.");
      return;
    }
    const userIds = testUsers.map((row) => row.id);
    // A real org whose only admin is a test account would be orphaned: refuse, and say which.
    const orphaned = await tx.execute<{ name: string }>(sql`
      select o.name from organizations o
      where exists (select 1 from organization_members m join users u on u.id = m.user_id where m.org_id = o.id and u.email not like ${LIKE_TEST})
        and not exists (select 1 from organization_members m join users u on u.id = m.user_id where m.org_id = o.id and m.role = 'admin' and u.email not like ${LIKE_TEST})`);
    if (orphaned.rows.length > 0) {
      throw new Error(`A test account is the only admin of a real organization (${orphaned.rows.map((row) => row.name).join(", ")}). Promote someone else first.`);
    }
    const orgIds = await testOnlyOrgIds(tx);
    await deleteOrgs(tx, orgIds);
    await tx.delete(invitations).where(like(invitations.email, LIKE_TEST));
    // Sessions, accounts and memberships go with the user (cascade).
    await tx.delete(users).where(inArray(users.id, userIds));
    console.log(`Removed ${userIds.length} test account(s) and ${orgIds.length} test organization(s).`);
  });
}

/** docs/TEST-ACCOUNTS.md: the accounts as they are seeded, so nobody has to read this file to know what exists. */
function writeAccountsDoc(): void {
  const rows = (Object.entries(TEST_PERSONAS) as [TestPersona, (typeof TEST_PERSONAS)[TestPersona]][]).map(([key, persona]) => {
    const org = persona.org === "demo" ? TEST_ORG.name : OTHER_ORG.name;
    const team = persona.org === "demo" ? TEST_TEAM.name : OTHER_TEAM.name;
    const teamText = persona.teamRole ? `${team} ${TEAM_ROLE_LABELS[persona.teamRole].toLowerCase()}` : "not on a team";
    return `| \`${key}\` | \`${persona.email}\` | ${persona.name} | ${org}: ${ORG_ROLE_LABELS[persona.orgRole].toLowerCase()}, ${teamText} |`;
  });
  const statusCounts = TASKS.reduce<Record<string, number>>((acc, task) => ({ ...acc, [task.status]: (acc[task.status] ?? 0) + 1 }), {});
  const lines = [
    "# Test accounts",
    "",
    "> **Generated by `npm run test:seed`. Do not edit by hand.** Change `lib/test-mode.ts` / `scripts/seed-data.ts` and run it again.",
    "",
    "Made-up accounts for test mode (`lib/test-mode.ts`) on the reserved `.test` domain. No email is ever sent to them, and the",
    "scripts only ever reset or delete organizations whose every member is a `.test` account.",
    "",
    "## Sign in",
    "",
    "Dev server only: `GET /api/test-login?as=<persona>&secret=<TEST_MODE_SECRET>&to=/overview`. The secret is in `.env.local`.",
    "`scripts/test-browser.mjs` does this in headless Chrome.",
    "",
    "| `as=` | Email | Name | Role |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    `Also seeded: \`${OTHER_MEMBER.email}\` (${OTHER_MEMBER.name}), a member of ${OTHER_ORG.name} who is not a sign-in persona.`,
    "",
    "## What the demo org contains",
    "",
    `**${TEST_ORG.name}** (slug \`${TEST_ORG.slug}\`, ${TEST_ORG.timezone}): team **${TEST_TEAM.name}**, project **${TEST_PROJECT.name}**.`,
    "",
    `- ${TASKS.length} tasks: ${Object.entries(statusCounts).map(([status, n]) => `${n} ${status.replaceAll("_", " ")}`).join(", ")}.`,
    "  Two are overdue, two await Morgan's approval, three are blocked with reasons, six finished in the last two weeks.",
    `- ${REQUESTS.length} requests, one in every state; two from Taylor (one converted into the backup task).`,
    `- ${GOALS.length} goals and ${EXPECTATIONS.length} team expectations.`,
    "- Dates are relative to the moment of seeding, so re-seed (or `npm run test:tidy`) to keep the dashboards current.",
    "",
    `**${OTHER_ORG.name}** (slug \`${OTHER_ORG.slug}\`): team ${OTHER_TEAM.name}, two tasks and a request. Used to prove cross-org isolation.`,
    "",
    "## Commands",
    "",
    "```bash",
    "npm run test:seed     # create / reset the personas and both orgs (and this file)",
    "npm run test:status   # who exists, their orgs and teams, task counts",
    "npm run test:tidy     # put both orgs back to the seeded state; remove orgs a test run created",
    "npm run test:clean    # delete both orgs and every .test account",
    "npm run test:walk     # run every scripted walkthrough in scripts/test-walkthrough/",
    "```",
    "",
  ];
  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/TEST-ACCOUNTS.md", lines.join("\n"));
  console.log("wrote docs/TEST-ACCOUNTS.md");
}

// --- command line -------------------------------------------------------------

const commands = { seed, status, tidy, clean } as const;
const command = process.argv[2] as keyof typeof commands | undefined;

if (command === undefined || !(command in commands)) {
  console.error("Usage: npx tsx scripts/test-accounts.ts <seed|status|tidy|clean>");
  process.exit(1);
}

commands[command]()
  .catch((error: unknown) => {
    console.error(`Nothing was changed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
