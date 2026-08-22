# Authworks repository instructions

## Tooling

- Use Bun for installation, scripts, tests, and builds. Keep the package strict ESM TypeScript.
- Run `bun run check` before completing a change. It formats-checks, typechecks, tests, and builds all outputs.
- Use Biome for formatting and linting. Follow the `code-style` skill for TypeScript.
- Run tests with a maximum concurrency of 1.
- After a failure, run only the failing file/test name.

## Architecture and import boundaries

- This repository is one package. Feature code belongs under `src/features/<feature>` and owns its domain, actions,
  persistence, events, routes, public schemas, API client, CLI commands, and tests.
- Shared platform code belongs under `src/platform`. Do not put feature behavior there.
- A feature may consume another feature only through that feature's explicit public, client, server, or CLI surface; do
  not import another feature's internals.
- `src/outputs/server.ts`, `src/outputs/library.ts`, and `src/outputs/cli.ts` are thin static compositions. They must
  not contain feature behavior or access SQLite directly.
- Keep public transport schemas separate from private Drizzle persistence schemas. Do not expose database rows as
  public contracts by default.
- Use explicit relative `.js` specifiers for internal TypeScript imports. Consumers use only the package exports in
  `package.json`, never `src` paths.

## Development services

- Use only repository-managed services defined under `ops/`. Do not start an ad-hoc or replacement server.
- This project currently has no required development service; tests and builds should run without one.

## Scope discipline

- The plan in `docs/20260817_authworks.md` is authoritative. Do not implement later task behavior as part of a scaffold
  or tooling change.
- Keep tests beside the feature they exercise. Use real temporary resources when a later feature needs persistence.
