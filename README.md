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
without credentials; it may also have `apiKey`, `session`, `senderSessions`,
`timeoutMs`, and `retries`. `senderSessions`, when present, must be a non-empty
array of unique session names and limits that endpoint to those WAHA sender
sessions. If omitted, all `WORKING` sessions remain eligible for backward
compatibility. `session` remains the WAHA client default and is not an implicit
sender allowlist. `apiKey` and `AUTHWORKS_SYSTEM_SECRET` are server-only
secrets and must not be exposed to clients or committed. A non-empty
`AUTHWORKS_SYSTEM_SECRET` is required for WhatsApp registration and OTP rate
limiting:

```dotenv
AUTHWORKS_SYSTEM_SECRET=replace-with-a-secret
AUTHWORKS_WAHA_ENABLED=true
AUTHWORKS_WAHA_ENDPOINTS='[{"id":"local","baseUrl":"http://localhost:3000","session":"default","senderSessions":["default"],"apiKey":"replace-with-a-secret"}]'
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
AUTHWORKS_WAHA_ENDPOINTS='[{"id":"local","baseUrl":"http://localhost:3000","session":"default","senderSessions":["default"]}]' \
bun test test/integration/wahaLive.test.ts
```

## CLI connection profiles

The CLI can keep local connection profiles for switching between Authworks servers, identities, realms, and
organizations. A profile may contain `server`, `token`, `realmId`, and `organizationId`; partial profiles are valid.

Manage profiles with:

```bash
authworks profile set default --server https://auth.example.com --token TOKEN --realm-id REALM_ID \
  --organization-id ORGANIZATION_ID
authworks profile list
authworks profile show default
authworks profile delete default
```

`profile set` creates or updates a profile and only changes fields supplied by the command. `list`, `show`, and `set`
redact token values in their output; `delete` removes the named profile. Profile names are 1–64 characters, start with
an alphanumeric character, and contain only letters, numbers, `.`, `_`, or `-`.

Commands that accept connection values also accept `--profile NAME`. When `--profile` is omitted, the CLI uses the
implicit `default` profile when it exists. If it does not exist, the current environment-only behavior remains. An
explicitly selected profile that does not exist is an error.

Each connection field is resolved independently in this order: explicit command flag, existing environment variable,
selected profile, then the existing default. The environment names are `AUTHWORKS_URL`, `AUTHWORKS_TOKEN`,
`AUTHWORKS_REALM_ID`, and `AUTHWORKS_ORGANIZATION_ID`. The existing server default is
`http://127.0.0.1:3000`; realm and organization IDs and tokens have no additional default.

Profiles are stored as plaintext JSON at `${XDG_CONFIG_HOME}/authworks/profiles.json`, falling back to
`~/.config/authworks/profiles.json`. The CLI creates the directory for the current user and keeps the profile file
owner-only (`0700` directory and `0600` file). Plaintext storage means profile tokens are not encrypted: protect the
machine, config directory, and backups accordingly. Keyring integration and encryption are not provided by the CLI.

`AUTHWORKS_SYSTEM_SECRET` is never stored in or resolved from a profile. System-secret inputs remain flag- or
environment-only, including `AUTHWORKS_SYSTEM_SECRET` and applicable system-token flags.

## Central configuration and local credentials

The CLI and the TypeScript library use the same resolver. Central configuration lives at
`$XDG_CONFIG_HOME/authworks`, or `~/.config/authworks` when `XDG_CONFIG_HOME` is unset. The central files are:

```text
config.json
credentials/{profile}.json
projects/{project}.json
```

The central library surface is the `@adaptive-ds/authworks/configuration` package export. It provides these functions:
`configurationDirectoryPathResolve`, `configurationLoad`, `configurationPathResolve`, `configurationResolve`,
`credentialsLoad`, `credentialsPathResolve`, `credentialLookup`, `localCredentialLookup`, `projectLoad`, and
`projectPathResolve`. It also exports `configurationSchema`, `credentialsSchema`, `profileSchema`, `projectSchema`,
`testUserSchema`, and the corresponding `Configuration`, `ConfigurationResolveOptions`, `ResolvedConfiguration`,
`Credentials`, `Project`, `Profile`, and `TestUser` types (plus the related path/load/lookup option types).

Use `configurationResolve` in a consumer when the CLI would otherwise resolve the connection:

```ts
import { configurationResolve } from "@adaptive-ds/authworks/configuration"

const resolved = await configurationResolve({
  project: "demo",
  envFile: "./authworks.env",
})

if (!resolved.success) {
  throw new Error(resolved.errorMessage ?? "Authworks configuration could not be resolved.")
}

const { baseUrl, organizationId, projectId, realmId, token } = resolved.data
```

The resolver accepts the same injectable filesystem and environment options as the CLI integration, including
`configDirectory`, `homeDirectory`, `environment`, `configPath`, `credentialsDirectory`, `projectsDirectory`, and
`legacyProfilesPath`. `envFile`, `envFilePath`, `dotenv`, and `dotenvPath` explicitly select a dotenv file; there is no
implicit `.env` search. A selected dotenv file must exist and is read without merging it into `process.env`.

### JSON files

`config.json` contains a default profile and profiles with a base URL and organization ID. `realmId` is optional;
tokens belong in the matching credentials file, not in this profile:

```json
{
  "defaultProfile": "local",
  "profiles": {
    "local": {
      "baseUrl": "https://auth.example.com",
      "organizationId": "org-123",
      "realmId": "realm-123"
    }
  }
}
```

`credentials/local.json` may contain a bearer token and local test-user credentials. The credential object is the exact
value returned by `credentialLookup`:

```json
{
  "token": "bearer-token",
  "testUsers": {
    "testadmin": {
      "userId": "user-123",
      "username": "admin@example.com",
      "password": "test-password"
    }
  }
}
```

`projects/demo.json` selects the profile and project ID:

```json
{
  "profile": "local",
  "projectId": "project-123"
}
```

Missing `config.json` behaves as `{ "profiles": {} }`; missing credential files behave as `{ "testUsers": {} }`.
Credential files are owner-only: loading a credential file enforces mode `0600` and its parent credentials directory
mode `0700`. Keep the containing configuration directory owner-only as well, and protect backups because the JSON is
plaintext.

### Resolution order and environment names

Values are resolved independently. The general order is explicit CLI/library options, process environment, selected
dotenv values, selected project, central profile, legacy profile, then the built-in default where one exists. The
specific selections are:

- Dotenv file: `dotenvPath`, `envFilePath`, `envFile`, or `dotenv`, then `AUTHWORKS_ENV_FILE` or
  `AUTHWORKS_DOTENV_PATH`. The CLI spelling is `--env-file PATH`.
- Project name: `project` or `projectName`, then `AUTHWORKS_PROJECT` or `AUTHWORKS_PROJECT_NAME`, then the selected
  dotenv values. The CLI spelling is `--project NAME`.
- Profile: `profile`, `AUTHWORKS_PROFILE`, selected dotenv `AUTHWORKS_PROFILE`, `defaultProfile`,
  `AUTHWORKS_DEFAULT_PROFILE`, selected dotenv `AUTHWORKS_DEFAULT_PROFILE`, the selected project's `profile`,
  `config.json`'s `defaultProfile`, then the profile named `default` when it exists. The CLI spelling is
  `--profile NAME`.
- Base URL: `baseUrl` or `server`, `AUTHWORKS_BASE_URL`, `AUTHWORKS_URL`, or `AUTHWORKS_SERVER`, selected dotenv
  values with those names, the central profile, then the legacy profile. The final default is
  `http://127.0.0.1:3000`. CLI spellings include `--base-url`, `--url`, and `--server`.
- Organization ID: `organizationId`, `AUTHWORKS_ORGANIZATION_ID`, selected dotenv value, then the selected central or
  legacy profile. The CLI spelling is `--organization-id`.
- Realm ID: `realmId`, `AUTHWORKS_REALM_ID`, selected dotenv value, then the selected central or legacy profile. The
  CLI spelling is `--realm-id`.
- Project ID: `projectId`, `AUTHWORKS_PROJECT_ID`, selected dotenv value, then the selected project's `projectId`. The
  CLI spelling is `--project-id`.
- Bearer token: `token`, `AUTHWORKS_TOKEN`, selected dotenv value, the selected credentials file's `token`, then the
  legacy profile token. The CLI spelling is `--token`.

Empty environment values are ignored. `AUTHWORKS_SYSTEM_SECRET` is not central configuration and is never stored in a
profile; project commands accept `--system-token` and otherwise use that environment value for system access.

### Local credential lookup and CLI retrieval

Credential lookup is local and does not require an API request or token. It chooses an explicit profile first, then a
selected project's profile, then the normal resolved profile, and finally the profile named `default` when no profile
was resolved. It returns `undefined` for an unknown alias and never creates users, resets passwords, or grants
organization administration:

```ts
import { credentialLookup } from "@adaptive-ds/authworks/configuration"

const credential = await credentialLookup({ alias: "testadmin", project: "demo" })
if (!credential.success) throw new Error(credential.errorMessage ?? "Credential lookup failed.")
if (credential.data === undefined) throw new Error("Credential alias was not found.")

console.log(credential.data.userId, credential.data.username, credential.data.password)
```

The CLI exposes the same lookup:

```bash
authworks credentials get testadmin --field userId
authworks credentials get testadmin --field username --project demo --profile local
authworks credentials get testadmin --output json
```

The first two commands print exactly one value. JSON output is exactly one object, for example:

```json
{"userId":"user-123","username":"admin@example.com","password":"test-password"}
```

`--field` accepts `username`, `password`, or `userId`; `--output json` and `--field` are mutually exclusive, and one
of them is required. `credentials get` also accepts `--env-file PATH` and `--project NAME`/`--profile NAME`.

### Project assignments, aliases, and administration boundaries

The canonical assignment commands require explicit realm, project, user, and assignment IDs where applicable:

```bash
authworks projects assignment-create --server https://auth.example.com --token TOKEN \
  --realm-id REALM_ID --project-id PROJECT_ID --user-id USER_ID --role-keys reader,editor
authworks projects assignment-list --server https://auth.example.com --token TOKEN \
  --realm-id REALM_ID --project-id PROJECT_ID
authworks projects assignment-update --server https://auth.example.com --token TOKEN \
  --realm-id REALM_ID --project-id PROJECT_ID --assignment-id ASSIGNMENT_ID --role-keys ""
authworks projects assignment-remove --server https://auth.example.com --token TOKEN \
  --realm-id REALM_ID --project-id PROJECT_ID --assignment-id ASSIGNMENT_ID
```

The shared short aliases are `assign` for `assignment-create`, `edit` for `assignment-update`, and `unassign` for
`assignment-remove`. The longer aliases are `assignment-assign`, `assignment-edit`, and `assignment-unassign`.
`assignment-list` has no short alias. `--role-keys` is comma-separated; omit it for membership-only access and pass an
empty value to clear roles during an update. `--user-id` accepts either a user UUID or a local credential alias:

```bash
authworks projects assign --server https://auth.example.com --token TOKEN \
  --realm-id REALM_ID --project-id PROJECT_ID --user-id testadmin --role-keys reader
```

The assignment command tree also accepts the shared `--env-file`, `--profile`, and `--project` options. `--project`
selects a central project file; it is not a project UUID, so use `--project-id` when an explicit project ID is needed.

Assignment management requires `project.write`. An organization owner or administrator (and a realm administrator) has
the project and application administration permissions for the organization-owned project, including
`project.app.read`, `project.app.write`, and `project.app.delete`. There is no separate persisted “application admin”
role: application administration is permission-based. A direct project assignment grants project access and can expose
resolved project role keys, but it is not organization administration and does not grant assignment management or
application write/delete permissions. Applications must enforce the resolved project access/roles; a local credential
alias only supplies a user ID and credentials.

Central configuration remains compatible with the older CLI profile store. `authworks profile set/list/show/delete`
continues to read and write `${XDG_CONFIG_HOME}/authworks/profiles.json` (or `~/.config/authworks/profiles.json`) with
legacy `server`, `token`, `realmId`, and `organizationId` fields. If a selected name is absent from central
`config.json`, the resolver can read that legacy profile, so existing environment-only and profile-based workflows keep
working. New central profiles use `baseUrl` plus a separate credentials file; the two JSON formats should not be mixed.

## CLI scope defaults

Realm- and organization-scoped commands can still use `AUTHWORKS_REALM_ID` and `AUTHWORKS_ORGANIZATION_ID` as default
scope IDs:

```bash
export AUTHWORKS_REALM_ID=realm-uuid
export AUTHWORKS_ORGANIZATION_ID=organization-uuid
authworks organizations get
```

Explicit `--realm-id` and `--organization-id` flags take precedence over their corresponding environment values. If a
required ID is missing from both the environment and the selected profile, the CLI exits with a validation error before
making the request.

## Direct project user assignments

Project administrators can manage direct memberships with optional project roles. Omit `--role-keys` for membership-only;
pass comma-separated keys for roles, and pass an empty value to clear roles during an update:

```bash
authworks projects assignment-create --realm-id REALM_ID --project-id PROJECT_ID --user-id USER_ID
authworks projects assignment-create --realm-id REALM_ID --project-id PROJECT_ID --user-id ROLE_USER_ID --role-keys reader,editor
authworks projects assignment-list --realm-id REALM_ID --project-id PROJECT_ID
authworks projects assignment-update --realm-id REALM_ID --project-id PROJECT_ID --assignment-id ASSIGNMENT_ID --role-keys ""
authworks projects assignment-remove --realm-id REALM_ID --project-id PROJECT_ID --assignment-id ASSIGNMENT_ID
```

The same operations are available through the project client, for example:

```ts
import { projectApiClientCreate } from "@adaptive-ds/authworks/projects"

const client = projectApiClientCreate({ baseUrl: SERVER_URL, token: TOKEN })
await client.projectUserAssignmentCreate(REALM_ID, PROJECT_ID, { userId: USER_ID, roleKeys: ["reader"] })
```

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
