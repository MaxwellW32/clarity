// A request's whole life, driven by three people:
//   Taylor (stakeholder) asks for something → it shows on the overview as waiting on a decision
//   Morgan (lead) finds it in the weekly review → defers it with a reason → Taylor sees the reason
//   Morgan reopens it, approves it, then converts it into a task assigned to Jordan
//   Taylor's request page shows the work it became; Jordan and Taylor each get a notification
//   Jordan opens the task and sees where it came from
//
// Usage: node scripts/test-walkthrough/04-requests.mjs [--keep]
import { openBrowser, withBrowser, step, finish, hasFlag, tidy, query, closePool, PEOPLE, stoppedOn } from "./lib.mjs";

const DESKTOP = { width: 1280, height: 900 };
const tag = Math.random().toString(36).slice(2, 7);
const TITLE = `Weekly sales digest email (${tag})`;

tidy();
const [jordan] = await query("select id from users where email = $1", [PEOPLE.member.email]);

const taylor = await openBrowser({ role: "stakeholder", ...DESKTOP });
const morgan = await openBrowser({ role: "lead", ...DESKTOP });
let requestPath = null;
let taskPath = null;

try {
  // --- submit ----------------------------------------------------------------------------------------------------
  await taylor.goto("/requests", 4000);
  await taylor.waitFor("Requests", 30_000);
  await taylor.click("New request", { wait: 1200 });
  const typed = await taylor.type("#request-title", TITLE);
  await taylor.type("#request-outcome", "Sales stops copying numbers into a spreadsheet every Monday.");
  await taylor.click("Submit request", { exact: true, wait: 2500 });
  step("Taylor submits a request", typed && (await taylor.waitFor("Request submitted", 20_000)));
  await taylor.goto("/overview", 3000);
  step("it shows on Taylor's overview as waiting on a decision", await taylor.waitForNear("Waiting on a decision", TITLE, { timeout: 20_000 }));

  // --- defer -------------------------------------------------------------------------------------------------------
  await morgan.goto("/requests/review", 4000);
  await morgan.waitFor("Weekly review", 30_000);
  step("Morgan sees it under Needs a decision", await morgan.waitForNear("Needs a decision", TITLE, { timeout: 20_000 }));
  await morgan.click("Defer", { near: TITLE, wait: 1000 });
  const reasoned = await morgan.type("#decision-reason", "Not before the quarter close; revisit in November.");
  await morgan.click("Defer", { exact: true, within: "[role=dialog]", wait: 2500 });
  step("deferring with a reason moves it out of Needs a decision", reasoned && (await morgan.waitFor("Deferred.", 20_000)) && (await morgan.waitForNear("Deferred, worth another look", TITLE, { timeout: 20_000 })));

  await taylor.goto("/requests?view=deferred", 3000);
  await taylor.click(TITLE, { wait: 1500 });
  const opened = await taylor.waitForPath(/^\/requests\/[0-9a-f-]{36}$/, 30_000);
  requestPath = (await taylor.path()).split("?")[0];
  step("Taylor opens it and sees who deferred it and why", opened && (await taylor.waitFor("Deferred by Morgan Lead", 20_000)) && (await taylor.has("revisit in November")));

  // --- reopen, approve, convert ------------------------------------------------------------------------------------
  await morgan.goto(requestPath, 3000);
  await morgan.waitFor("Reopen", 20_000);
  await morgan.click("Reopen", { exact: true, wait: 1000 });
  await morgan.click("Reopen", { exact: true, within: "[role=dialog]", wait: 2500 });
  step("Morgan reopens it", (await morgan.waitFor("Reopened.", 20_000)) && (await morgan.waitFor("Waiting for a Engineering lead", 20_000)));
  await morgan.click("Approve", { exact: true, wait: 1000 });
  await morgan.type("#decision-reason", "Cheap to build; sales asked twice.");
  await morgan.click("Approve", { exact: true, within: "[role=dialog]", wait: 2500 });
  step("Morgan approves it with a reason", (await morgan.waitFor("Approved.", 20_000)) && (await morgan.waitFor("Approved by Morgan Lead", 20_000)));
  await morgan.click("Convert to task", { exact: true, wait: 1000 });
  const assigned = await morgan.select("#convert-assignee", jordan.id);
  await morgan.type("#convert-next", "Draft the digest template with sales.");
  await morgan.click("Create task", { exact: true, wait: 3000 });
  step("Morgan converts it into a task for Jordan", assigned && (await morgan.waitFor("Task created from the request.", 20_000)) && (await morgan.waitFor("The work it became", 20_000)));
  const [task] = await query("select t.id from tasks t join requests r on r.converted_task_id = t.id where r.title = $1", [TITLE]);
  taskPath = task ? `/tasks/${task.id}` : null;
  step("the task keeps a link back to the request", taskPath !== null);

  // --- the requester follows it --------------------------------------------------------------------------------------
  await taylor.goto(requestPath, 3000);
  step("Taylor sees the task it became, with its next action", (await taylor.waitFor("The work it became", 20_000)) && (await taylor.has("Draft the digest template")));
  await taylor.goto("/notifications", 3000);
  step("Taylor is told the request became a task", await taylor.waitFor("Your request is now a task", 20_000));

  // --- the assignee ---------------------------------------------------------------------------------------------------
  await withBrowser({ role: "member", ...DESKTOP }, async (jordanBrowser) => {
    await jordanBrowser.goto("/notifications", 4000);
    step("Jordan is told about the new task", await jordanBrowser.waitFor(`New task for you: ${TITLE}`, 30_000));
    const unread = await jordanBrowser.evaluate(`document.querySelector('a[href="/notifications"]')?.getAttribute("aria-label") ?? ""`);
    step("the bell counts it as unread", /\d+ unread/.test(String(unread)), String(unread));
    await jordanBrowser.click(`New task for you: ${TITLE}`, { wait: 2500 });
    const landed = await jordanBrowser.waitForPath(/^\/tasks\/[0-9a-f-]{36}$/, 30_000);
    step("opening the notification lands on the task and shows where it came from", landed && (await jordanBrowser.waitFor("From request", 20_000)) && (await jordanBrowser.has(TITLE)));
    await jordanBrowser.goto("/notifications", 3000);
    const stillUnread = await jordanBrowser.evaluate(`document.querySelector('a[href="/notifications"]')?.getAttribute("aria-label") ?? ""`);
    step("the notification is read once opened", !/\d+ unread/.test(String(stillUnread)), String(stillUnread));
  });

  // --- the lead's dashboard ------------------------------------------------------------------------------------------------
  await morgan.goto("/team", 3000);
  await morgan.waitFor("Recent decisions", 20_000);
  step("the team feed records the conversion", await morgan.has("turned into a task the request"));
} catch (error) {
  await stoppedOn(error, "04", { taylor, morgan });
  step("the flow ran to the end", false, error instanceof Error ? error.message : String(error));
} finally {
  await taylor.close();
  await morgan.close();
}

if (!hasFlag("keep")) tidy();
finish();
await closePool();
