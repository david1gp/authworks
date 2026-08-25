# Codeline OIDC client provisioning

Use the repository-owned CLI command from a private production shell. It calls
Authworks' authenticated management API; it never opens or edits the Authworks
SQLite database directly.

```bash
export AUTHWORKS_TOKEN # injected by the private production environment
AUTHWORKS_URL=https://authworks.contentoren.de \
AUTHWORKS_REALM_ID='realm-uuid' \
CODELINE_ENV_FILE=/home/david/adaptive/codeline/.env \
bun dist/cli/cli.js oidc client-ensure
```

`AUTHWORKS_TOKEN` should be supplied by the private production environment,
not a command-line argument or a tracked file. `--server`, `--realm-id`,
`--env-file`, `--client-id`, and `--name` override their corresponding
environment/default values. The default client name is `Codeline preview`.

The command is idempotent:

- It first uses an existing client ID from `OIDC_AUTHWORKS_CLIENT_ID`,
  `OIDC_CLIENT_ID`, or `ZITADEL_CLIENT_ID`, then falls back to the unique exact
  client name.
- It refuses ambiguous names and refuses to modify a public client.
- It creates a confidential client when no target exists.
- It updates configuration drift and reactivates an inactive target without
  rotating an existing secret.
- It treats an existing secret as write-only. Only a newly generated or
  explicitly rotated secret is written to the existing ignored environment
  aliases: `OIDC_AUTHWORKS_CLIENT_ID`, `OIDC_AUTHWORKS_CLIENT_SECRET`,
  `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `ZITADEL_CLIENT_ID`, and
  `ZITADEL_CLIENT_SECRET`. All six aliases are replaced atomically. Duplicate
  credential keys are refused before any replacement.

The environment file must already exist, be a regular writable file, and is
replaced with a mode-`0600` temporary file using an atomic rename. The command
prints only non-secret client metadata and a stored/preserved credential
status. It does not print the generated secret or management token.

The enforced client configuration is:

- exact redirect URI: `https://preview.codeline.work/api/auth/callback`
- scopes: `openid profile email urn:zitadel:iam:user:resourceowner`
- client type: `confidential`
- `trusted=true`, `requireConsent=false`
- no post-logout redirect URI
- PKCE `S256`

PKCE is not a stored per-client flag in Authworks. Authworks requires
`code_challenge_method=S256` on authorization requests, advertises only S256
in discovery, and verifies the code verifier during code redemption. The
Codeline client already uses that Authorization Code + PKCE flow.

The command never rotates a secret automatically. If a pre-existing client
secret is missing, use the separately protected secret-rotation workflow and
an approved one-time handoff rather than rerunning creation.

## Fixed production bridge

Production automation uses the narrower, zero-argument command below rather
than supplying tokens, realm IDs, server URLs, paths, or names as CLI flags:

```text
authworks oidc codeline-production-ensure
```

It reads `AUTHWORKS_SYSTEM_SECRET` from the managed app user's fixed existing
owner-only `/home/authworks/.config/authworks/authworks.env`, calls the fixed
`https://authworks.contentoren.de` management API, and resolves the realm by
the existing domain model. Exactly one active realm must own
`authworks.contentoren.de`, and that domain must be primary. Zero/multiple
matches, an alias-only match, an inactive realm, or multiple clients matching
the exact name or callback URI are refused without mutation.

The command has no stdout on unchanged or configuration-only update. Only a
new confidential client produces a single one-time JSON credential envelope:

```json
{"clientId":"<uuid>","clientSecret":"<one-time-secret>","kind":"authworks.codeline-oidc-credential","version":1}
```

This stdout is a machine handoff protocol, not human output. The dedicated
prodctl client captures it internally and never prints it. Existing secrets
remain write-only and never produce an envelope.

## Fixed production secret rotation

Use the separate zero-argument operation only to recover a proven confidential
client authentication failure such as `token_exchange_invalid_client`:

```text
authworks oidc codeline-production-secret-rotate
```

The operation uses the same fixed production origin, owner-only system-secret
file, and unique active primary realm resolution as the ensure bridge. It does
not create, update, reactivate, or otherwise converge a client. Before the only
mutation, it lists every client page and requires exactly one identity candidate
matching the fixed `Codeline preview` name or callback. That candidate must be
active and confidential, with the exact name and the sole redirect URI
`https://preview.codeline.work/api/auth/callback`. Missing, ambiguous, public,
inactive, differently named, extra-callback, and wrong-callback clients fail
without rotation.

Success calls only the existing authenticated client-secret rotation API and
writes exactly one unchanged version-1 `authworks.codeline-oidc-credential`
envelope to stdout. Failure stdout is empty. Failure stderr is exactly one
canonical JSON line containing only an allowlisted code; IDs, credentials,
envelopes, HTTP bodies, exception text, and raw API diagnostics are never part of
the failure protocol.

The private envelope handoff that applies a newly rotated credential to an
environment file must use the same atomic updater: it replaces all six client
ID/secret aliases listed above and refuses duplicate keys. This repository does
not execute that production handoff.

| Exit | Canonical stderr code |
| ---: | --- |
| 40 | `oidc.codeline-secret-rotate.input-invalid` |
| 41 | `oidc.codeline-secret-rotate.realm-not-found` |
| 42 | `oidc.codeline-secret-rotate.realm-ambiguous` |
| 43 | `oidc.codeline-secret-rotate.realm-inactive` |
| 44 | `oidc.codeline-secret-rotate.api-unauthorized` |
| 45 | `oidc.codeline-secret-rotate.api-unreachable` |
| 46 | `oidc.codeline-secret-rotate.api-invalid-response` |
| 47 | `oidc.codeline-secret-rotate.client-not-found` |
| 48 | `oidc.codeline-secret-rotate.client-ambiguous` |
| 49 | `oidc.codeline-secret-rotate.client-inactive` |
| 50 | `oidc.codeline-secret-rotate.client-public` |
| 51 | `oidc.codeline-secret-rotate.client-name-mismatch` |
| 52 | `oidc.codeline-secret-rotate.client-callback-mismatch` |
| 53 | `oidc.codeline-secret-rotate.client-cardinality-mismatch` |
| 54 | `oidc.codeline-secret-rotate.rotation-rejected` |
| 55 | `oidc.codeline-secret-rotate.envelope-invalid` |
| 56 | `oidc.codeline-secret-rotate.internal-failed` |

The exit/code pair is exact and stable. Unknown failures close to exit 56 and
the canonical internal code. The envelope remains a one-time machine protocol
and must be captured by the dedicated prodctl rotation command, never invoked in
a terminal or through generic execution. Rotation is irreversible: if the
downstream handoff fails after the API accepts rotation, the operation fails
closed and must be rerun through the same workflow.
