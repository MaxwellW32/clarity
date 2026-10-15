// Shared by the walkthrough scripts: step logging with a pass / fail summary, browsers that always get closed,
// argument flags, the seeded test data (keep in step with lib/test-mode.ts), and a tidy-up between runs.
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import { Pool } from "pg";
import { openBrowser, sleep, cleanPath, DEFAULT_BASE_URL, testSecret, PERSONAS } from "../test-browser.mjs";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

export { openBrowser, sleep, cleanPath, DEFAULT_BASE_URL, testSecret, PERSONAS };

/** The seeded people and orgs: the same values as lib/test-mode.ts (which scripts cannot import). */
export const TEST_DOMAIN = "@clarity.test";
export const PEOPLE = {
  admin: { email: `avery${TEST_DOMAIN}`, name: "Avery Admin" },
  lead: { email: `morgan${TEST_DOMAIN}`, name: "Morgan Lead" },
  member: { email: `jordan${TEST_DOMAIN}`, name: "Jordan Dev" },
  member2: { email: `sam${TEST_DOMAIN}`, name: "Sam Dev" },
  stakeholder: { email: `taylor${TEST_DOMAIN}`, name: "Taylor Ops" },
  other: { email: `riley${TEST_DOMAIN}`, name: "Riley Other" },
};
export const ORG = { name: "Clarity Demo", slug: "clarity-demo", team: "Engineering" };
export const OTHER_ORG = { name: "Other Co", slug: "other-co", team: "Support" };
export const HOME = "/overview";

const args = process.argv.slice(2);
export const flag = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
export const hasFlag = (name) => args.includes(`--${name}`);
// --only=A,B runs just those parts of a script
export const only = (part) => flag("only") === undefined || flag("only").split(",").includes(part);

const steps = [];

// One line per step, and a summary at the end that also sets the exit code.
export function step(name, ok, detail = "") {
  steps.push({ name, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

export function note(text) {
  console.log(`     ${text}`);
}

export function finish() {
  const failed = steps.filter((each) => !each.ok);
  console.log(
    failed.length === 0
      ? `\nAll ${steps.length} steps passed.`
      : `\n${failed.length} of ${steps.length} steps failed: ${failed.map((each) => each.name).join("; ")}`,
  );
  process.exitCode = failed.length === 0 ? 0 : 1;
  return failed.length === 0;
}

export async function withBrowser(options, run) {
  const browser = await openBrowser(options);
  try {
    return await run(browser);
  } finally {
    await browser.close();
  }
}

// A screenshot of every browser when a flow stops half way, so the failure can be looked at.
export async function stoppedOn(error, tag, browsers) {
  console.log(`stopped: ${error instanceof Error ? error.message : error}`);
  for (const [name, browser] of Object.entries(browsers)) {
    try {
      console.log(`     ${await browser.shot(`${tag}-stopped-${name}`, { full: true })}`);
    } catch {
      /* the browser may be gone */
    }
  }
}

// Puts both demo orgs back to the seeded state (scripts/test-accounts.ts tidy).
export function tidy() {
  const run = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/test-accounts.ts", "tidy"], { stdio: "inherit" });
  if (run.status !== 0) throw new Error("tidy failed — is the database reachable?");
}

let pool = null;
// One-off reads of test data (an org's id, a task's id). Only ever used on test rows.
export async function query(text, params = []) {
  if (pool === null) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return (await pool.query(text, params)).rows;
}

export async function closePool() {
  if (pool !== null) await pool.end();
  pool = null;
}

// Does the page show Next's own error or not-found screen (dev overlay included)?
export async function pageBroken(browser) {
  const text = ((await browser.text()) ?? "").toLowerCase();
  const overlay = await browser.evaluate(
    `(() => { const p = document.querySelector("nextjs-portal"); const t = p?.shadowRoot?.textContent ?? ""; return /unhandled|runtime error|server error|build error/i.test(t) })()`,
  );
  const notFound = text.includes("this page could not be found");
  return {
    error: overlay === true || text.includes("internal server error") || text.includes("application error") || text.includes("server-side exception"),
    notFound,
    // Next's own not-found page is only a line long — that is not a blank page.
    blank: text.trim().length < 40 && !notFound,
  };
}
