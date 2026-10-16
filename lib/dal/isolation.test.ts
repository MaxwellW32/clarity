import { config } from "dotenv";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Cross-organization isolation, proven against the real database with the seeded demo orgs. Opt-in because it
// needs DATABASE_URL and a seeded database:  CLARITY_DB_TESTS=1 npx vitest run lib/dal/isolation.test.ts
config({ path: ".env.local", quiet: true });
const enabled = process.env.CLARITY_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

type Dal = typeof import("./tasks") & typeof import("./requests") & typeof import("./goals");

describe.skipIf(!enabled)("organization isolation (database)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let dal: Dal;
  let demo: { orgId: string; taskId: string; requestId: string; goalId: string; memberId: string; teamId: string };
  let other: { orgId: string; adminId: string; teamId: string };

  beforeAll(async () => {
    const [tasksDal, requestsDal, goalsDal] = await Promise.all([import("./tasks"), import("./requests"), import("./goals")]);
    dal = { ...tasksDal, ...requestsDal, ...goalsDal };
    const row = async (text: string, params: unknown[]) => (await pool.query(text, params)).rows[0];
    const demoOrg = await row("select id from organizations where slug = $1", ["clarity-demo"]);
    const otherOrg = await row("select id from organizations where slug = $1", ["other-co"]);
    demo = {
      orgId: demoOrg.id,
      taskId: (await row("select id from tasks where org_id = $1 limit 1", [demoOrg.id])).id,
      requestId: (await row("select id from requests where org_id = $1 limit 1", [demoOrg.id])).id,
      goalId: (await row("select id from goals where org_id = $1 limit 1", [demoOrg.id])).id,
      memberId: (await row("select id from users where email = $1", ["jordan@clarity.test"])).id,
      teamId: (await row("select id from teams where org_id = $1 limit 1", [demoOrg.id])).id,
    };
    other = {
      orgId: otherOrg.id,
      adminId: (await row("select id from users where email = $1", ["riley@clarity.test"])).id,
      teamId: (await row("select id from teams where org_id = $1 limit 1", [otherOrg.id])).id,
    };
  });

  afterAll(async () => {
    await pool.end();
  });

  const viewerFor = (userId: string, orgId: string, teamId: string, role: "admin" | "member") => ({
    userId,
    orgId,
    orgRole: role,
    teamRoles: new Map([[teamId, "lead" as const]]),
    timezone: "America/Jamaica",
  });

  it("another organization's admin cannot read Clarity Demo rows by id", async () => {
    const riley = viewerFor(other.adminId, other.orgId, other.teamId, "admin");
    expect(await dal.getTask(riley, demo.taskId)).toBeNull();
    expect(await dal.getTaskBasics(riley, demo.taskId)).toBeNull();
    expect(await dal.getRequest(riley, demo.requestId)).toBeNull();
    expect(await dal.getGoal(riley, demo.goalId)).toBeNull();
    expect(await dal.listEvidence(riley, demo.taskId)).toEqual([]);
  });

  it("another organization's lists contain none of Clarity Demo's work", async () => {
    const riley = viewerFor(other.adminId, other.orgId, other.teamId, "admin");
    const page = await dal.listTasks(riley, { q: "", status: [], assignee: "", priority: "", due: "", team: "", closed: true, sort: "smart" }, { today: "2026-10-15", limit: 500 });
    const demoTasks = (await pool.query("select id from tasks where org_id = $1", [demo.orgId])).rows.map((row) => row.id);
    expect(page.items.some((item) => demoTasks.includes(item.id))).toBe(false);
    const requests = await dal.listRequests(riley, { view: "all", team: "", mine: false });
    expect(requests.some((item) => item.id === demo.requestId)).toBe(false);
    const goals = await dal.listGoals(riley, []);
    expect(goals.some((item) => item.id === demo.goalId)).toBe(false);
  });

  it("a Clarity Demo member with a forged active org still sees nothing of Other Co", async () => {
    // The org cookie is validated against membership before a Viewer exists; even so, a Viewer for the wrong org
    // only ever filters by that org, so the demo member's own task is invisible through it.
    const forged = viewerFor(demo.memberId, other.orgId, other.teamId, "member");
    expect(await dal.getTask(forged, demo.taskId)).toBeNull();
  });

  it("attention and feed queries stay inside the organization", async () => {
    const riley = viewerFor(other.adminId, other.orgId, other.teamId, "admin");
    const attention = await dal.attentionTasks(riley, [demo.teamId], "2026-10-15");
    expect(attention).toEqual([]);
  });
});
