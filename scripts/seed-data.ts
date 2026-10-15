/**
 * The demo environment's content (used by scripts/test-accounts.ts). Everything is relative to "now", so the
 * dashboards always look alive: two tasks overdue, two awaiting Morgan's approval, three blocked, six finished
 * in the last two weeks, requests in every state.
 */
import type { RequestStatus, RequestUrgency, TaskPriority, TaskSize, TaskStatus } from "@/lib/constants";

export type Person = "admin" | "lead" | "member" | "member2" | "stakeholder";

export type SeedGoal = { key: string; title: string; description: string; owner: Person; team: boolean; targetInDays: number; successCriteria: string };

export const GOALS: SeedGoal[] = [
  {
    key: "latency",
    title: "Cut p95 API latency below 300 ms",
    description: "Customers on the EU cluster see slow dashboards at peak. Bring the API back under budget.",
    owner: "lead",
    team: true,
    targetInDays: 45,
    successCriteria: "p95 under 300 ms for 14 consecutive days on the API latency dashboard.",
  },
  {
    key: "deploys",
    title: "Zero-downtime deploys for the core API",
    description: "Deploys currently drop in-flight requests for a few seconds.",
    owner: "member",
    team: true,
    targetInDays: 70,
    successCriteria: "Ten consecutive production deploys with no 5xx spike.",
  },
  {
    key: "billing",
    title: "Self-serve billing for enterprise customers",
    description: "Finance spends two days a month on manual invoices.",
    owner: "admin",
    team: false,
    targetInDays: 120,
    successCriteria: "Enterprise customers download invoices and update payment details without a ticket.",
  },
];

export type SeedExpectation = { title: string; description: string; kind: "milestone" | "count"; targetCount: number | null; period: "month" | "quarter"; goal: string | null };

export const EXPECTATIONS: SeedExpectation[] = [
  {
    title: "Deliver three agreed platform milestones this month",
    description: "Agreed in the monthly planning: session store, connection pooling, CI runners.",
    kind: "count",
    targetCount: 3,
    period: "month",
    goal: "latency",
  },
  {
    title: "Complete the quarterly access review",
    description: "Every production credential reviewed and rotated where needed.",
    kind: "milestone",
    targetCount: null,
    period: "quarter",
    goal: null,
  },
];

export type SeedRequest = {
  key: string;
  title: string;
  description: string;
  desiredOutcome: string;
  urgency: RequestUrgency;
  link?: string;
  requester: Person;
  status: RequestStatus;
  createdDaysAgo: number;
  decision?: { daysAgo: number; by: Person; reason: string; deferInDays?: number };
};

export const REQUESTS: SeedRequest[] = [
  {
    key: "invoices",
    title: "Export invoices as CSV for finance",
    description: "Finance rebuilds the monthly invoice list by hand from the admin console.",
    desiredOutcome: "A CSV export of invoices per month, so month-end close takes an hour instead of two days.",
    urgency: "high",
    requester: "stakeholder",
    status: "new",
    createdDaysAgo: 1,
  },
  {
    key: "backup",
    title: "Nightly backup failed three nights in a row",
    description: "The backup status email has said FAILED since Monday. We need a restorable backup before the audit.",
    desiredOutcome: "A green nightly backup, and an alert when it fails again.",
    urgency: "critical",
    link: "https://status.example.com/incidents/2291",
    requester: "stakeholder",
    status: "converted",
    createdDaysAgo: 4,
    decision: { daysAgo: 3, by: "lead", reason: "Audit risk; taking it this week." },
  },
  {
    key: "sso",
    title: "Single sign-on for the admin console",
    description: "Security asked that staff stop using shared passwords for the console.",
    desiredOutcome: "Console access through our Okta tenant.",
    urgency: "normal",
    requester: "admin",
    status: "under_review",
    createdDaysAgo: 6,
    decision: { daysAgo: 2, by: "lead", reason: "Sizing it with the identity team before committing." },
  },
  {
    key: "node",
    title: "Upgrade Node to 24 LTS on build agents",
    description: "Node 20 leaves maintenance soon and some tooling already needs 22+.",
    desiredOutcome: "All build agents on Node 24 LTS.",
    urgency: "normal",
    requester: "member2",
    status: "approved",
    createdDaysAgo: 9,
    decision: { daysAgo: 5, by: "lead", reason: "Approved for next sprint; low risk." },
  },
  {
    key: "status-dark",
    title: "Dark mode for the public status page",
    description: "A few customers asked for it on the community forum.",
    desiredOutcome: "Status page follows the visitor's system theme.",
    urgency: "low",
    requester: "member",
    status: "deferred",
    createdDaysAgo: 12,
    decision: { daysAgo: 8, by: "lead", reason: "Nice to have; revisit after the latency work.", deferInDays: 21 },
  },
  {
    key: "rust",
    title: "Rewrite the reporting service in Rust",
    description: "Reports time out for our three largest customers.",
    desiredOutcome: "Reports that finish in under ten seconds.",
    urgency: "normal",
    requester: "admin",
    status: "rejected",
    createdDaysAgo: 15,
    decision: { daysAgo: 11, by: "lead", reason: "A rewrite is too risky this quarter; the slow query is being indexed instead." },
  },
];

type Update = { daysAgo: number; author: Person; progress: string; next: string | null; blocker?: string };

export type SeedTask = {
  title: string;
  description?: string;
  assignee: Person | null;
  createdBy: Person;
  status: TaskStatus;
  priority: TaskPriority;
  size: TaskSize | null;
  createdDaysAgo: number;
  dueInDays: number | null;
  goal?: string;
  request?: string;
  updates: Update[];
  evidence?: { url: string; label: string }[];
  blocked?: { reason: string; by: string };
  approver?: Person;
  rejection?: { daysAgo: number; reason: string };
  completed?: { daysAgo: number; summary: string; impact?: string };
};

const GH = "https://github.com/clarity-demo/platform";
const GRAFANA = "https://grafana.example.com/d";

export const TASKS: SeedTask[] = [
  // --- in progress -----------------------------------------------------------
  {
    title: "Investigate failed overnight backup",
    description: "Nightly backup to object storage has failed three nights running.",
    assignee: "member",
    createdBy: "lead",
    status: "in_progress",
    priority: "urgent",
    size: "m",
    createdDaysAgo: 3,
    dueInDays: 1,
    request: "backup",
    updates: [
      { daysAgo: 2.6, author: "member", progress: "Confirmed the backup repository is reachable from the job runner.", next: "Pull the failed job logs for the last three nights." },
      { daysAgo: 0.3, author: "member", progress: "Reviewed failed job logs; identified a transport-related error on the upload step.", next: "Check proxy server connectivity and rerun the affected job." },
    ],
    evidence: [
      { url: `${GRAFANA}/backups/nightly-jobs?from=now-7d`, label: "Backup jobs dashboard" },
      { url: `${GH}/issues/412`, label: "platform#412" },
    ],
  },
  {
    title: "Move session store from Redis to Postgres",
    assignee: "member2",
    createdBy: "lead",
    status: "in_progress",
    priority: "normal",
    size: "l",
    createdDaysAgo: 10,
    dueInDays: 6,
    goal: "latency",
    updates: [
      { daysAgo: 8, author: "member2", progress: "Wrote the sessions table and the dual-write path behind a flag.", next: "Backfill existing sessions in staging." },
      { daysAgo: 4, author: "member2", progress: "Backfill ran in staging: 1.2M sessions in 6 minutes, no errors.", next: "Turn on dual-write in production for 10% of traffic." },
      { daysAgo: 0.8, author: "member2", progress: "Dual-write at 10% for a day; read latency unchanged.", next: "Raise to 50% and watch the connection pool." },
    ],
    evidence: [{ url: `${GH}/pull/1288`, label: "PR #1288" }],
  },
  {
    title: "Add p95 latency panels to the API dashboard",
    assignee: "member",
    createdBy: "member",
    status: "in_progress",
    priority: "normal",
    size: "s",
    createdDaysAgo: 5,
    dueInDays: 3,
    goal: "latency",
    updates: [{ daysAgo: 1, author: "member", progress: "Panels for the five busiest endpoints are in; per-region split still missing.", next: "Add the region dimension and share with Morgan." }],
    evidence: [{ url: `${GRAFANA}/api/latency?var-region=eu`, label: "API latency (draft)" }],
  },
  {
    title: "Rate-limit the public search endpoint",
    description: "A scraper hit search at 400 req/s last week.",
    assignee: "member2",
    createdBy: "lead",
    status: "in_progress",
    priority: "high",
    size: "m",
    createdDaysAgo: 9,
    dueInDays: -2,
    updates: [
      { daysAgo: 7, author: "member2", progress: "Picked a token bucket per API key, stored in Postgres.", next: "Implement the middleware and the 429 response." },
      { daysAgo: 2, author: "member2", progress: "Middleware done; the 429 body still lacks a Retry-After header.", next: "Add Retry-After and load test at 500 req/s." },
    ],
  },
  {
    title: "Rotate staging database credentials",
    assignee: "lead",
    createdBy: "lead",
    status: "in_progress",
    priority: "normal",
    size: "s",
    createdDaysAgo: 2,
    dueInDays: 4,
    updates: [{ daysAgo: 1, author: "lead", progress: "New credentials created in the vault; three of five services switched.", next: "Switch the worker and the cron service, then revoke the old user." }],
  },
  {
    title: "Migrate CI pipelines to the new runners",
    assignee: "member",
    createdBy: "lead",
    status: "in_progress",
    priority: "high",
    size: "l",
    createdDaysAgo: 18,
    dueInDays: -4,
    goal: "deploys",
    updates: [
      { daysAgo: 15, author: "member", progress: "Runner fleet is up; the API pipeline runs on it in shadow mode.", next: "Move the web and worker pipelines." },
      { daysAgo: 9, author: "member", progress: "Web pipeline moved; build time down from 14 to 6 minutes.", next: "Move the worker pipeline (needs Docker-in-Docker)." },
      { daysAgo: 3, author: "member", progress: "Worker pipeline builds, but integration tests time out on the new runners.", next: "Raise the runner memory limit and rerun the integration suite." },
    ],
    evidence: [{ url: `${GH}/pull/1301`, label: "PR #1301" }],
  },
  {
    title: "Document the incident response runbook",
    assignee: "lead",
    createdBy: "lead",
    status: "in_progress",
    priority: "low",
    size: "s",
    createdDaysAgo: 6,
    dueInDays: null,
    updates: [{ daysAgo: 2, author: "lead", progress: "Outline and the paging section are written.", next: "Write the customer-communication section." }],
  },

  // --- not started -----------------------------------------------------------
  { title: "Archive unused storage buckets", assignee: "member2", createdBy: "lead", status: "not_started", priority: "low", size: "s", createdDaysAgo: 4, dueInDays: 14, updates: [] },
  { title: "Add an audit log for role changes", assignee: "member", createdBy: "admin", status: "not_started", priority: "normal", size: "m", createdDaysAgo: 3, dueInDays: 10, updates: [] },
  { title: "Prepare the Q4 capacity plan", assignee: "lead", createdBy: "admin", status: "not_started", priority: "normal", size: "m", createdDaysAgo: 2, dueInDays: 12, updates: [] },
  { title: "Evaluate managed Postgres read replicas", assignee: null, createdBy: "lead", status: "not_started", priority: "normal", size: "m", createdDaysAgo: 1, dueInDays: null, goal: "latency", updates: [] },
  {
    title: "Write a load test for the checkout API",
    assignee: "member2",
    createdBy: "lead",
    status: "not_started",
    priority: "high",
    size: "m",
    createdDaysAgo: 2,
    dueInDays: 2,
    updates: [{ daysAgo: 1, author: "lead", progress: "Agreed the target: 200 checkouts per second for 10 minutes.", next: "Sam to write the k6 script against staging." }],
  },

  // --- blocked -----------------------------------------------------------------
  {
    title: "Renew the wildcard TLS certificate",
    assignee: "member",
    createdBy: "lead",
    status: "blocked",
    priority: "high",
    size: "s",
    createdDaysAgo: 7,
    dueInDays: 8,
    updates: [
      { daysAgo: 6, author: "member", progress: "Generated the CSR and picked the vendor.", next: "Raise the purchase order." },
      { daysAgo: 2, author: "member", progress: "Purchase order submitted.", next: "Install the certificate once issued.", blocker: "The purchase order is waiting for Finance approval." },
    ],
    blocked: { reason: "The purchase order is waiting for Finance approval.", by: "Finance (procurement)" },
  },
  {
    title: "Upgrade the Kafka cluster to 3.8",
    assignee: "member2",
    createdBy: "lead",
    status: "blocked",
    priority: "normal",
    size: "l",
    createdDaysAgo: 14,
    dueInDays: 20,
    updates: [
      { daysAgo: 12, author: "member2", progress: "Upgraded brokers 0 and 1 in staging.", next: "Upgrade broker 2." },
      { daysAgo: 5, author: "member2", progress: "Broker 2 fails to rejoin after the upgrade; opened a vendor case.", next: "Apply the vendor's fix and retry broker 2.", blocker: "Vendor support case #88213 is open." },
    ],
    blocked: { reason: "Vendor support case #88213: broker 2 fails to rejoin after the upgrade.", by: "Vendor support" },
    evidence: [{ url: "https://support.example.com/cases/88213", label: "Vendor case #88213" }],
  },
  {
    title: "Ship webhook retries with backoff",
    assignee: "member",
    createdBy: "member",
    status: "blocked",
    priority: "high",
    size: "m",
    createdDaysAgo: 8,
    dueInDays: 3,
    updates: [{ daysAgo: 1.5, author: "member", progress: "Retry policy designed: 5 attempts, exponential backoff, jitter.", next: "Build the retry worker.", blocker: "Needs the new queue table, which waits on the session-store migration." }],
    blocked: { reason: "Needs the new queue table, which waits on the session-store migration.", by: "Sam (session store migration)" },
  },

  // --- awaiting Morgan's approval ---------------------------------------------
  {
    title: "Connection pooling with PgBouncer",
    assignee: "member",
    createdBy: "lead",
    status: "awaiting_approval",
    priority: "high",
    size: "m",
    createdDaysAgo: 11,
    dueInDays: 1,
    goal: "latency",
    approver: "lead",
    updates: [
      { daysAgo: 9, author: "member", progress: "PgBouncer running in transaction mode in staging.", next: "Load test against staging." },
      { daysAgo: 4, author: "member", progress: "Load test: p95 down from 410 ms to 260 ms; no prepared-statement errors.", next: "Roll out to production behind the flag." },
      { daysAgo: 0.5, author: "member", progress: "Enabled in production for all API pods; connections down from 900 to 120.", next: "Morgan to review the dashboards and approve." },
    ],
    evidence: [
      { url: `${GH}/pull/1276`, label: "PR #1276" },
      { url: `${GRAFANA}/postgres/connections`, label: "Postgres connections" },
    ],
  },
  {
    title: "Clean up feature flags older than 90 days",
    assignee: "member2",
    createdBy: "member2",
    status: "awaiting_approval",
    priority: "low",
    size: "s",
    createdDaysAgo: 6,
    dueInDays: 5,
    approver: "lead",
    updates: [{ daysAgo: 1, author: "member2", progress: "Removed 23 stale flags; 4 kept on purpose and documented why.", next: "Morgan to confirm the four we kept." }],
    evidence: [{ url: `${GH}/pull/1295`, label: "PR #1295" }],
  },

  // --- rejected ----------------------------------------------------------------
  {
    title: "Add a second CDN provider",
    assignee: "member2",
    createdBy: "member2",
    status: "rejected",
    priority: "normal",
    size: "l",
    createdDaysAgo: 13,
    dueInDays: null,
    updates: [{ daysAgo: 11, author: "member2", progress: "Priced two providers; failover would add about $1,800 a month.", next: "Decide whether the cost is worth it." }],
    rejection: { daysAgo: 10, reason: "The cost outweighs the benefit at our traffic. Revisit if we pass 50 TB a month." },
  },

  // --- completed in the last two weeks -----------------------------------------
  {
    title: "Fix the flaky login integration test",
    assignee: "member",
    createdBy: "member",
    status: "completed",
    priority: "normal",
    size: "s",
    createdDaysAgo: 4,
    dueInDays: -1,
    updates: [{ daysAgo: 1.2, author: "member", progress: "Root cause was a shared test user; each run now creates its own.", next: null }],
    completed: { daysAgo: 1, summary: "Each test run now creates its own user; 50 consecutive green runs.", impact: "Unblocks merges for the whole team." },
    evidence: [{ url: `${GH}/pull/1299`, label: "PR #1299" }],
  },
  {
    title: "Reduce the API Docker image size",
    assignee: "member2",
    createdBy: "lead",
    status: "completed",
    priority: "normal",
    size: "m",
    createdDaysAgo: 8,
    dueInDays: -2,
    goal: "deploys",
    updates: [
      { daysAgo: 6, author: "member2", progress: "Moved to a multi-stage build.", next: "Drop dev dependencies from the runtime layer." },
      { daysAgo: 3.1, author: "member2", progress: "Runtime layer now has production dependencies only.", next: null },
    ],
    completed: { daysAgo: 3, summary: "The image went from 1.2 GB to 310 MB; deploys pull 4x faster.", impact: "Shorter deploys, fewer timeouts." },
    evidence: [{ url: `${GH}/pull/1281`, label: "PR #1281" }],
  },
  {
    title: "Set up error budget alerts",
    assignee: "lead",
    createdBy: "lead",
    status: "completed",
    priority: "normal",
    size: "s",
    createdDaysAgo: 9,
    dueInDays: -4,
    updates: [{ daysAgo: 5.1, author: "lead", progress: "Alerts fire at 50% and 90% of the monthly budget.", next: null }],
    completed: { daysAgo: 5, summary: "Budget alerts route to the on-call channel." },
    evidence: [{ url: `${GRAFANA}/slo/error-budget`, label: "Error budget" }],
  },
  {
    title: "Patch OpenSSL on all edge nodes",
    assignee: "member",
    createdBy: "admin",
    status: "completed",
    priority: "urgent",
    size: "s",
    createdDaysAgo: 8,
    dueInDays: -7,
    updates: [{ daysAgo: 7.1, author: "member", progress: "All 14 edge nodes patched and restarted one at a time.", next: null }],
    completed: { daysAgo: 7, summary: "All 14 edge nodes patched with no downtime." },
  },
  {
    title: "Add an index for the slow invoice query",
    assignee: "member2",
    createdBy: "lead",
    status: "completed",
    priority: "high",
    size: "s",
    createdDaysAgo: 12,
    dueInDays: -8,
    goal: "latency",
    updates: [
      { daysAgo: 11, author: "member2", progress: "Found the sequential scan on invoices by customer and month.", next: "Add a composite index concurrently." },
      { daysAgo: 9.1, author: "member2", progress: "Index built concurrently in production.", next: null },
    ],
    completed: { daysAgo: 9, summary: "The invoice query went from 2.4 s to 40 ms.", impact: "Reports stop timing out for the three largest customers." },
    evidence: [{ url: `${GH}/pull/1262`, label: "PR #1262" }],
  },
  {
    title: "Onboard Sam to the on-call rotation",
    assignee: "lead",
    createdBy: "lead",
    status: "completed",
    priority: "low",
    size: "s",
    createdDaysAgo: 16,
    dueInDays: -11,
    updates: [{ daysAgo: 12.1, author: "lead", progress: "Shadow shift done; Sam took the primary pager for a week.", next: null }],
    completed: { daysAgo: 12, summary: "Sam is on the rotation from next week." },
  },
];
