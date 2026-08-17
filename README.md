# @adaptive-ds/zitadel-v2

Identity backend you can run as a Hono server, import as a typed client, or drive from a CLI. One Bun package. Features own their routes, schemas, events, and tests.

This is an alpha rewrite. Schema resets are allowed. Current-state SQLite tables stay authoritative. An append-only event log records domain facts without secrets.

## What it covers

- Users, passwords, sessions, recovery, and rate limits
- Email OTP, social login, recent accounts
- Instances, organizations, memberships, roles
- OIDC clients, PKCE, tokens, discovery, JWKS, logout
- TOTP, recovery codes, passkeys, step-up
- Machine users, PATs, client credentials, grants

## Install

```bash
bun add @adaptive-ds/zitadel-v2
```

## Scripts

```bash
bun run dev      # start the server entry
bun test         # bun tests
bun run build    # emit dist/
bun run format   # biome
bun run release  # git-cliff changelog + tag
```

## Layout

```txt
src/features/<feature>   domain, actions, routes, public schemas, client, cli
src/platform             ids, clocks, errors, config, storage
src/outputs              thin server, library, and cli composition
```

Outputs import features. They do not contain feature logic. Missing imports fail at build time.

## Links

- code: https://github.com/david1gp/zitadel-v2
- npm: https://www.npmjs.com/package/@adaptive-ds/zitadel-v2
- issues: https://github.com/david1gp/zitadel-v2/issues

## License

MIT
