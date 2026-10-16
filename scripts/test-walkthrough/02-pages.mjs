// Every screen as every persona: no Next error or not-found page where a page is expected, no console errors,
// no sideways overflow, redirects land where they should, and a screenshot of each. Desktop for everyone;
// phone (dark) for a member and a stakeholder on the screens they use most.
//
// Usage: node scripts/test-walkthrough/02-pages.mjs [--only=desktop,phone,public]
import { withBrowser, step, finish, only, query, closePool, pageBroken, ORG, OTHER_ORG } from "./lib.mjs";

const [task] = await query("select t.id from tasks t join organizations o on o.id = t.org_id where o.slug = $1 and t.status = 'in_progress' and t.request_id is null order by t.updated_at desc limit 1", [ORG.slug]);
const [request] = await query("select r.id from requests r join organizations o on o.id = r.org_id where o.slug = $1 and r.status = 'under_review' limit 1", [ORG.slug]);
const [mine] = await query("select r.id from requests r join users u on u.id = r.requester_id join organizations o on o.id = r.org_id where o.slug = $1 and u.email like 'taylor@%' order by r.created_at desc limit 1", [ORG.slug]);
const [goal] = await query("select g.id from goals g join organizations o on o.id = g.org_id where o.slug = $1 order by g.title limit 1", [ORG.slug]);

// [path, expected landing path (default: the same), text that must be on the page]
const MEMBER_PAGES = [
  ["/overview", null, "Pick up where you left off"],
  ["/my-work", null, "My Work"],
  ["/tasks", null, "Tasks"],
  ["/tasks?status=blocked&closed=1", "/tasks", "Blocked"],
  ["/tasks/new", null, "New task"],
  [`/tasks/${task.id}`, null, "Next action"],
  ["/team", null, ORG.team],
  ["/requests", null, "Requests"],
  [`/requests/${request.id}`, null, "Decision history"],
  ["/goals", null, "Goals"],
  [`/goals/${goal.id}`, null, "Linked work"],
  ["/reports", null, "Team summary"],
  ["/reports?type=contributions", "/reports", "Contributions"],
  ["/reports?type=stakeholder", "/reports", "Stakeholder update"],
  ["/my-impact", null, "My Impact"],
  ["/notifications", null, "Notifications"],
  ["/settings", null, "Email notifications"],
  ["/settings/organization", null, "Organization"],
];
const LEAD_EXTRA = [["/requests/review", null, "Weekly review"]];
const MEMBER_REDIRECTS = [["/requests/review", "/requests", "Requests"]];
const STAKEHOLDER_PAGES = [
  ["/overview", null, "New request"],
  ["/requests", null, "Requests"],
  [`/requests/${mine.id}`, null, "The ask"],
  ["/notifications", null, "Notifications"],
  ["/settings", null, "Email notifications"],
  ["/my-work", "/overview", "New request"],
  ["/tasks", "/overview", "New request"],
  ["/team", "/overview", "New request"],
  ["/goals", "/overview", "New request"],
  ["/reports", "/overview", "New request"],
  ["/my-impact", "/overview", "New request"],
  [`/tasks/${task.id}`, null, "you can't see it"],
  [`/requests/${request.id}`, null, "you can't see it"],
];
const OTHER_PAGES = [
  ["/overview", null, OTHER_ORG.name],
  ["/team", null, OTHER_ORG.team],
  ["/tasks", null, "Tasks"],
  [`/tasks/${task.id}`, null, "you can't see it"],
  [`/goals/${goal.id}`, null, "you can't see it"],
];

async function visit(browser, role, size, [path, expected, text]) {
  await browser.goto(path, 2500);
  const landed = (await browser.settle()).split("?")[0].split("#")[0];
  const want = expected ?? path.split("?")[0];
  const broken = await pageBroken(browser);
  const has = await browser.waitFor(text, 20_000);
  const overflow = await browser.overflow();
  const problems = browser.problems.filter((problem) => !problem.includes("Download the React DevTools"));
  browser.problems.length = 0;
  const ok = landed === want && !broken.error && !broken.blank && has && overflow.length === 0 && problems.length === 0;
  const name = `02-${role}-${size}${path.replace(/[^a-z0-9]+/gi, "-").replace(/-$/, "") || "-home"}`;
  step(`${role} ${size} ${path}`, ok, [landed !== want ? `landed ${landed}` : "", broken.error ? "error page" : "", broken.blank ? "blank" : "", !has ? `missing "${text}"` : "", overflow.length ? `overflow ${overflow[0]}` : "", problems.length ? `console ${problems[0].slice(0, 120)}` : ""].filter(Boolean).join(" · "));
  await browser.shot(name);
}

if (only("desktop")) {
  console.log("— desktop, light —");
  for (const [role, pages] of [
    ["member", [...MEMBER_PAGES, ...MEMBER_REDIRECTS]],
    ["lead", [...MEMBER_PAGES, ...LEAD_EXTRA]],
    ["admin", [...MEMBER_PAGES, ...LEAD_EXTRA]],
    ["stakeholder", STAKEHOLDER_PAGES],
    ["other", OTHER_PAGES],
  ]) {
    await withBrowser({ role, width: 1280, height: 900 }, async (browser) => {
      for (const page of pages) await visit(browser, role, "desktop", page);
    });
  }
}

if (only("phone")) {
  console.log("\n— phone, dark —");
  const PHONE = ["/overview", "/my-work", "/tasks", `/tasks/${task.id}`, "/team", "/requests", "/goals", "/reports", "/my-impact", "/notifications", "/settings"];
  await withBrowser({ role: "member", width: 390, height: 844, dark: true }, async (browser) => {
    for (const path of PHONE) await visit(browser, "member", "phone", [path, null, path === "/overview" ? "Pick up where you left off" : ""]);
  });
  await withBrowser({ role: "stakeholder", width: 390, height: 844, dark: true }, async (browser) => {
    for (const page of STAKEHOLDER_PAGES.slice(0, 5)) await visit(browser, "stakeholder", "phone", page);
  });
}

if (only("public")) {
  console.log("\n— signed out —");
  await withBrowser({ role: "public", width: 1280, height: 900 }, async (browser) => {
    for (const page of [
      ["/", null, "Less time managing work"],
      ["/login", null, "sign-in link"],
      ["/login/check-email", null, "Check your email"],
      ["/overview", "/login", "sign-in link"],
      ["/no-such-page", null, "could not be found"],
    ]) {
      await visit(browser, "public", "desktop", page);
    }
  });
}

finish();
await closePool();
