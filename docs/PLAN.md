# Clarity — Build Plan (decisions are locked)

> **Status (2026-10-15):** Steps A, B and C, Phase 2 and Phase 3 are built. Everything in §2 exists except `/tasks/new` as a dialog-only route (it is also a page). Walkthroughs 01–05 and the vitest suites are the regression net; `npm run test:walk` runs them all. Deviations from this plan are recorded in `AGENTS.md`.

This file is the hand-off for anyone building Clarity. Read `docs/BRIEF.md` for intent; this file says *how*. Decisions here were made after reading the brief and the owner's answers on 2026-10-15 — follow them, don't re-open them. If something here is genuinely impossible, say so in the report rather than silently choosing differently.

Owner context: first real users are the owner's own dev team and their manager (small team, one org). The app is still multi-tenant, but onboarding stays short.

## 0. Ground rules

- Next.js **16.4.1** — read `node_modules/next/dist/docs/` before using any API; it differs from training data. `cacheComponents` and `partialPrefetching` stay on (already in `next.config.ts`).
- Strict TypeScript. `npm run typecheck` (`tsc --noEmit`) and `npm run lint` must pass at the end of every step.
- Keep dependencies minimal. **No** react-hook-form, Redis, queues, cron workers, or third-party integrations.
- Schema is managed with **`drizzle-kit push`** (`npm run db:push`), no migrations folder. Additive changes only once real data exists.
- Dev server: `npm run dev` → port **3014** (`AUTH_URL=http://localhost:3014` is already in `.env.local`). Never read or print values from `.env*`; the scripts load them with `dotenv`.
- Prod: VPS, pm2 via `ecosystem.config.js`, `deploy.sh` (owner runs it). Never deploy or commit unless asked.
- Mobile **and** desktop must both look good. Every screenshot check runs at 390×844 and 1280×900, and in light and dark.

## 1. Stack (exact)

| Concern | Choice |
| --- | --- |
| Auth | `next-auth@5.0.0-beta.32` (`beta` tag) + `@auth/drizzle-adapter`, **database sessions**, providers Google + Nodemailer magic link (SMTP from `SMTP_HOST`, `SMTP_PORT`, `EMAIL`, `EMAIL_PASS`). Reference implementation: `C:\Users\max\travelAdvantage\auth\auth.ts`, its `app/(basewebsite)/signin/page.tsx`, `db/index.ts`, `drizzle.config.ts`. |
| DB | `drizzle-orm` 0.45 + `drizzle-kit` 0.31 + `pg`. `DATABASE_URL` in `.env.local` (Postgres 16, database `clarity`, currently empty). |
| UI | Tailwind v4 (already wired through `@tailwindcss/turbopack`), **shadcn/ui** (Radix primitives, "new-york" style, neutral base), `lucide-react`, `sonner` toasts, `next-themes` for light/dark, `cmdk` via shadcn `command`. |
| Validation | `zod` v4 on the server in every action. |
| Dates | `Intl.DateTimeFormat` + a small `lib/time.ts`; `date-fns` allowed for arithmetic. Org timezone default `America/Jamaica`, per-user override; shown with relative text and an absolute tooltip. |
| Scripts | `tsx` for TS scripts, `dotenv`. Tests: walkthrough scripts (headless Chrome) + `vitest` for authorization unit tests. |

Fonts: keep **Geist Sans** + **Geist Mono** (already in `app/layout.tsx`).

## 2. Routes

```
/                         landing (short, static) → redirects to /overview when signed in
/login                    magic link + Google (server actions calling signIn)
/login/check-email
/invite/[token]           accept an organization invitation
/onboarding               create org → create team → invite (skip) → first task
(app) group, sidebar layout, all authenticated:
  /overview               role-aware home (member: resume + attention; lead/admin: team health; stakeholder: my requests)
  /my-work                attention · waiting on · recently finished (+ Resume My Work grouping)
  /tasks                  org task list: search, filters, sort (URL searchParams)
  /tasks/new              (also a dialog from anywhere: "N" shortcut / ⌘K)
  /tasks/[id]             task detail: Resume card first, then details, then history
  /team                   team dashboard (team picker when user is in several)
  /requests               list + "New request" (stakeholders see only their own)
  /requests/review        weekly review queue
  /requests/[id]
  /goals, /goals/[id]     Phase 2
  /reports                Phase 2 (team summary · contributions · stakeholder update)
  /my-impact              Phase 2
  /notifications          Phase 3
  /settings               profile, timezone, notification preferences
  /settings/organization  members, invitations, teams (admin)
/api/auth/[...nextauth]
/api/test-login           dev-only persona sign-in (see §8)
```

Navigation (sidebar desktop / bottom tabs phone): Overview · My Work · Team · Requests · Goals · Reports. Hidden per role: stakeholders see Overview + Requests only; Goals/Reports hidden until Phase 2 ships.

## 3. Tenancy, roles, visibility

- **Active organization** = cookie `clarity.org` (orgId). On every request the DAL validates the cookie against `organization_members`; if invalid it falls back to the user's first membership and rewrites the cookie. Org switcher in the sidebar sets it (server action) and redirects to `/overview`.
- **Org role** (`organization_members.role`): `admin` | `member` | `stakeholder`.
- **Team role** (`team_members.role`): `lead` | `member`. A "manager" is anyone who leads ≥1 team. Admins may act as lead on every team.
- **Visibility rules** (enforced in `lib/permissions.ts`, used by every DAL query and action):
  - admin: everything in the org.
  - member: read all tasks/requests/goals in the org; create tasks in teams they belong to; edit a task if they are assignee or creator, or lead the task's team; update progress on any task in their teams; triage requests only for teams they lead.
  - stakeholder: see only requests they submitted and tasks created from them (read-only), submit requests, see request decisions. Nothing else.
- Every DAL function takes a `Viewer` (`{ userId, orgId, orgRole, teamRoles: Map<teamId, 'lead'|'member'> , timezone }`) and filters by `orgId` in SQL. Resource lookups by id must also check `orgId` — never trust an id from the client.

## 4. Schema (Drizzle, all tables created in Step A)

IDs are `text` UUIDs (`crypto.randomUUID()`), timestamps `timestamp with time zone` with `defaultNow()`, server-generated. Auth.js tables exactly as the Drizzle adapter expects (`users`, `accounts`, `sessions`, `verification_tokens`, `authenticators` optional). Add to `users`: `timezone text`, `created_at`.

```
organizations        id, name, slug (unique), timezone (default 'America/Jamaica'), created_by, created_at
organization_members org_id, user_id, role (admin|member|stakeholder), joined_at, invited_by   PK(org_id,user_id)
teams                id, org_id, name, description, created_at                                   unique(org_id, name)
team_members         team_id, user_id, role (lead|member), added_at                             PK(team_id,user_id)
invitations          id, org_id, email (lowercased), org_role, team_id?, team_role?, token_hash (unique, sha256 of a 32-byte token), invited_by, expires_at (7 days), accepted_at?, created_at
projects             id, org_id, team_id, name, status (active|archived), created_at
goals                id, org_id, team_id?, title, description, owner_id, target_date?, success_criteria, status (active|achieved|dropped), created_at, updated_at
team_expectations    id, org_id, team_id, title, description, kind (milestone|count), target_count?, period_start, period_end, goal_id?, status (open|met|missed), created_at
requests             id, org_id, team_id, title, description, desired_outcome, urgency (low|normal|high|critical), link?, requester_id, status (new|under_review|approved|deferred|rejected|converted), decided_at?, decided_by?, decision_reason?, defer_until?, converted_task_id?, created_at, updated_at
request_decisions    id, request_id, decider_id, decision (under_review|approved|deferred|rejected|converted|reopened), reason, created_at   (append-only)
tasks                id, org_id, team_id, project_id?, request_id?, goal_id?, expectation_id?, title, description, assignee_id?, created_by, approver_id?, priority (low|normal|high|urgent default normal), size (s|m|l)?, status (not_started|in_progress|awaiting_approval|blocked|rejected|completed), due_date (date)?, started_at?, completed_at?, blocked_reason?, blocked_by?, rejection_reason?, latest_progress (text, denormalized), next_action (text, denormalized), completion_summary?, impact_note?, sort_rank (double, manual importance), created_at, updated_at
task_updates         id, task_id, author_id, progress, next_action, blocker?, created_at   (append-only; the Resume history)
task_evidence_links  id, task_id, url, label, added_by, created_at
task_activity        id, org_id, task_id, actor_id, kind (created|edited|status_changed|assigned|handed_over|due_changed|priority_changed|blocked|unblocked|approval_requested|approved|sent_back|rejected|completed|reopened|progress_updated|evidence_added|evidence_removed), before jsonb?, after jsonb?, note?, created_at   (append-only)
notifications        id, user_id, org_id, kind, title, body?, href, read_at?, created_at                       (Phase 3)
notification_preferences user_id PK, email_assignment bool, email_approval bool, email_request_decision bool, email_handover bool, email_due_soon bool
```

Indexes for the real queries: `tasks(org_id, team_id, status)`, `tasks(org_id, assignee_id, status)`, `tasks(org_id, due_date)`, `tasks(request_id)`, `tasks(goal_id)`, `task_activity(task_id, created_at desc)`, `task_activity(org_id, created_at desc)`, `task_updates(task_id, created_at desc)`, `requests(org_id, team_id, status)`, `requests(org_id, requester_id)`, `invitations(org_id)`, `organization_members(user_id)`, `team_members(user_id)`, `notifications(user_id, read_at)`.

Enums as `pgEnum`. Export `$inferSelect` types from `db/schema.ts`; shared string unions live in `lib/constants.ts` so UI and schema agree.

## 5. Task behaviour (the heart of the product)

- **Create**: title required; team defaults to the user's only team or the last used; assignee defaults to self; everything else optional. One dialog, two seconds.
- **Update Progress** (the signature action, available on the task page, in the list row hover menu, and from ⌘K): one compact form — *Latest progress* (textarea), *Next action* (textarea, required unless completing), optional *Blocker*, optional *Evidence link*, optional *Hand over to* (assignee picker). Inserts a `task_updates` row, copies progress/next action onto the task, writes `task_activity` rows (`progress_updated`, and `handed_over` / `assigned` when applicable) in **one transaction**.
- **Status transitions** (any → any, but each prompts for what the brief requires and records history):
  - → `blocked`: reason required, "who/what unblocks" optional. Clears when leaving blocked (`unblocked` activity).
  - → `awaiting_approval`: approver required (defaults to the team lead). Approver sees it under Attention Required. Approver actions: **Approve** → `completed` (activity `approved` + `completed`), **Send back** → `in_progress` with a note (`sent_back`).
  - → `completed`: optional completion summary and evidence link. Sets `completed_at`. From `completed` → anything else = `reopened` (clears `completed_at`, keeps history).
  - → `rejected`: reason required; task is kept, shown struck-through in lists filtered to "closed".
  - → `in_progress` first time sets `started_at`.
- **Resume card** on the task page, above everything else: *Next action* in large type, then *Latest progress*, *Blocker* (red strip if present), *Evidence* chips, last updated by/when, and the inline Update Progress form. History (`task_updates` then `task_activity`, merged, newest first, paginated 20) below the details.
- **Lists**: dense rows — status icon · title · next action (muted, truncated) · assignee avatar · due (relative, red when overdue) · priority glyph. Row click opens the task; hover/long-press shows quick actions (status, update progress, copy link).
- **My Work grouping** ("Resume My Work"): *Continue working* = in_progress/not_started assigned to me, ordered by: overdue → due soonest → urgent/high → sort_rank → updated_at. *Waiting on others* = awaiting_approval (I'm assignee) + blocked. *Needs attention* = overdue, due within 2 days, blocked, approvals where **I am the approver**, sent back. *Recently finished* = completed in last 14 days.
- **Team dashboard**: counts (active, completed in period, overdue, blocked, awaiting approval) → Attention Required list (blocked, approvals, due ≤3 days, overdue, unassigned, requests awaiting triage) each row opens the item → Workload (per member: active tasks grouped by size with titles on hover, blocked count, overdue count) → Outcomes (Phase 2: expectations) → Recent important activity (status changes to blocked/completed/rejected, approvals, due changes, request decisions; **not** edits or progress updates).

## 6. Requests

- New request form: title, description, desired outcome / business reason, urgency, optional link, **team** (required picker). Stakeholders can submit; so can members/leads/admins.
- Triage by that team's leads and org admins: Under review · Approve (optionally set priority/owner/due and convert immediately) · Defer (optional "revisit on" date) · Reject (reason required) · Convert to task (creates a task with `request_id`, copies title/description, sets request `converted`). Every decision = `request_decisions` row + request fields updated, one transaction.
- Review queue `/requests/review`: four sections — New (needs decision) · Deferred (revisit date passed, or all) · Commitments needing attention (blocked/overdue tasks in my teams) · Approved/converted in the last 7 days. Decisions happen inline.
- Requester sees status, decision reason, and the linked task's Resume card (read-only).

## 7. Design system

Calm, premium, monochrome-first. Think Linear's restraint with Things' friendliness.

- **Tokens** in `app/globals.css` as CSS variables (shadcn convention) in **oklch**. Light: background `oklch(0.99 0 0)`, surface `oklch(1 0 0)`, border `oklch(0.92 0 0)`, foreground `oklch(0.2 0 0)`, muted-foreground `oklch(0.5 0 0)`. Dark: background `oklch(0.16 0.005 260)`, surface `oklch(0.2 0.005 260)`, border `oklch(0.28 0.005 260)`, foreground `oklch(0.95 0 0)`. Primary button = foreground colour (near-black in light, near-white in dark). **Accent** for links/focus/selection only: `oklch(0.55 0.17 265)` (light) / `oklch(0.72 0.15 265)` (dark).
- **Status colours** (each as bg/fg/dot tokens, AA contrast in both themes): not_started neutral grey · in_progress blue (hue 250) · awaiting_approval amber (hue 80) · blocked red (hue 25) · rejected slate with strikethrough title · completed green (hue 150). Icons (lucide): Circle, CircleDot/Loader, Clock, OctagonAlert, XCircle, CheckCircle2.
- **Priority glyphs**: urgent = red double chevron, high = orange chevron, normal = none, low = muted down arrow.
- **Type**: Geist Sans; 13px dense UI text in lists, 14px body, 20/24px page titles, tracking-tight headings. Geist Mono for ids and timestamps in history.
- **Layout**: desktop sidebar 240px (org switcher top, nav, user menu bottom), content max-width 1200px with 24px gutters. Phone: top bar (org name, ⌘K search icon, avatar) + bottom tab bar (Overview · My Work · Team · Requests · More). Page header = title + one primary action (right). Cards with 1px border, 10px radius, no shadows except popovers.
- **Motion**: 150ms ease-out on hover/focus; no page transitions; skeletons via `loading.tsx` per segment.
- **Theme**: `next-themes` with class strategy, system default, toggle in user menu; both themes required for every component.
- **Empty states**: one sentence + one primary action, never a blank table.
- **Keyboard**: ⌘K / Ctrl+K command palette (search tasks/requests, "New task", "Update progress", navigate); `N` new task; `U` update progress on a task page; `/` focus search; `Esc` closes. Visible focus rings everywhere.

shadcn components to add: button, input, textarea, label, select, dialog, sheet, dropdown-menu, popover, command, tabs, badge, avatar, tooltip, separator, skeleton, checkbox, switch, scroll-area, sonner. Date input = native `<input type="date">` styled to match (no calendar dependency).

## 8. Test personas and the AI dev loop (build in Step A, keep working forever)

Copy the pattern from `C:\Users\max\science-fair-guide` (`lib/test-mode.ts`, `app/api/test-login/route.ts`, `scripts/test-accounts.ts`, `scripts/test-browser.mjs`, `scripts/test-walkthrough/lib.mjs`, `run-all.mjs`, `AGENTS.md`) and `C:\Users\max\travelAdvantage\app\api\test-login\route.ts` (the Auth.js v5 cookie name is `authjs.session-token`).

- Domain `@clarity.test`. Org **"Clarity Demo"** (slug `clarity-demo`, timezone America/Jamaica), one team **Engineering**, one project **Platform**.
- Personas (`?as=`): `admin` Avery Admin (org admin, not on the team) · `lead` Morgan Lead (member, Engineering lead) · `member` Jordan Dev (member, Engineering) · `member2` Sam Dev (member, Engineering) · `stakeholder` Taylor Ops (stakeholder).
- Seed realistic dev-team data: ~24 tasks across all six statuses with 1–4 updates each, evidence links (GitHub/Grafana-looking URLs), two overdue, two awaiting Morgan's approval, three blocked with reasons, six completed in the last two weeks; 6 requests across all states (two from Taylor); 3 goals; 2 expectations. Dates relative to "now" so the dashboard always looks alive. The seed is the brief's "clearly labelled demo environment" too — the org name says Demo.
- `npm run test:seed` (idempotent, rewrites `docs/TEST-ACCOUNTS.md`), `test:status`, `test:tidy` (reset the demo org to the seeded state), `test:clean` (delete the org, its data and the `.test` users). Scripts only ever touch orgs whose members are all `.test` accounts.
- `GET /api/test-login?as=<persona>&secret=<TEST_MODE_SECRET>&to=/path`: dev builds only, 404 otherwise, timing-safe secret compare, only `.test` personas, 12-hour session row + `authjs.session-token` cookie.
- `scripts/test-browser.mjs <persona|public> [path] [--width --height --dark --full]` → PNG in `.test-shots/` (git-ignored), prints overflow and console errors. `--dark` sets `prefers-color-scheme: dark` emulation.
- `scripts/test-walkthrough/`: `01-sign-in` (every persona lands right, bad secret refused) · `02-pages` (every route, every persona, phone+desktop, light+dark, no console errors, no overflow) · `03-task-flow` (create → progress → block → unblock → approval → approve; reopen) · `04-requests` (stakeholder submits → lead defers → approves → converts → stakeholder sees linked task) · `05-roles` (stakeholder cannot open team task, member cannot triage, cross-org id returns not-found). `npm run test:walk` runs all.
- `vitest` unit tests for `lib/permissions.ts` and the DAL's org scoping (use a second seeded org "Other Co" with `.test` members to prove cross-org isolation).
- No email is ever sent to a `.test` address (check in the mailer). `AGENTS.md` documents all of this under "You can sign in and use the app yourself — do it". `.claude/settings.json` denies `Read(**/.env)` and `Read(**/.env.*)`.

## 9. Code layout

```
app/                 routes (see §2); (app)/layout.tsx = shell; loading.tsx per segment
components/ui/       shadcn
components/          app components by feature (tasks/, requests/, team/, shell/, ...)
actions/             'use server' files per feature; each action: zod parse → requireViewer → permission → transaction → activity → revalidatePath/refresh → ActionResult
lib/auth.ts          NextAuth config + `auth()`; lib/viewer.ts = requireViewer()/getViewer() (React cache)
lib/dal/             queries (tasks.ts, requests.ts, team.ts, orgs.ts, ...), all take Viewer and scope by org_id
lib/permissions.ts   pure predicates, unit-tested
lib/mail/            provider.ts (interface), nodemailer.ts, console.ts (dev/test), templates
lib/test-mode.ts, lib/time.ts, lib/constants.ts, lib/action-result.ts, lib/log.ts (structured JSON logger)
db/schema.ts, db/index.ts, drizzle.config.ts
scripts/             test-accounts.ts, test-browser.mjs, test-walkthrough/
docs/                BRIEF.md, PLAN.md, TEST-ACCOUNTS.md (generated)
```

Cache components: the `(app)` layout keeps session-dependent parts (org switcher, user menu) inside `<Suspense>`; every page has a `loading.tsx` skeleton so dynamic reads are inside a boundary. If validation still blocks a route, `export const instant = false` on that page is the accepted escape hatch. Do **not** use `use cache` on task/request data — it must always be fresh.

## 10. Steps

- **A — Foundation**: deps, schema + push, auth + login, viewer/DAL/permissions skeleton, test mode + seed + browser scripts + AGENTS.md + settings deny, shell + tokens + theme, onboarding, org switcher, settings (profile, organization members/invitations/teams). Ends with `01-sign-in` passing.
- **B — Tasks**: task list/filters, create dialog, detail with Resume card, Update Progress, status transitions, activity history, My Work, ⌘K palette. Ends with `03-task-flow` passing and screenshots of My Work + task detail in both sizes/themes.
- **C — Team & Requests & Overview**: team dashboard, requests + review queue, role-aware overview, `02-pages`, `04-requests`, `05-roles`, vitest authz tests.
- **Phase 2**: goals, expectations, reports (team summary, contributions, stakeholder update), my-impact, Markdown/CSV export, print CSS.
- **Phase 3**: notifications + preferences + email templates, saved filters, keyboard polish, onboarding polish, "load demo data" for new orgs.

Each step ends with: `npm run typecheck`, `npm run lint`, `npm run build` exit 0; the relevant walkthrough green; screenshots reviewed at both sizes and themes.
