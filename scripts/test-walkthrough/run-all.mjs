// Runs every walkthrough in order and sums up. Needs `npm run dev` on port 3014 and `npm run test:seed` done once.
// Usage: npm run test:walk            (or: node scripts/test-walkthrough/run-all.mjs [--skip=02] [--only=03,04])
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const skip = (flag("skip") ?? "").split(",").filter(Boolean);
const only = (flag("only") ?? "").split(",").filter(Boolean);

const scripts = readdirSync(here)
  .filter((name) => /^\d\d-.*\.mjs$/.test(name))
  .sort()
  .filter((name) => !skip.some((prefix) => name.startsWith(prefix)))
  .filter((name) => only.length === 0 || only.some((prefix) => name.startsWith(prefix)));

const results = [];
for (const script of scripts) {
  console.log(`\n=================== ${script} ===================`);
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(here, script)], { stdio: "inherit" });
  results.push({ script, ok: run.status === 0, seconds: Math.round((Date.now() - started) / 1000) });
}

// Leave the demo orgs as they were found.
spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/test-accounts.ts", "tidy"], { stdio: "inherit" });

console.log("\n=================== summary ===================");
for (const result of results) console.log(`${result.ok ? "ok  " : "FAIL"} ${result.script} (${result.seconds}s)`);
process.exitCode = results.every((result) => result.ok) ? 0 : 1;
