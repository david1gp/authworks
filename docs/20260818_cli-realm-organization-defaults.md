# CLI realm and organization defaults

## Goal

Allow realm- and organization-scoped CLI commands to use environment-provided default IDs so users do not need to pass the same flags repeatedly.

## Decisions

- Use `AUTHWORKS_REALM_ID` and `AUTHWORKS_ORGANIZATION_ID`.
- Explicit `--realm-id` and `--organization-id` values override environment defaults.
- Commands still fail through normal CLI validation when a required ID has neither a flag nor an environment value.
- Realm-independent commands remain unchanged.
- Keep CLI output unchanged.

## Approach

- Add shared CLI scope-ID resolution that reads the command flag first and the injected process environment second.
- Make required scope flags optional at argument parsing, then validate the resolved value before invoking feature API clients.
- Apply the behavior consistently to every realm- and organization-scoped command.
- Add focused CLI subprocess coverage for environment defaults, missing values, and flag precedence.

## Tasks

- [x] 1. Implement shared scope default resolution and adopt it across CLI feature commands.
- [x] 2. Add focused tests and user-facing CLI documentation/help coverage.
- [x] 3. Run repository verification and fix only issues caused by this feature.

## Current context

- Task 1 added shared scope resolution and applied flag-over-environment precedence across scoped CLI commands.
- Task 2 added CLI subprocess coverage and documented the environment variables and precedence in `README.md`.
- Task 3 confirmed complete scoped-command coverage, rejected blank defaults, and passed repository verification.

## Paths

- `src/features/*/cli/*CliCommands.ts`
- `src/platform/cli/`
- `test/cli/cliSurfaces.test.ts`
- `test/build/distributableOutputs.test.ts`
- `README.md`
