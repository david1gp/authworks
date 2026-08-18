# Rename zitadel-v2 to authworks

## Goal

Rebrand this alpha project from `zitadel-v2` to `authworks` everywhere that is this project's identity. No backward compatibility. Do not rename sibling products (`zitadel-login`, `zitadel-cli`) or the real ZITADEL reference tree.

## Decisions

- Directory: `/home/david/adaptive/authworks`
- Package: `@adaptive-ds/authworks`
- CLI binary: `authworks`
- GitHub: `david1gp/authworks`
- Env prefix: `AUTHWORKS_*` (drop `ZITADEL_V2_*` and do not keep aliases)
- Database file: `authworks.sqlite`
- Caddy: `caddy-projects edit zitadel-v2 --name authworks --domain authworks.leonardomora.de` if the project exists; otherwise create it
- Passkey RP name: `Authworks`
- DNS verification: `_authworks-verification.<domain>` and `authworks-domain-verification=`
- Crypto namespaces / user-agent: `authworks-mfa`, `authworks-oidc`, `authworks`
- OpenCode: update `project.worktree`, `project_directory.directory`, and session `directory`/`path` for project id `79d89b196aaad10f5c51c042648b932ae4a61fde`
- Leave real-product disclaimers and external reference paths that point at actual ZITADEL / `zitadel-login` / `zitadel-cli`

## Approach

Change in-repo identity first, then GitHub remote/repo, then Caddy, then systemd (none found for this project), then move the directory, then rewrite OpenCode SQLite paths. Run `bun run check` after in-repo edits.

## Tasks

- [x] 1. Rename package, CLI, library export, README, AGENTS.md, workspace file, ops strings, and GitHub URLs in tracked files
- [x] 2. Rename all `ZITADEL_V2_*` env vars, sqlite filename, CLI labels, user-agent, crypto namespaces, DNS verification strings, and passkey RP name in src/ and test/
- [x] 3. Update docs (including plan filename/paths) and remaining zitadel-v2 project identity; keep real ZITADEL product references listed at the end
- [x] 4. Run `bun run check` and fix fallout
- [x] 5. Rename GitHub repo to `authworks` and update git remote
- [x] 6. Update Caddy project name/domain to `authworks` / `authworks.leonardomora.de`
- [x] 7. Stop/update/restart any zitadel-v2 systemd user units if found; none expected
- [x] 8. Move `/home/david/adaptive/zitadel-v2` to `/home/david/adaptive/authworks` and update OpenCode DB paths

## Paths

- Plan: `docs/20260819_rename-to-authworks.md`
- Package: `package.json`, `bun.lock`, `src/outputs/*`, `test/packageName.test.ts`
- Env/config: `src/outputs/server.ts`, `src/platform/cli/scopeIdResolve.ts`, `src/platform/configuration/configurationParse.ts`
- GitHub: `david1gp/zitadel-v2` → `david1gp/authworks`
- Caddy: project `zitadel-v2`
- OpenCode DB: `/home/david/.local/share/opencode/opencode.db`
- Target dir: `/home/david/adaptive/authworks`
