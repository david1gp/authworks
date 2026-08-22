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
bun run release  # git-cliff changelog + tag
bun run deploy   # full check plus optional live HTTPS smoke
```

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
