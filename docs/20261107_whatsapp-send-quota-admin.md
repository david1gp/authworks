# WhatsApp per-sender send quota + admin dashboard

## Goal

Limit WhatsApp (WAHA) message sending to **20/hour and 100/day per sender number**,
count requests and actual sends, and show quota usage (sent / left, progress bars),
logs/events, and request counts on a new admin web UI page.

## User decisions (2026-11-07)

- Limit scope: **per sender number** (each WAHA sender session gets its own
  20/hour + 100/day). Sender selection must skip over-quota senders and use the
  next healthy under-quota sender; sending is blocked only when every healthy
  sender is exhausted.
- Counted sends: **all WhatsApp sends** through the shared delivery port —
  sign-in OTP, phone-change OTP, and password-registration codes. The dashboard
  breaks counts down by purpose where known.
- Admin UI: **new dedicated WhatsApp page** (quota bars, request counts, log).
  The realm dashboard gets one summary tile linking to it.

## Fixed design choices (do not re-decide in tasks)

- **Rolling windows** computed from a persistent send log: sent-in-last-1h and
  sent-in-last-24h per sender. One source of truth for enforcement, progress
  bars, and the log. Do not add a parallel `rate_limits` fixed-window counter
  for this quota. Existing per-user/per-IP 5-per-60s limits stay untouched.
- **Send log is owned by the `waha` feature** (sender identity lives there):
  one row per delivery attempt with endpoint id, sender session, purpose,
  realm id (nullable), recipient phone **hash** (never plaintext), status
  (`sent | failed | blocked`), created-at. `blocked` = no under-quota healthy
  sender existed (sender session null).
- **Counting point**: the production delivery implementation
  `src/features/waha/server/wahaTextDeliveryCreate.ts` — the single choke point
  for every real WAHA send. Demo/fixture adapters never reach it and never count.
  Decoy/cooldown-suppressed OTP requests never reach it and never count as sends.
- **Delivery port context**: extend `sendText` with optional
  `{ realmId, purpose }` context. Callers: whatsappOtp actions
  (`sign_in` / phone-change purpose constant), `passwordRegister`
  (registration). Keep the two structurally identical port interfaces
  (`WhatsappOtpDeliveryPort`, `PasswordWhatsappDeliveryPort`) in sync.
- **Config**: env vars parsed next to existing WAHA config in
  `src/features/waha/server/wahaConfigurationParse.ts`:
  `AUTHWORKS_WAHA_SENDER_HOURLY_LIMIT` (default 20),
  `AUTHWORKS_WAHA_SENDER_DAILY_LIMIT` (default 100). Thread through
  `src/outputs/server.ts` -> `serverApplicationCreate` like existing WAHA knobs.
- **User-facing behavior on exhaustion**: unchanged. WhatsApp OTP actions keep
  their generic accepted responses and fire-and-forget delivery (enumeration
  oracle preserved); a blocked send is recorded in the log, not surfaced.
  Availability must report unavailable when no healthy under-quota sender
  exists, so the login UI hides WhatsApp instead of silently failing.
- **Admin API**: `GET /realms/:realmId/whatsapp-otp/usage`, guarded exactly like
  the events endpoints (session cookie+CSRF middleware +
  `realmAdministratorContextAuthorize` with `eventRead`). whatsappOtp consumes
  waha usage data only through an injected port implemented on waha's server
  surface (composition wiring in `serverApplicationCreate.ts`), per AGENTS.md
  feature-boundary rules. Response is a `public/` valibot schema; never expose
  Drizzle rows. Usage numbers are deployment-wide per sender (that is the
  quota scope); OTP request counts are realm-scoped.
- **"Requests" on the dashboard** = two series, both shown:
  1. OTP requests for the admin's realm: `whatsapp_otp.requested` events in
     last 1h / 24h (precedent: `eventRecentRealmCount`).
  2. WAHA delivery attempts from the send log in last 1h / 24h, split by
     status (sent / failed / blocked) and purpose.
- **Admin page**: new screen key `whatsapp` in `adminScreenSchema` + production
  route contract, following `AdminEventListView` / `AdminRealmView` patterns.
  Per-sender cards with two progress bars (hour, day) reusing the
  `AccountSecurityProgress` pattern (`role="progressbar"`, aria values),
  request-count stat tiles (`AuthenticatedStatTile`), recent send-log table.
  Demo adapter + fixtures so `/demo/admin` renders it. All UI text via
  `messageTranslate` keys (enforced by `check:no-literal-ui-text`).
  One summary tile on `AdminRealmView` linking to the new page.
- Follow the `code-style` skill: one export per file, subject-first names,
  Result instead of throws, state extracted from `.tsx`, bounded contexts.
- Tests: beside the feature, real temp SQLite + `platformTestkitCreate`
  pattern from existing whatsappOtp tests. Focused runs only:
  `bun test --max-concurrency=1 --dots <file>`. Never run full `bun run test`
  or e2e during increments. `bun run check` runs once at the very end (Task 5).

## Tasks (delegate one at a time, verify each before the next)

### Task 1 — Send log persistence (waha feature)

Drizzle table + repository in `src/features/waha/persistence/` (check how waha
health tables/repositories are structured and how tables get created/migrated —
follow that exactly). Repository operations: record attempt; count sent per
(endpointId, session) since a timestamp; list recent attempts (bounded,
newest first); count attempts by status/purpose since a timestamp.
Unit tests beside it with temp SQLite. No behavior change anywhere else.

### Task 2 — Quota-aware delivery + config + availability

Parse the two env limits; thread config to `wahaTextDeliveryCreate`.
Sender selection: among fresh healthy candidates, prefer under-quota ones
(rolling 1h and 24h sent counts from Task 1 repository); record `sent` /
`failed` per attempt (including the existing one-retry-on-second-candidate
path — one row per WAHA attempt); record `blocked` when candidates exist but
all are over quota **or** none are healthy — distinguish nothing in the row
beyond status + null session for blocked. Extend the delivery ports with the
optional context and pass it from the 4 whatsappOtp send call sites and
`passwordRegister`. Make whatsappOtp availability require an under-quota
healthy candidate through the existing injected availability wiring (extend
the waha-side implementation, not the whatsappOtp feature's internals).
Recipient stored only as hash — reuse the existing phone-hash approach
available to the waha feature without importing whatsappOtp internals
(HMAC/hash helper on the platform or waha server surface; if none exists,
add a small one in waha with the system secret threaded like
`rateLimitSecret` is).
Tests: quota filtering, skip-to-next-sender, blocked recording, rolling
window expiry via testkit time, availability false when exhausted.
Focused test files only.

### Task 3 — Admin usage API

`public/` response schema + usage port (whatsappOtp side) + waha server-side
implementation + route in `whatsappOtpServerAppCreate.ts` + composition
wiring. Response: config limits, per-sender `{ endpointId, session,
sentLastHour, sentLastDay, remainingHour, remainingDay }`, totals, realm OTP
request counts (1h/24h from events), delivery attempt counts by status and
purpose (1h/24h), recent send log (bounded page, newest first; phone hash
truncated/redacted for display — never plaintext, no full hash needed).
Client method in `whatsappOtpApiClientCreate.ts`, surfaced via
`adminApiCreate.ts` + `AdminAdapter` (production + demo stub returning empty
usage for now; fixtures arrive in Task 4). Tests: route auth (non-admin
rejected), response shape against seeded send log + events. Focused only.

### Task 4 — Admin WhatsApp page (UI)

New `whatsapp` screen: route contract, nav entry wherever the other screens
are listed, view + extracted state factory, per-sender quota cards with hour
and day progress bars (sent / limit / left), request tiles, recent log table
(time, sender, purpose, status), empty/error/loading states like sibling
views. Demo fixtures with plausible multi-sender data. i18n keys for every
string. Realm dashboard summary tile (e.g. sends today across senders +
tightest remaining quota) linking to the page. Verify in a real browser via
a browser subagent against the dev/demo route; screenshot-level check that
bars render with correct widths. No e2e suite run.

### Task 5 — Final validation

`bun run check` (format, no-literal-ui-text, typecheck, full tests, build).
Fix failures caused by Tasks 1–4 only; report pre-existing failures with
proof (same failure on clean `main`). Then hand back for commits/merge.

## Out of scope

- Changing existing per-user/per-IP OTP rate limits or cooldowns.
- Per-realm quota configuration, admin editing of limits in the UI (env only).
- Alerting/notifications on quota exhaustion.
- Updating `docs/20260817_authworks.md` (note the divergence in the final
  report instead).

## Status

- Exploration: done (delegated research, 2026-11-07).
- Decisions: done (user, 2026-11-07).
- Task 1: done — `waha_send_attempts` table + `wahaSendAttemptRepositoryCreate`
  (record / sent-count / recent-list / counts by status, purpose, sender),
  registered in `storageSchema` + `storageSchemaCreate` DDL; 5 tests pass.
  Note: `endpoint_id` is NOT NULL — Task 2 must give blocked rows an endpoint
  or relax that column.
- Task 2: done — env limits (20/h, 100/d defaults), quota-filtered sender
  selection in `wahaTextDeliveryCreate` via `wahaSenderQuotaCreate`, one
  `sent`/`failed` row per WAHA attempt + `blocked` row when none eligible
  (first configured endpoint id, null session), HMAC recipient hash
  (`wahaRecipientHashCreate`), purpose/realmId port context from all 5 call
  sites (`registration` for passwordRegister), availability requires an
  under-quota candidate (waha-side reader). Verified: 38 focused tests pass
  on lead re-run. Known soft-limit race: concurrent sends can overshoot by
  the in-flight count.
- Task 3: done — `GET /realms/:realmId/whatsapp-otp/usage` (cookie session +
  `eventRead` guard), public schema (`whatsappOtpUsageResponseSchema`:
  limits / senders+remaining / totals / realm OTP requests / attempts by
  status+purpose / recent with 8-char hash prefix), usage port implemented by
  `wahaUsageReaderCreate`, realm request counts via events server surface
  (`eventRealmTypeCount`), client method + AdminAdapter (demo returns empty
  usage until Task 4 fixtures). Verified: 6 route tests pass on lead re-run.
  Type consumed by Task 4: `WhatsappOtpUsageResponse` from whatsappOtp public.
- Task 4: done — `whatsapp` admin screen (`/admin/whatsapp`, demo
  `/demo/admin/whatsapp`): request/sent/blocked/failed tiles, per-sender
  hour+day progress bars with sent/left, purpose breakdown, recent activity
  table, realm-dashboard WhatsApp tile, demo fixtures, 31 i18n keys × 15
  locales. Verified by lead: screenshots inspected, 32/32 focused tests pass
  with repo test flags (`--conditions=browser --isolate`; without `--isolate`
  solid-js `createRoot` breaks across files — pre-existing harness quirk,
  also affects older test files). One claimed pre-existing failure
  (`productionRouteAppStateCreate.test.ts`) to be proven in Task 5.
- Task 5: done — `bun run check` fully green (1995 tests, build, built-output
  tests). Two Task 1–4 fallout fixes: library-exports expectation for
  `whatsappOtpUsageGet`; waha-owned error codes in `wahaUsageReaderCreate`.
  Suspected `productionRouteAppStateCreate` failure did not reproduce.
- E2E: 55/55 admin-shell/demo specs pass (Playwright, dedicated port; default
  port 5174 on this machine is occupied by a foreign app — environmental).
- Done: 4 commits on `feat/whatsapp-send-quota`, merged to `main`, pushed,
  worktree + branch removed. Work happens in worktree branch
  `feat/whatsapp-send-quota`; merge to `main` after Task 5 passes.

## Phase 2 — real phones + codes, env redaction, recent-activity window

User decisions (2026-11-07, do not re-ask):

- Recent activity shows **real phone numbers (always in full)** and **real OTP
  codes**. Codes are **redacted by default** as first char + `***` + last char
  (6-digit code `123456` → `1***6`).
- Redaction is disabled via env **`AUTHWORKS_WAHA_DISABLE_CODE_REDACTION=true`**
  (boolean style of `AUTHWORKS_WAHA_ENABLED`: `1|true|yes`). Default: redacted.
  After merge, the lead sets it to `true` in dev and production envs.
- Recent activity **window selector: 24h (default) / 3d / 7d**, recent list
  only. Tiles and quota bars keep fixed 1h/24h windows.

Fixed design choices:

- **Capture at the existing choke point**: extend the three structurally
  identical ports (`WahaTextDeliveryPort`, `WhatsappOtpDeliveryPort`,
  `PasswordWhatsappDeliveryPort`) with optional `code?: string`; the 5 send
  call sites pass `delivery.code`. `wahaTextDeliveryCreate` records new
  nullable columns `recipient_phone` (plaintext phoneNumber) and `code`
  (plaintext, `input.code ?? null`) on every attempt row incl. blocked.
  Existing `recipient_phone_hash` stays (quota keys unchanged).
- **Migration**: fresh-DB `CREATE TABLE` gains the columns; existing DBs get
  them via the `try { ALTER TABLE … ADD COLUMN } catch (duplicate → ignore)`
  precedent in `storageSchemaCreate.ts` (`storageSchemaDuplicateColumnIsExpected`).
  Old rows have null phone/code.
- **Redaction is server-side** in `wahaUsageReaderCreate` (waha owns usage):
  config field on `WahaConfiguration` (e.g. `codeRedactionDisabled`), parsed
  in `wahaConfigurationParse`, default in `wahaConfigurationDefaults`,
  threaded through the existing `configuration` composition path. Small
  subject-first mask helper in the waha feature: length ≤ 2 → `***`, else
  first + `***` + last. When redaction is on, the full code must never appear
  in the serialized API response (tests assert this).
- **API**: usage query gains `window` enum `24h|3d|7d` (default `24h`);
  `wahaSendAttemptListRecent` gains a `since` filter (reader computes
  `now - windowMs` from the injectable runtime). Recent entries gain
  `recipientPhone: string | null` and `code: string | null` (post-redaction);
  `recipientHashPrefix` stays as fallback display for pre-Phase-2 rows.
  Client/AdminAdapter signatures carry the window alongside `limit`.
- **UI**: recent table columns Time | Sender | Endpoint | Purpose | Status |
  Phone | Code. Phone cell: `recipientPhone ?? recipientHashPrefix`; code
  cell: `code ?? —`. Window selector (24h/3d/7d) URL-held following the
  event-filters search-param pattern in `adminPageStateCreate`; switching
  refetches usage. Demo fixture: fictional numbers (`+49170000000x`), codes
  in redacted form, `createdAt` generated relative to `Date.now()` in the
  demo adapter with rows at <24h, ~2d and ~6d so the selector visibly
  filters; demo adapter applies the window filter. New `admin.whatsapp.*`
  i18n keys in all 15 locales. Security note: plaintext codes now persist in
  the DB (they expire after 10 min; display window ≤ 7d) — accepted by user.

Phase 2 tasks (delegate one at a time, verify each):

- **P2-1 Persistence + capture + config**: columns + migration + repo
  `since` filter, port `code` context from 5 call sites, recording in
  `wahaTextDeliveryCreate`, env parse + config threading to reader (no API/UI
  change yet). Update the hash-only assertions in `wahaTextDeliveryQuota.test.ts`
  (intentional behavior change). Tests: repo test (columns, since filter,
  migration against a pre-Phase-2-shaped DB), delivery quota test (phone+code
  recorded incl. blocked), config parse test (new file; defaults + true/false).
- **P2-2 API**: query `window`, response fields, server-side redaction in
  reader (mask helper), route/client/AdminAdapter plumbing, demo adapter
  returns updated shape (fixtures may be minimal until P2-3). Tests: usage
  route (redacted default + full code absent from body; disabled → full code;
  window filters older rows out; old row → nulls).
- **P2-3 UI**: columns, selector + URL state + refetch, demo fixtures with
  relative timestamps + window filtering, i18n keys ×15, realm tile untouched.
  Browser screenshot verification (Playwright, repo vite on free port, save
  screenshot to `/home/david/whatsapp-usage-admin.png`, kill server after).
- **P2-4 Final**: `bun run check` fully green (fix only Phase-2 fallout, prove
  pre-existing failures against clean main). Then lead: commits, merge, push,
  set env in dev + prod, cleanup.

Phase 2 status: exploration + decisions done; P2-1…P2-4 pending on branch
`feat/whatsapp-usage-real-codes`.
