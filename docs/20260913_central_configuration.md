# Central Authworks configuration

## Goal
Provide shared Linux-user configuration, local organization credentials, project selection, and native project-role assignment commands through Authworks CLI and TypeScript library.

## Decisions
- Use `$XDG_CONFIG_HOME/authworks` or `~/.config/authworks`, with `config.json`, `credentials/{profile}.json`, and `projects/{project}.json` in the requested flat formats. Credential files are restricted to 0600.
- Use Authworks names and `AUTHWORKS_*` environment variables. Preserve existing CLI/library inputs and legacy connection profiles. Leave ZITADEL migration compatibility unchanged.
- Resolve CLI/options > environment > explicitly selected existing dotenv file > selected project > central profile > defaults. Support profile, project selection, base URL, organization ID, project ID, token, and existing realm context.
- Export typed reusable configuration loaders/resolver and local credential lookup; CLI delegates to these functions. Consumers can inject options, environment, and filesystem location.
- Credential retrieval needs no API/token; select explicit profile, project profile, or default profile. Shared aliases resolve locally. Never create users, reset passwords, or grant organization administration automatically.
- Native assignments build on existing direct-assignment work in `docs/20260913_project_user_assignments.md`; preserve role-definition commands and organization grants. Applications enforce project roles.
- Use existing dependencies, feature boundaries, Bun, and single-concurrency tests. Preserve unrelated working-tree changes.

## Approach
Implement the public configuration core first, then CLI integration and credential retrieval. Integrate existing native assignment actions with access evaluation, routes/client, and CLI in separate increments. Document and run repository checks before committing, deploying, and releasing through existing tooling.

## Tasks
1. Completed: Implement and export central configuration/credentials core, precedence, compatibility, and focused tests. Public library surface: `authworks/configuration`.
2. Completed: Integrate CLI options/project selection and credentials get with focused tests.
3. Completed: Complete native assignment access evaluation using existing assignment actions, with focused tests.
4. Completed: Expose assignment HTTP/library operations with contract tests.
5. Completed: Add CLI assign/list/edit/unassign and shared alias lookup with focused tests.
6. Completed: Add CLI/library usage documentation and run repository checks.
7. In progress: Delegate commits skill to a Luna subagent, then deploy and release using repository tooling.
