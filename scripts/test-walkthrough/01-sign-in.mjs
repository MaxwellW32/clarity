// Signs in as every persona and checks where each one lands and what their navigation offers, that the front door
// routes by audience (visitors to sign in, signed-in people past the landing and login pages), that the active-org
// cookie is checked against membership, that signing out works, and that the test sign-in itself refuses a wrong
// secret, an unknown persona and an off-site redirect.
//
// Also: a brand-new account goes through onboarding, and a refresh or a detour never loses the step.
//
// Usage: node scripts/test-walkthrough/01-sign-in.mjs [--only=landing,routing,org,signout,onboarding,guard]
import { openBrowser, withBrowser, step, finish, only, testSecret, DEFAULT_BASE_URL, PEOPLE, ORG, OTHER_ORG, HOME, query, closePool } from "./lib.mjs";

const firstName = (persona) => PEOPLE[persona].name.split(" ")[0];

if (only("landing")) {
  console.log("— landing —");
  const LANDINGS = [
    // persona, size, words that must be on /overview, words that must not be
    ["admin", "desktop", [ORG.name, "Admin", firstName("admin"), "Invite people", ORG.team], []],
    ["lead", "desktop", [ORG.name, firstName("lead"), "Team dashboard", ORG.team, "lead", "My Work", "Pick up where you left off"], ["Invite people"]],
    ["member", "phone", [ORG.name, firstName("member"), ORG.team], ["Invite people"]],
    ["member2", "desktop", [firstName("member2"), ORG.team], []],
    ["stakeholder", "desktop", [firstName("stakeholder"), "New request", "Requests"], ["My Work", "Team dashboard"]],
    ["other", "desktop", [OTHER_ORG.name, firstName("other"), OTHER_ORG.team], [ORG.name]],
  ];
  for (const [role, size, words, absent] of LANDINGS) {
    const desktop = size === "desktop";
    await withBrowser({ role, width: desktop ? 1280 : 390, height: desktop ? 900 : 844 }, async (browser) => {
      const landed = await browser.goto(HOME, 4500);
      const missing = [];
      for (const word of words) if (!(await browser.waitFor(word, 30_000))) missing.push(word);
      const present = [];
      for (const word of absent) if (await browser.has(word)) present.push(word);
      const ok = landed.split("?")[0] === HOME && missing.length === 0 && present.length === 0;
      step(`${role} lands on ${HOME} (${size})`, ok, [missing.length ? `missing: ${missing.join(", ")}` : "", present.length ? `should not show: ${present.join(", ")}` : "", landed].filter(Boolean).join(" · "));
      if (browser.problems.length > 0) console.log(`     console: ${JSON.stringify(browser.problems.slice(0, 3))}`);
      await browser.shot(`01-${role}-${size}`);
    });
  }
}

if (only("routing")) {
  console.log("\n— the front door routes by audience —");
  const VISITS = [
    // persona, the page asked for, where they must end up, what that proves
    ["public", HOME, "/login", "a visitor asking for the app is sent to sign in"],
    ["public", "/settings/organization", "/login", "a visitor cannot open organization settings"],
    ["public", "/", "/", "a visitor sees the landing page"],
    ["lead", "/", HOME, "a signed-in person on the landing page goes to their overview"],
    ["lead", "/login", HOME, "a signed-in person asking to log in goes to their overview"],
    ["stakeholder", "/my-work", HOME, "a stakeholder asking for My Work is sent to their overview"],
  ];
  const browsers = new Map();
  try {
    for (const [role, asked, expected, proves] of VISITS) {
      if (!browsers.has(role)) browsers.set(role, await openBrowser({ role, width: 1280, height: 900 }));
      const browser = browsers.get(role);
      await browser.goto(asked, 2500);
      const landed = (await browser.settle()).split("?")[0].split("#")[0];
      let ok = landed === expected;
      if (ok && role === "public" && asked === "/") ok = await browser.has("Less time managing work");
      step(proves, ok, `${role}: ${asked} -> ${landed}`);
    }
  } finally {
    for (const browser of browsers.values()) await browser.close();
  }
}

if (only("org")) {
  console.log("\n— the active-org cookie is checked against membership —");
  const [demo] = await query("select id from organizations where slug = $1", [ORG.slug]);
  // Riley (Other Co) plants Clarity Demo's id in the cookie: not a member, so the app falls back to Other Co.
  await withBrowser({ role: "other", width: 1280, height: 900 }, async (browser) => {
    await browser.goto(HOME, 3500);
    await browser.send("Network.setCookie", { name: "clarity.org", value: demo.id, url: DEFAULT_BASE_URL, httpOnly: true, path: "/" });
    await browser.goto(HOME, 3500);
    await browser.waitFor(OTHER_ORG.name, 20_000);
    const leaked = await browser.has(ORG.name);
    step("a cookie naming an org you don't belong to is ignored", !leaked && (await browser.has(OTHER_ORG.name)), leaked ? `showed ${ORG.name}` : "");
  });
  await withBrowser({ role: "lead", width: 1280, height: 900 }, async (browser) => {
    await browser.goto(HOME, 3500);
    await browser.send("Network.setCookie", { name: "clarity.org", value: "not-an-org", url: DEFAULT_BASE_URL, httpOnly: true, path: "/" });
    await browser.goto(HOME, 3500);
    step("a garbage org cookie falls back to the first membership", await browser.waitFor(ORG.name, 20_000));
  });
}

if (only("signout")) {
  console.log("\n— signing out —");
  await withBrowser({ role: "lead", width: 1280, height: 900 }, async (browser) => {
    await browser.goto(HOME, 3500);
    await browser.waitFor(ORG.name, 20_000);
    const opened = await browser.click("Account menu", { wait: 800 });
    const clicked = opened && (await browser.click("Sign out", { exact: true, wait: 500 }));
    const out = clicked && (await browser.waitForPath("/login", 20_000));
    step("signing out from the account menu lands on sign in", out, (await browser.path()) ?? "");
    await browser.goto(HOME, 2500);
    const after = (await browser.settle()).split("?")[0];
    step("after signing out the app asks for sign-in again", after === "/login", after);
  });
}

if (only("onboarding")) {
  console.log("\n— onboarding is resumable (a throwaway .test account, removed afterwards) —");
  const tag = Math.random().toString(36).slice(2, 8);
  const email = `onboard-${tag}${"@clarity.test"}`;
  const [user] = await query("insert into users (id, email, name, email_verified) values ($1, $2, $3, now()) returning id", [crypto.randomUUID(), email, "Olive Onboard"]);
  const token = crypto.randomUUID();
  await query("insert into sessions (session_token, user_id, expires) values ($1, $2, now() + interval '1 hour')", [token, user.id]);
  const orgName = `Onboard ${tag}`;
  try {
    await withBrowser({ role: "public", width: 390, height: 844 }, async (browser) => {
      await browser.send("Network.setCookie", { name: "authjs.session-token", value: token, url: DEFAULT_BASE_URL, httpOnly: true, path: "/" });
      await browser.goto(HOME, 3500);
      const first = (await browser.settle()).split("?")[0];
      step("a new account with no organisation is sent to onboarding", first === "/onboarding" && (await browser.waitFor("Organisation name", 20_000)), first);
      await browser.type("Your company or group", `${orgName} typo`);
      await browser.click("Create organisation", { exact: true, wait: 3000 });
      step("creating the organisation moves to the team step", await browser.waitFor("Team name", 20_000));
      await browser.send("Page.reload", {});
      await browser.settle();
      step("refreshing stays on the team step", (await browser.waitFor("Team name", 20_000)) && !(await browser.has("Organisation name")));
      await browser.goto(HOME, 3000);
      const bounced = (await browser.settle()).split("?")[0];
      step("an admin whose org has no team is sent back to onboarding", bounced === "/onboarding" && (await browser.waitFor("Team name", 20_000)), bounced);
      await browser.click("Back", { exact: true, wait: 2500 });
      await browser.waitFor("Organisation name", 20_000);
      const prefilled = await browser.evaluate(`document.querySelector("#org-name")?.value ?? null`);
      step("Back shows the organisation step filled in", prefilled === `${orgName} typo`, String(prefilled));
      await browser.type("#org-name", orgName);
      await browser.click("Save organisation", { exact: true, wait: 3000 });
      const [renamed] = await query("select o.name from organizations o join organization_members m on m.org_id = o.id where m.user_id = $1", [user.id]);
      step("saving renames the organisation and returns to the team step", renamed?.name === orgName && (await browser.waitFor("Team name", 20_000)), renamed?.name);
      await browser.type("Your team's name", "Apex Test");
      await browser.click("Create team", { exact: true, wait: 3000 });
      step("creating the team moves to the invite step", await browser.waitFor("Invite your colleagues", 20_000));
      await browser.click("Skip for now", { exact: true, wait: 2500 });
      step("skipping reaches the done step", await browser.waitFor("Go to overview", 20_000));
      await browser.click("Go to overview", { exact: true, wait: 3000 });
      const landed = await browser.waitForPath(HOME, 20_000);
      step("the done step lands on the overview of the new org", landed && (await browser.waitFor(orgName, 20_000)) && (await browser.waitFor("Apex Test", 20_000)));
      if (browser.problems.length > 0) console.log(`     console: ${JSON.stringify(browser.problems.slice(0, 3))}`);
    });
  } finally {
    // Only this run's org (its sole member is the throwaway account) and the account itself.
    await query(
      "delete from organizations o where o.id in (select org_id from organization_members where user_id = $1) and not exists (select 1 from organization_members m where m.org_id = o.id and m.user_id <> $1)",
      [user.id],
    );
    await query("delete from users where id = $1 and email like '%@clarity.test'", [user.id]);
  }
}

if (only("guard")) {
  console.log("\n— the test sign-in itself —");
  const secret = testSecret();
  const probe = async (queryString) => {
    const response = await fetch(`${DEFAULT_BASE_URL}/api/test-login?${queryString}`, { redirect: "manual" });
    const body = response.status >= 400 && response.headers.get("content-type")?.includes("json") ? await response.json() : null;
    return { status: response.status, location: response.headers.get("location") ?? "", error: body?.error ?? "" };
  };
  let result = await probe(`as=lead&secret=${encodeURIComponent(secret.slice(0, -1) + (secret.endsWith("x") ? "y" : "x"))}`);
  step("a wrong secret gets a plain 404", result.status === 404, `${result.status}`);
  result = await probe("as=lead");
  step("no secret gets a plain 404", result.status === 404, `${result.status}`);
  result = await probe(`as=owner&secret=${encodeURIComponent(secret)}`);
  step("an unknown persona is refused", result.status === 400, `${result.status} ${result.error}`);
  result = await probe(`as=lead&secret=${encodeURIComponent(secret)}&to=//evil.example`);
  step(
    "a protocol-relative 'to' is ignored",
    (result.status === 307 || result.status === 302) && new URL(result.location, DEFAULT_BASE_URL).pathname === HOME && new URL(result.location, DEFAULT_BASE_URL).host === new URL(DEFAULT_BASE_URL).host,
    `${result.status} -> ${result.location}`,
  );
  result = await probe(`as=admin&secret=${encodeURIComponent(secret)}&to=/settings/organization`);
  step("'to' lands on the page asked for", new URL(result.location, DEFAULT_BASE_URL).pathname === "/settings/organization", `${result.status} -> ${result.location}`);
}

finish();
await closePool();
