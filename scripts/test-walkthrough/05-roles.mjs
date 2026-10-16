// What each role may and may not do, checked through the real screens:
//   a stakeholder is kept to requests (and only their own), a member is kept out of the review queue and sees
//   no decision controls, another organization sees none of Clarity Demo's work by id or by list, and an admin
//   sees the organization settings a member does not.
//
// Usage: node scripts/test-walkthrough/05-roles.mjs
import { withBrowser, step, finish, query, closePool, ORG, OTHER_ORG } from "./lib.mjs";

const DESKTOP = { width: 1280, height: 900 };
const [task] = await query("select t.id, t.title from tasks t join organizations o on o.id = t.org_id where o.slug = $1 and t.status = 'in_progress' and t.request_id is null order by t.updated_at desc limit 1", [ORG.slug]);
const [adminRequest] = await query("select r.id, r.title from requests r join users u on u.id = r.requester_id join organizations o on o.id = r.org_id where o.slug = $1 and u.email like 'avery@%' limit 1", [ORG.slug]);
const [ownRequest] = await query("select r.id, r.title from requests r join users u on u.id = r.requester_id join organizations o on o.id = r.org_id where o.slug = $1 and u.email like 'taylor@%' limit 1", [ORG.slug]);
const [goal] = await query("select g.id, g.title from goals g join organizations o on o.id = g.org_id where o.slug = $1 limit 1", [ORG.slug]);
const [demoTitles] = await query("select array_agg(title) as titles from tasks t join organizations o on o.id = t.org_id where o.slug = $1", [ORG.slug]);

console.log("— stakeholder —");
await withBrowser({ role: "stakeholder", ...DESKTOP }, async (browser) => {
  await browser.goto("/overview", 4000);
  await browser.waitFor("New request", 30_000);
  const nav = ((await browser.text()) ?? "").toLowerCase();
  step("the navigation offers only Overview and Requests", !nav.includes("my work") && !nav.includes("team dashboard") && !nav.includes("reports"));
  for (const path of ["/my-work", "/tasks", "/team", "/goals", "/reports", "/requests/review"]) {
    await browser.goto(path, 2500);
    const landed = (await browser.settle()).split("?")[0];
    step(`${path} sends a stakeholder to their overview or requests`, landed === "/overview" || landed === "/requests", landed);
  }
  await browser.goto(`/requests/${adminRequest.id}`, 3000);
  step("a request someone else submitted is not found", (await browser.waitFor("you can't see it", 20_000)) && !(await browser.has(adminRequest.title)));
  await browser.goto(`/requests/${ownRequest.id}`, 3000);
  step("their own request opens, without decision controls", (await browser.waitFor("The ask", 20_000)) && !(await browser.has("Convert to task")));
  await browser.goto(`/tasks/${task.id}`, 3000);
  step("a task is not found", await browser.waitFor("you can't see it", 20_000));
});

console.log("\n— member —");
await withBrowser({ role: "member", ...DESKTOP }, async (browser) => {
  await browser.goto("/requests/review", 4000);
  const landed = (await browser.settle()).split("?")[0];
  step("the weekly review is for leads: a member is sent to Requests", landed === "/requests", landed);
  await browser.goto(`/requests/${adminRequest.id}`, 3000);
  step("a member can read a request but gets no decision controls", (await browser.waitFor("The ask", 20_000)) && !(await browser.has("Convert to task")) && !(await browser.has("Reject")));
  await browser.goto("/goals", 3000);
  await browser.waitFor("Goals", 20_000);
  step("a member sees goals but cannot create one", !(await browser.has("New goal")));
  await browser.goto("/settings/organization", 3000);
  await browser.settle();
  const text = ((await browser.text()) ?? "").toLowerCase();
  step("a member sees the organization but not the invite form", !text.includes("send invitation") && !text.includes("invite people"), text.includes("invite") ? "found an invite control" : "");
});

console.log("\n— admin —");
await withBrowser({ role: "admin", ...DESKTOP }, async (browser) => {
  await browser.goto("/settings/organization", 4000);
  step("an admin sees invitations and the rename control", (await browser.waitFor("Rename", 30_000)) && (await browser.has("Invit")));
  await browser.goto("/requests/review", 3000);
  step("an admin may run the weekly review for every team", await browser.waitFor("Weekly review", 20_000));
  await browser.goto("/goals", 3000);
  step("an admin can create organization-wide goals", await browser.waitFor("New goal", 20_000));
});

console.log("\n— another organization —");
await withBrowser({ role: "other", ...DESKTOP }, async (browser) => {
  await browser.goto("/tasks?closed=1", 4000);
  await browser.waitFor("Tasks", 30_000);
  const text = ((await browser.text()) ?? "").toLowerCase();
  const leaked = (demoTitles.titles ?? []).filter((title) => text.includes(String(title).toLowerCase()));
  step("the task list shows none of Clarity Demo's tasks", leaked.length === 0, leaked[0] ?? "");
  for (const [label, path, title] of [
    ["task", `/tasks/${task.id}`, task.title],
    ["request", `/requests/${adminRequest.id}`, adminRequest.title],
    ["goal", `/goals/${goal.id}`, goal.title],
  ]) {
    await browser.goto(path, 3000);
    step(`a Clarity Demo ${label} by id is not found`, (await browser.waitFor("you can't see it", 20_000)) && !(await browser.has(title)));
  }
  await browser.goto("/overview", 3000);
  step("the overview is Other Co's", (await browser.waitFor(OTHER_ORG.name, 20_000)) && !(await browser.has(ORG.name)));
});

finish();
await closePool();
