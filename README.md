# @adaptive-ds/authworks

This package is an independent identity API built with Hono and Valibot. It is not ZITADEL-compatible, not a ZITADEL client, and not a protobuf/ConnectRPC compatibility layer. You can run it as a Hono server, import it as a typed client, or use it from a CLI. It is one Bun package, with features that own their routes, schemas, events, and tests.

This is an alpha backend with reset-only storage. Destructive schema changes and database resets remain allowed until a later plan preserves a database. This release has no migrations, upcasters, or upgrade paths. Current-state SQLite tables stay authoritative, with an append-only event log for domain facts that never contains secrets.

## Planned capabilities

- Users, passwords, sessions, recovery, and rate limits
- Email OTP, social login, recent accounts
- Realms, organizations, memberships, roles
- OIDC clients, PKCE, tokens, discovery, JWKS, logout
- TOTP, recovery codes, passkeys, step-up
- Machine users, PATs, client credentials, grants

## Contracts

Canonical failures use `ResultError` with stable `{feature}.{slug}` codes. Messages never determine a code or HTTP status. OAuth/OIDC protocol errors remain separate from management API errors.

HTTP error responses preserve the code, operation, details, status, request ID, retryability, and relevant headers. Clients do not parse localized messages or expose secrets.

Every list uses `{ items, nextPageToken }`. Each list has a hard maximum page size, deterministic tie-break ordering, opaque cursors, and validated filter and sort query contracts.

PATCH follows one rule. Omitted fields preserve their current values. `null` clears a value only where the schema allows it. Arrays replace the existing arrays. Empty patches fail with a stable code.

Public origin resolution keeps a configured pathname. Configured host and port go to `Bun.serve`. Importing the server module does not open the database, and an initialization failure terminates startup.

`public/` is the transport-contract directory, not the published package. Its files may import Valibot, `public/` files from the same feature, another feature's `public/` files, and shared platform transport contracts only.

Package exports use an explicit allowlist. `.` is a thin root containing `packageName` plus shared result and HTTP error contracts. `./library` aliases `.`. Named feature paths remain, including `./users`, `./organizations`, and `./oidc`, along with the other current feature barrels. `./server`, `./cli`, and `./package.json` remain. `./features/*` and `./*` are not exported.

## Install

```bash
bun add @adaptive-ds/authworks
```

## Scripts

```bash
bun run dev       # start the server entry
bun test          # bun tests
bun run test:build # build and test distributable outputs
bun run test:all  # source and distributable tests
bun run build     # emit dist/
bun run format   # biome
bun run check    # repository checks
bun run release  # git-cliff changelog + tag
bun run deploy   # full check plus optional live HTTPS smoke
```

`bun run check` runs formatting, UI-literal, type, test, build, and build-output
checks. Its test commands pass `--max-concurrency=1`.

## Production deployment

The repository-managed deployment is one Bun service behind one Caddy HTTPS
site. The systemd user unit stores the SQLite database and its WAL sidecars in
`~/.local/share/authworks/authworks.sqlite`; this directory must be included in
the host's backup plan.

Create `~/.config/authworks/authworks.env` locally with mode `600` and never
commit it:

```dotenv
AUTHWORKS_PUBLIC_ORIGIN=https://auth.example.com
AUTHWORKS_SYSTEM_SECRET=replace-with-a-secret
# Optional transactional email delivery. Disabled unless explicitly set to true.
AUTHWORKS_EMAIL_DELIVERY_ENABLED=true
AUTHWORKS_EMAIL_GENERATOR_BASE_URL=https://email-generator.example.com
AUTHWORKS_EMAIL_SMTP_HOST=mail.example.com
AUTHWORKS_EMAIL_SMTP_PORT=587
AUTHWORKS_EMAIL_SMTP_SECURITY=starttls
AUTHWORKS_EMAIL_SMTP_USERNAME=mailer@example.com
AUTHWORKS_EMAIL_SMTP_PASSWORD=replace-with-a-secret
AUTHWORKS_EMAIL_SMTP_FROM=mailer@example.com
```

Transactional email is disabled by default. The SMTP settings above are the required production names. The optional
footer names are `AUTHWORKS_EMAIL_FOOTER_HOMEPAGE_TEXT`, `AUTHWORKS_EMAIL_FOOTER_HOMEPAGE_URL`,
`AUTHWORKS_EMAIL_FOOTER_HOMEPAGE_SUBTITLE`, `AUTHWORKS_EMAIL_FOOTER_LANGUAGE`, and
`AUTHWORKS_EMAIL_FOOTER_LEGAL_SIGNATURE`; invitation sender overrides are
`AUTHWORKS_EMAIL_INVITATION_SENDER_EMAIL` and `AUTHWORKS_EMAIL_INVITATION_SENDER_NAME`. Credentials are read only
from the uncommitted environment and are never stored in the repository.

The real Mailcow send/receive check is separate from the default suite. It is skipped unless
`AUTHWORKS_MAILCOW_E2E_ENABLED=true` and reads these uncommitted environment names:
`AUTHWORKS_MAILCOW_SMTP_HOST`, `AUTHWORKS_MAILCOW_SMTP_PORT`, `AUTHWORKS_MAILCOW_SMTP_SECURITY`,
`AUTHWORKS_MAILCOW_SMTP_USERNAME`, `AUTHWORKS_MAILCOW_SMTP_PASSWORD`, `AUTHWORKS_MAILCOW_IMAP_HOST`,
`AUTHWORKS_MAILCOW_IMAP_PORT`, `AUTHWORKS_MAILCOW_IMAP_SECURITY`, `AUTHWORKS_MAILCOW_IMAP_USERNAME`, and
`AUTHWORKS_MAILCOW_IMAP_PASSWORD`. Use the `it@contentoren.de` mailbox for SMTP and the
`auth@contentoren.de` mailbox for IMAP; `AUTHWORKS_MAILCOW_IMAP_MAILBOX` optionally selects a mailbox other than
`INBOX`.

Run it explicitly with `AUTHWORKS_MAILCOW_E2E_ENABLED=true bun run test:mailcow`. Never commit these values.

After building from the conventional `~/adaptive/authworks` checkout, install
and start the repository-managed service:

```bash
bun run build
bash ops/systemd/install.bash
```

Configure the Caddy service with `ops/Caddyfile`, setting
`AUTHWORKS_PUBLIC_HOST` to the same host as `AUTHWORKS_PUBLIC_ORIGIN`. Caddy
terminates HTTPS and proxies only to `127.0.0.1:3000`; it obtains certificates
for that single public origin. Do not put the system secret in Caddy or the
repository. After a release, rebuild and restart with
`systemctl --user restart authworks.service`.

Run the public smoke without storing its URL in the repository:

```bash
AUTHWORKS_SMOKE_URL=https://auth.example.com bun run smoke:public
```

The smoke checks HTTPS, the production root redirect, health, the SPA fallback,
the packaged favicon, built-asset caching, API/static precedence, and production
exclusion of `/demo/**`.

## WhatsApp OTP and WAHA

The package currently resolves `@adaptive-ds/waha-client` from the sibling
`../waha-client` checkout. Local development therefore requires that checkout,
`bun install`, and a reachable WAHA instance with at least one configured
session in `WORKING` state (normally `http://localhost:3000`).
Because `package.json` declares this dependency as `file:../waha-client`, an
install from npm or a standalone Authworks checkout cannot resolve it without
that sibling checkout. Deployment must include the sibling checkout, or
replace the dependency with a published package before deployment.

WAHA is disabled unless `AUTHWORKS_WAHA_ENABLED` is `1`, `true`, or `yes`.
When enabled, `AUTHWORKS_WAHA_ENDPOINTS` is a required JSON array with one or
more endpoints. Each endpoint has a stable `id` and an HTTP(S) `baseUrl`
without credentials; it may also have `apiKey`, `session`, `timeoutMs`, and
`retries`. `apiKey` and `AUTHWORKS_SYSTEM_SECRET` are server-only secrets and
must not be exposed to clients or committed. A non-empty
`AUTHWORKS_SYSTEM_SECRET` is required for WhatsApp registration and OTP rate
limiting:

```dotenv
AUTHWORKS_SYSTEM_SECRET=replace-with-a-secret
AUTHWORKS_WAHA_ENABLED=true
AUTHWORKS_WAHA_ENDPOINTS='[{"id":"local","baseUrl":"http://localhost:3000","session":"default","apiKey":"replace-with-a-secret"}]'
# Optional; defaults shown in milliseconds.
AUTHWORKS_WAHA_REFRESH_INTERVAL_MS=30000
AUTHWORKS_WAHA_FRESHNESS_TTL_MS=90000
```

The freshness TTL must be at least the refresh interval. Authworks refreshes
WAHA health once at startup and then on that interval, without overlapping
scans. A candidate is healthy only when WAHA server health is `ok` and its
listed session is `WORKING`. Persisted rows survive restarts but are usable
only while `expiresAt > now`; requests use this cache and do not synchronously
scan WAHA. URLs and API keys are not stored in health rows. Candidates are
selected uniformly from fresh healthy candidates.

WhatsApp is available only when `configured && policyEnabled &&
freshHealthyCandidate`. The availability route returns only that boolean:

```text
GET  /realms/:realmId/whatsapp-otp/availability?organizationId=...
POST /realms/:realmId/whatsapp-otp/start
POST /realms/:realmId/whatsapp-otp/resend
POST /realms/:realmId/whatsapp-otp/verify
POST /realms/:realmId/password/register
POST /realms/:realmId/password/verify-whatsapp
```

Availability uses the resolved organization login policy. `allowWhatsappOtp`
comes from the organization override when present, otherwise the realm policy,
and defaults to `true`. When supplied, an organization must belong to the
requested realm and be active; an unavailable organization or disabled policy
makes WhatsApp unavailable.

Password registration accepts `verificationMethod: "email" | "whatsapp"` and
defaults to email verification. Set it to `whatsapp` and provide a canonical
phone number to use WhatsApp; WhatsApp verification activates the account and
does not verify its email address. Phone numbers use E.164 form matching
`^\+[1-9]\d{1,14}$` (for example `+14155552671`); WAHA receives
`14155552671@c.us`.
Registration is realm-scoped: provide `--realm-id REALM_ID` or set
`AUTHWORKS_REALM_ID`; an explicit flag takes precedence, and there is no default
realm ID.

WhatsApp registration delivery and WhatsApp OTP start/resend are limited to one
delivery per phone and purpose per 60 seconds. WhatsApp registration, OTP
start, OTP resend, and OTP verify each allow five requests per 60 seconds for
both their identifier and client-IP scopes. Each challenge allows five code
attempts. These limits use atomically persisted windows and HMAC-derived keys,
not raw phone numbers or email addresses. HTTP rate limits return `429`, public
code `rate_limited`, and `Retry-After`.

Client IP resolution uses the direct peer address first. `X-Forwarded-For` is
considered only when that peer is in the explicitly supplied
`trustedProxyAddresses` list; the chain is walked from the nearest proxy to
the first untrusted address. With no direct address, the result is `unknown`.
The shipped server reads the optional comma-separated
`AUTHWORKS_TRUSTED_PROXY_ADDRESSES` environment variable; it defaults to no
trusted proxies, so forwarded headers are ignored unless the immediate peer is
listed explicitly.

Challenge and event persistence commits before external delivery. Delivery
failures do not roll back state or put the OTP in the HTTP response. The WAHA
delivery adapter marks a failed candidate unhealthy, retries at most once with
another fresh healthy candidate, and returns the second failure if both sends
fail. Registration and OTP route delivery is invoked after commit and
asynchronously, so an accepted response is not changed by a later delivery
failure.

The CLI uses `AUTHWORKS_URL` or `http://127.0.0.1:3000` by default; realm and
organization defaults and explicit flag precedence are documented above:

```bash
authworks whatsapp-otp availability [--realm-id REALM_ID] [--organization-id ID]
authworks whatsapp-otp start --realm-id REALM_ID --phone-number +14155552671
authworks whatsapp-otp resend --realm-id REALM_ID --challenge-id ID
authworks whatsapp-otp verify --realm-id REALM_ID --challenge-id ID --code CODE
authworks passwords register --verification-method whatsapp --phone-number +14155552671
authworks passwords verify-whatsapp --realm-id REALM_ID --challenge-id ID --code CODE
```

The live WAHA health test is skipped unless explicitly gated. Run it only with
a reachable endpoint and a `WORKING` session:

```bash
AUTHWORKS_WAHA_LIVE_TEST=true \
AUTHWORKS_WAHA_ENABLED=true \
AUTHWORKS_WAHA_ENDPOINTS='[{"id":"local","baseUrl":"http://localhost:3000","session":"default"}]' \
bun test test/integration/wahaLive.test.ts
```

## CLI scope defaults

Realm- and organization-scoped commands can use `AUTHWORKS_REALM_ID` and `AUTHWORKS_ORGANIZATION_ID` as default
scope IDs:

```bash
export AUTHWORKS_REALM_ID=realm-uuid
export AUTHWORKS_ORGANIZATION_ID=organization-uuid
authworks organizations get
```

Explicit `--realm-id` and `--organization-id` flags take precedence over their corresponding environment values. If a
required ID is missing from both, the CLI exits with a validation error before making the request.

## Layout

```txt
src/features/<feature>   domain, actions, routes, public schemas, client, cli
src/platform             ids, clocks, errors, config, storage
src/outputs              thin server, library, and cli composition
```

Outputs import feature surfaces. They do not contain feature logic. Missing imports fail at build time.

The server, library, and CLI outputs are composed from the completed feature surfaces. Cross-feature conformance,
tenant isolation, event atomicity, secret safety, and built-output smoke checks are covered by the test suite.

## Links

- code: https://github.com/david1gp/authworks
- npm: https://www.npmjs.com/package/@adaptive-ds/authworks
- issues: https://github.com/david1gp/authworks/issues

## License

MIT
