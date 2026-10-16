// A task's whole life, driven through the real screens by two people:
//   Jordan (member) creates a task from My Work → it shows under Continue working → opens it → saves an update
//   with a next action → marks it blocked (red strip, Waiting on others) → unblocks → sends it for approval
//   Morgan (lead) sees Approve / Send back on the Resume card → sends it back with a note
//   Jordan sees "Sent back" under Needs attention → updates → sends again → Morgan approves
//   Jordan sees it under Recently finished → reopens it → the history lists every one of those events
//   Taylor (stakeholder) and Riley (another organisation) asking for the task get "not found"
// Ends with screenshots of My Work and the task at phone + desktop, light + dark.
//
// Usage: node scripts/test-walkthrough/03-task-flow.mjs [--keep]   (--keep leaves the task in place; default tidies)
import { openBrowser, withBrowser, step, note, finish, hasFlag, tidy, query, closePool, PEOPLE, stoppedOn } from "./lib.mjs";

const DESKTOP = { width: 1280, height: 900 };
const tag = Math.random().toString(36).slice(2, 7);
const TITLE = `Rotate the API signing keys (${tag})`;
const NEXT_1 = "Draft the key rotation runbook";
const NEXT_2 = "Rotate the staging keys first";
const NEXT_3 = "Morgan to approve the production rotation window";
const BLOCKER = "Waiting on the vendor to issue the new keys";

tidy();
const [morgan] = await query("select id from users where email = $1", [PEOPLE.lead.email]);

const member = await openBrowser({ role: "member", ...DESKTOP });
const lead = await openBrowser({ role: "lead", ...DESKTOP });
let taskPath = null;

try {
  // --- create -------------------------------------------------------------------------------------------------
  await member.goto("/my-work", 4000);
  await member.waitFor("My Work", 30_000);
  await member.click("New task", { wait: 1200 });
  const titled = await member.type("#task-title", TITLE);
  await member.type("#task-next", NEXT_1);
  await member.click("Create task", { exact: true, wait: 2500 });
  step("Jordan creates a task from My Work", titled && (await member.waitFor("Task created.", 20_000)));
  step("the new task appears under Continue working", await member.waitForNear("Continue working", TITLE, { timeout: 20_000 }));
  step("its first next action is already on the row", await member.hasNear(TITLE, NEXT_1));

  // --- open and update -------------------------------------------------------------------------------------
  await member.click(TITLE, { wait: 1500 });
  const opened = await member.waitForPath(/^\/tasks\/[0-9a-f-]{36}$/, 30_000);
  taskPath = (await member.path()).split("?")[0];
  const taskId = taskPath.split("/").pop();
  step("opening the row lands on the task page", opened && (await member.waitFor("Next action", 20_000)), taskPath);
  step("the Resume card shows the next action before anything else", await member.hasNear("Next action", NEXT_1));

  await member.type(`#progress-${taskId}`, "Runbook drafted and reviewed with Sam.");
  await member.type(`#next-${taskId}`, NEXT_2);
  await member.click("Save update", { exact: true, wait: 2500 });
  step("saving an update confirms", await member.waitFor("Update saved.", 20_000));
  step("the Resume card now shows the new next action", await member.waitForNear("Next action", NEXT_2, { timeout: 20_000 }));
  step("the first update sits in the history", await member.has("posted an update"));

  // --- block ---------------------------------------------------------------------------------------------------
  await member.type(`#progress-${taskId}`, "Staging rotation can't start without the vendor's keys.");
  await member.type(`#next-${taskId}`, "Chase vendor support, then rotate staging");
  await member.click("I'm blocked", { wait: 800 });
  const reasonTyped = await member.type("What's blocking it?", BLOCKER);
  await member.type("Who or what can unblock it?", "Vendor support");
  await member.click("Save update", { exact: true, wait: 2500 });
  step("marking it blocked needs a reason and saves", reasonTyped && (await member.waitFor("Update saved.", 20_000)));
  step("the Resume card shows the red blocked strip with the reason", (await member.waitFor(BLOCKER, 20_000)) && (await member.has("Waiting on Vendor support")));
  await member.goto("/my-work", 3000);
  step("a blocked task sits under Waiting on others", await member.waitForNear("Waiting on others", TITLE, { timeout: 20_000 }));

  // --- unblock -------------------------------------------------------------------------------------------------
  await member.goto(taskPath, 3000);
  await member.waitFor("Mark unblocked", 20_000);
  await member.click("Mark unblocked", { exact: true, wait: 2000 });
  step("Mark unblocked puts it back in progress", (await member.waitFor("Status updated.", 20_000)) && (await member.waitForGone("Mark unblocked", 20_000)));
  step("the history records who unblocked it", await member.waitFor("unblocked it", 20_000));

  // --- send for approval -----------------------------------------------------------------------------------------
  await member.type(`#progress-${taskId}`, "Staging keys rotated; production window proposed for Thursday 02:00.");
  await member.type(`#next-${taskId}`, NEXT_3);
  const marked = await member.select(`#mark-${taskId}`, "awaiting_approval");
  const approverIsMorgan = (await member.evaluate(`document.querySelector("#approver-${taskId}")?.value ?? ""`)) === morgan.id;
  await member.click("Save update", { exact: true, wait: 2500 });
  step("Mark as → Awaiting approval offers the team lead as approver", marked && approverIsMorgan);
  step("the task is now awaiting Morgan's approval", (await member.waitFor("Update saved.", 20_000)) && (await member.waitFor("Awaiting approval from Morgan Lead", 20_000)));

  // --- the lead sends it back ------------------------------------------------------------------------------------
  await lead.goto(taskPath, 4000);
  await lead.waitFor("Awaiting approval", 30_000);
  step("Morgan sees Approve and Send back on the Resume card", (await lead.has("Approve")) && (await lead.has("Send back")));
  await lead.click("Send back", { exact: true, wait: 1000 });
  const noted = await lead.type("#send-back-note", "Add the rollback step to the runbook before production.");
  await lead.click("Send back", { exact: true, within: "[role=dialog]", wait: 2500 });
  step("sending it back needs a note and returns it to In progress", noted && (await lead.waitFor("Sent back.", 20_000)) && (await lead.waitForGone("Awaiting approval from", 20_000)));

  await member.goto("/my-work", 3000);
  step("Jordan sees it under Needs attention, marked Sent back", (await member.waitForNear("Needs attention", TITLE, { timeout: 20_000 })) && (await member.hasNear(TITLE, "Sent back")));
  await member.goto(taskPath, 3000);
  step("the note is in the history", await member.waitFor("Add the rollback step", 20_000));

  // --- again, then approved ----------------------------------------------------------------------------------------
  await member.type(`#progress-${taskId}`, "Rollback step added and rehearsed on staging.");
  await member.type(`#next-${taskId}`, NEXT_3);
  await member.select(`#mark-${taskId}`, "awaiting_approval");
  await member.click("Save update", { exact: true, wait: 2500 });
  step("Jordan sends it for approval again", (await member.waitFor("Update saved.", 20_000)) && (await member.waitFor("Awaiting approval from Morgan Lead", 20_000)));

  await lead.goto(taskPath, 3000);
  await lead.waitFor("Approve", 30_000);
  await lead.click("Approve", { exact: true, wait: 2500 });
  step("Morgan approves it", (await lead.waitFor("Approved.", 20_000)) && (await lead.waitFor("Completed just now", 20_000)));

  await member.goto("/my-work", 3000);
  step("Jordan sees it under Recently finished", await member.waitForNear("Recently finished", TITLE, { timeout: 20_000 }));

  // --- reopen --------------------------------------------------------------------------------------------------------
  await member.goto(taskPath, 3000);
  await member.waitFor("Completed", 20_000);
  await member.click("Change status", { wait: 800 });
  await member.click("In progress", { exact: true, wait: 2500 });
  step("reopening from the status menu works", (await member.waitFor("Status updated.", 20_000)) && (await member.waitFor("reopened it", 20_000)));

  // --- the history has it all ------------------------------------------------------------------------------------------
  const history = ((await member.text()) ?? "").toLowerCase();
  const expected = ["created the task", "posted an update", "marked it blocked", "unblocked it", "asked morgan lead to approve it", "sent it back", "approved it", "completed it", "reopened it"];
  const missing = expected.filter((phrase) => !history.includes(phrase));
  step("the history lists every event of the flow", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : `${expected.length} events`);

  // --- who may not see it ------------------------------------------------------------------------------------------------
  for (const [role, who] of [
    ["stakeholder", "a stakeholder"],
    ["other", "someone from another organisation"],
  ]) {
    await withBrowser({ role, ...DESKTOP }, async (browser) => {
      await browser.goto(taskPath, 4000);
      const refused = await browser.waitFor("you can't see it", 30_000);
      step(`${who} asking for the task gets not found`, refused && !(await browser.has(TITLE)));
    });
  }

  // --- screenshots: both sizes, both themes -------------------------------------------------------------------------------
  for (const dark of [false, true]) {
    for (const [name, size] of [
      ["desktop", DESKTOP],
      ["phone", { width: 390, height: 844 }],
    ]) {
      await withBrowser({ role: "member", dark, ...size }, async (browser) => {
        await browser.goto("/my-work", 4000);
        await browser.waitFor("Continue working", 30_000);
        note(await browser.shot(`03-my-work-${name}${dark ? "-dark" : ""}`, { full: name === "phone" }));
        await browser.goto(taskPath, 3000);
        await browser.waitFor("Next action", 30_000);
        note(await browser.shot(`03-task-${name}${dark ? "-dark" : ""}`, { full: true }));
        const problems = browser.problems.filter((problem) => !problem.includes("Download the React DevTools"));
        step(`no console errors or overflow on ${name}${dark ? " dark" : ""}`, problems.length === 0 && (await browser.overflow()).length === 0, problems[0] ?? "");
      });
    }
  }
} catch (error) {
  await stoppedOn(error, "03", { member, lead });
  step("the flow ran to the end", false, error instanceof Error ? error.message : String(error));
} finally {
  await member.close();
  await lead.close();
}

if (!hasFlag("keep")) tidy();
finish();
await closePool();
