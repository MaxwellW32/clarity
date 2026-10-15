# Clarity — Product Brief

> Original brief supplied by the owner on 2026-10-15 (product name was "The Tracker"; the product is now **Clarity**). This is the statement of intent. Where it conflicts with `docs/PLAN.md`, the plan wins — the plan records the decisions made after reading this.

## 1. Mission

Design and build **Clarity**, a polished, fast, intuitive SaaS application that makes team productivity, accountability, progress, and business value exceptionally clear.

As thoughtfully designed as Linear, as approachable as Todoist, as immediately useful to management as a well-designed executive dashboard — but with its own identity:

**"Less time managing work. More time doing it. Clear evidence of what matters."**

The primary product goal is to make work easier to organize, resume, evaluate, communicate, and justify. The software must be impressive in its simplicity, not its number of features.

## 2. Technology Stack

Next.js App Router + TypeScript · PostgreSQL · Drizzle ORM/Kit · Auth.js (Google OAuth + email magic links) · Tailwind CSS · shadcn/ui on Radix · Lucide React · Zod · email provider abstraction (magic links, invitations, notifications) · self-hosted Node.js + PostgreSQL.

Favor React Server Components for data-driven views; client components only where interaction requires them. Server actions or route handlers for mutations. All data access authenticated, authorized, scoped to its organization, and validated on the server. A real, maintainable application, not mockup screens.

## 3. Product Philosophy

Every feature must pass three tests: Does it save users time? Does it improve visibility or accountability? Does it help users make a better decision? If no to all three, remove it.

Three levels of visibility:

- **Employee:** "What should I do, where did I stop, and what's next?"
- **Manager:** "Is my team on track, what's blocking delivery, and where do I need to intervene?"
- **Executive / Stakeholder:** "What value are we getting, how are we performing against expectations, and what requires a decision?"

Encourage accurate reporting without becoming surveillance software. No time tracking, screenshots, activity monitoring, productivity scores, or gamification in the MVP. Prioritize genuine work outcomes.

## 4. User Roles and Organization Model

Multi-tenant: multiple organizations, each with its own members, teams, projects, tasks, requests, goals, and reporting.

- **Organization Admin** — settings, users, invitations, teams; organizational goals and expectations; organizational reports.
- **Manager / Team Lead** — view and manage their team's work; assign tasks and review requests; identify blockers and pending approvals; team performance and outcome reporting; configure team expectations.
- **Team Member** — manage assigned work; create tasks; submit progress updates and handovers; raise blockers; submit requests; see own contributions and history.
- **Stakeholder / Requester** — submit requests with the business need; follow progress of approved requests; view relevant outcomes and decisions; only access information explicitly shared with them.

A user may belong to multiple organizations and teams. Authorization by organization membership, role, team scope, and resource-level permissions. Never rely on client-side role checks for security.

## 5. Core Feature: Tasks

A task captures: title, short description, organization and team, project (optional), assignee, creator/requester, created date, due date (optional), completed date, priority, status, latest progress, next action, blocker reason, links/evidence, business goal association (optional), business impact / work size (optional, lightweight), activity history.

**Statuses:** Not Started · In Progress · Awaiting Approval · Blocked · Rejected · Completed. Clearly distinguishable, accessible indicators. Each status has meaningful behavior:

- **Blocked** → prompt for a brief reason and optionally who/what could unblock it.
- **Awaiting Approval** → identify the approver.
- **Completed** → optionally request a completion summary or evidence link.
- **Rejected** → preserve the reason and decision history.

Users must be able to update a task without a long form.

**Critical UX requirement:** the task detail view immediately answers *What is this? What has happened? What happens next? Who needs to act?* — not buried in an activity feed.

## 6. Signature Feature: Resume My Work

Every task prominently shows: **Latest Progress** (most recently accomplished) · **Next Action** (exactly what happens next — most prominent) · **Blocker** (if any) · **Evidence** (links, tickets, commits).

Example — *Investigate failed overnight backup*: Latest Progress: "Confirmed the backup repository is reachable. Reviewed failed job logs; identified a transport-related error." Next Action: "Check proxy server connectivity and rerun the affected job." Blocker: "Awaiting network team confirmation." Evidence: link to job logs.

UX: a compact **Update Progress** action that takes seconds. Reopening a task shows latest progress and next action before history. Prior updates preserved chronologically. Optional handover to a teammate. A **Resume My Work** view groups tasks: Continue working · Waiting on others · Needs attention · Recently completed. Do not duplicate the whole task UI.

## 7. My Work — Employee Experience

Focused personal workspace. **What needs my attention?** (assigned tasks ordered by due date, status, priority, manual importance) · **Waiting On** (approvals, other teams, dependencies — not framed as neglect) · **Recently Finished** (with evidence and dates) · **My Contributions** (deliverables over a selectable period; daily/weekly/monthly).

Employees can: add a task quickly; update status in one or two interactions; add progress + next action; raise a blocker; copy/open evidence; complete a task; search; filter and sort simply. Excellent keyboard navigation, focus states, responsive layouts.

## 8. Team Dashboard — Manager Experience

Open it and instantly understand operational health.

- **A. Work Overview** — active, completed (period), overdue, blocked, awaiting approval. Operational counts, not ratings.
- **B. Attention Required** — blocked deliverables, approvals needing action, approaching deadlines, overdue commitments, unassigned work, requests awaiting triage. Each actionable, opens the work.
- **C. Team Workload** — who owns what active work and major commitments; nature and size, not just counts; spot overload and uneven distribution.
- **D. Team Outcomes** — deliveries against agreed objectives ("8 of 10 planned deliverables completed", "2 commitments at risk"), with drill-down.
- **E. Recent Decisions and Activity** — compact feed of important changes only (major completion, request approved, deadline changed, blocker raised/resolved, rejection with reason).

## 9. Fair Performance and Value Reporting

Never treat task count as performance. Configurable framework based on agreed deliverables, timeliness against commitments, quality/acceptance, impact on objectives, significant resolved problems, context around blockers and scope changes.

**Expectations:** managers define lightweight team/project expectations (measurable or milestone-based): "Deliver three agreed milestones this month", "Complete the quarterly compliance review".

**Reports** show expected vs delivered outcomes, outstanding commitments, blocked/deferred, evidence, impact summaries. Distinguish **facts** (dates, statuses, approvals) from **interpretation**. No arbitrary percentages, automatic rankings, or false precision. MVP uses human-entered impact descriptions and explicitly agreed expectations — no AI scoring.

**My Impact:** personal contributions page — "What did I accomplish, and why did it matter?" Date range; key deliverables; supported goals; problems solved; evidence; outstanding dependencies; concise shareable summary. Useful for one-on-ones, reviews, promotions.

## 10. Company Goals and Alignment

Lightweight Goals: description, owner, target date, success criteria, linked work, progress against milestones, completed contributions. Tasks/projects optionally link to a goal. Click a goal → see contributing work. Not an OKR platform.

## 11. Requests and Backlog Management

Quick intake: title, description, requester, desired outcome / business reason, urgency, optional link, date. All requests enter a triage queue; a request never auto-becomes a task or deadline.

States: New · Under Review · Approved · Deferred · Rejected · Converted to Work. Reviewers approve/defer/reject/convert, recording decision, decider, date, brief reason, optional priority/owner/deadline. The request stays linked to any task created from it.

**Weekly Review Queue:** new requests needing decisions · deferred requests to reconsider · existing commitments needing attention · requests approved this period. Decide directly from this view. Encourage real prioritization, not endless backlog.

## 12. Auditability and Accountability

Audit history for ownership, status transitions, due date changes, approvals/rejections, blocker changes, completion/reopening, request decisions, material edits to progress or evidence. Who and when, server timestamps, never silently overwrite history. Users may correct mistakes while retaining history. Audit is evidence, not surveillance. Never claim reviewed/completed/approved unless the event exists.

## 13. Search, Filtering, and Views

Minimal navigation: **Overview** (role-aware) · **My Work** · **Team** · **Requests** · **Goals** · **Reports**. Settings/org admin in a secondary menu. Hide what the role can't access. Polished list view with search, status/owner/priority/due filters, sort, saved filter state. No Kanban/Gantt/calendar before the core is excellent.

## 14. Product Design Direction

Premium, calm, modern, remarkably understandable. Clean typography, strong hierarchy, subtle borders, restrained palette, excellent spacing, minimal noise, helpful empty states, tasteful microinteractions, consistent controls and status treatments, light and dark modes, responsive desktop + mobile, accessible contrast. No oversized dashboards, gradients, excessive animation, crowded nav. **Every important screen has one clear primary action.**

**First use:** create org → create/select team → invite (optional) → first task/request → useful dashboard. Realistic example data in a clearly labeled demo environment.

**Delightful details:** inline editing, keyboard shortcuts, clear success feedback, friendly empty states, copy-link actions, contextual actions, sensible defaults, loading skeletons, human-readable dates, thoughtful destructive confirmations.

## 15. Database Architecture

Normalized PostgreSQL via Drizzle. Expected entities: users, Auth.js tables, organizations, organization_members, teams, team_members, invitations, projects, tasks, task_updates, task_activity, goals, task–goal links, requests, request_decisions, team_expectations, task_evidence_links, notification_preferences (refine/consolidate as appropriate). Foreign keys, constraints, indexes designed around task-list, dashboard, and report queries. Consistent timestamps; display in the user's timezone. Immutable events vs editable state. Strict multi-tenant scoping enforced in the data layer.

## 16. Authentication and Invitations

Auth.js: Google, email magic link, secure sessions, org invitations, join via valid invitation, multiple memberships, active-org switching, secure logout. Graceful handling of expired links. An unverified email must never impersonate an existing member. Reusable email provider abstraction.

## 17. Reports Managers Actually Want

Date range + filters by team/project/employee. **Team Summary** (planned, delivered, open, blocked, outstanding decisions, goals advanced) · **Individual Contributions** (factual, no misleading comparisons) · **Stakeholder Update** (outcomes, in progress, blockers, pending requests, upcoming commitments). Print-friendly; Markdown/text export; CSV for tables. Deterministic from stored data, no AI.

## 18. Notifications

Minimal: assignment, approval requested, request approved/rejected, mention/handover, blocker requiring action, approaching due date (opt-in). User preferences; low frequency; each leads to an action. No chat.

## 19. Engineering Requirements

Strict TypeScript; separation of UI / business logic / data access; reusable components; server-side Zod validation; consistent errors; loading/empty states; transactions for multi-step changes; duplicate-operation prevention; paginated histories; indexes; access control; no secrets in client; env validation; schema management; seed data; secure tokens; structured logging; accessibility; automated tests for critical workflows, especially authorization (cross-org, assignment, approvals, invitations, reporting). Minimal dependencies; no microservices, queues, Redis, or background infrastructure without demonstrated need.

## 20. Key User Journeys

- **A — Employee resumes interrupted work:** sign in → tasks needing attention → open task → see previous progress + next action → work → short update → clear next action. Exceptionally fast.
- **B — Manager checks team health:** sign in → blockers, overdue, approvals, outcomes → open a blocked task → read and intervene → back to dashboard. No report generation needed.
- **C — Stakeholder submits a request:** submit → review queue → manager reviews → approve/defer/reject with reason → approved becomes linked work → stakeholder follows progress.
- **D — Employee demonstrates contributions:** My Impact → pick month/quarter → deliverables + evidence → goals supported → export summary.
- **E — Weekly review:** open review → outstanding requests and commitments → discuss → record decisions → assign approved items → everyone knows what's next.

## 21. What NOT to Build Initially

AI assistants or auto-written evaluations; timesheets; surveillance; payroll/invoicing; accounting; chat; automation builders; Gantt; dozens of statuses; dependency graphs; workload forecasting; gamification/leaderboards; custom report builders; broad integrations; enterprise configuration. Must remain valuable to a team of five.

## 22. Implementation Priorities

- **Phase 1 — Core MVP:** auth; organizations and membership; roles and access control; teams; tasks and assignment; status updates; handover/resume; personal workspace; manager dashboard; requests and decisions; activity history. Genuinely useful alone.
- **Phase 2 — Demonstrating Value:** goals; team expectations; contribution summaries; team reporting; stakeholder updates; evidence-based outcomes; export.
- **Phase 3 — Operational Polish:** notifications; saved views; keyboard interactions; refined onboarding; performance; usability.

## 23–25. Process, Acceptance, Principle

Define the smallest compelling experience → navigation and journeys → schema and authorization → visual system → reusable components → incremental plan → implement. Real database-backed functionality, no placeholder stats. Polished vertical slice before expanding. Consolidate features that solve the same problem.

**Success:** employees find their next task, resume without reconstructing context, update in seconds, show what they delivered. Managers understand team status in under 60 seconds, see bottlenecks, triage requests, connect work to outcomes, back decisions with evidence. Stakeholders submit easily, know the outcome, see progress and value. The product feels fast, looks exceptional, needs little training, is trustworthy, and creates less admin than it removes.

**The employee thinks:** "I always know where I stopped and what I need to do next."
**The manager thinks:** "I finally have a clear picture of what my team is doing, what's holding us back, and what we've delivered."
**The executive thinks:** "I can see the value this team provides and which decisions need my attention."

Build a simple application that solves this exceptionally well. Resist the temptation to make it complicated.
