# Contentoren `ssotest` production account

Run the repository-owned operator command from a private production shell:

```bash
export AUTHWORKS_TOKEN
export AUTHWORKS_CONTENTOREN_SSOTEST_EMAIL
export AUTHWORKS_CONTENTOREN_SSOTEST_PASSWORD
bun dist/cli/cli.js passwords contentoren-ssotest-production-ensure
```

`AUTHWORKS_TOKEN` must be the production system token. The private email and
password may instead be supplied as one strict JSON object on stdin:

```text
{"email":"<private-email>","password":"<private-password>"}
```

Do not combine environment and stdin input. If either private environment
variable is present, both are required and stdin is ignored. The command has no
flags, uses only `https://authworks.contentoren.de`, and keeps Authworks as the
OIDC issuer. Do not place any of these values in tracked files or command-line
arguments.

The command validates the email and password before mutation, including the
production realm password policy. It then:

- resolves exactly one active realm whose primary domain is
  `authworks.contentoren.de`;
- resolves exactly one active organization named `Contentoren`;
- refuses conflicting human or machine identities in any realm;
- finds or creates the realm-local human whose exact normalized user name is
  `ssotest` and whose exact normalized email is the supplied private email;
- refuses deleted identities, elevated `owner`/`admin` memberships, and
  multiple active organization memberships;
- operator-verifies the email/registration, activates the human, securely
  creates or replaces its password through the authenticated management API,
  clears password lockout state, and converges its sole active organization
  membership to exactly `member`.

Password replacement uses Authworks password policy, hashing, transaction,
lockout, and audit-event domain behavior. It never edits SQLite directly. The
command emits only one redacted JSON status:

```json
{"status":"created"}
```

The other possible statuses are `updated` and `reused`. It never emits the
email, password, system token, user ID, organization ID, or password hash.

## Failure output contract

Successful output is unchanged. Every failed command exits with status `1`,
writes no stdout, and writes exactly one JSON object to stderr followed by a
newline:

```json
{"error":{"code":"passwords.contentoren-ssotest-ensure.<reason>"}}
```

The closed reason-code set is:

- `authorization-unavailable`
- `input-invalid`
- `realm-not-found`, `realm-ambiguous`, `realm-inactive`
- `organization-not-found`, `organization-ambiguous`,
  `organization-inactive`
- `human-ambiguous`, `human-conflict`, `human-deleted`, `machine-conflict`
- `membership-elevated`, `membership-ambiguous`
- `password-policy-rejected`
- `api-unreachable`, `api-unauthorized`, `api-forbidden`,
  `api-rate-limited`, `api-rejected`, `api-failed`
- `api-invalid-response.realm-list`, `api-invalid-response.organization-list`,
  `api-invalid-response.password-policy-get`,
  `api-invalid-response.user-list`,
  `api-invalid-response.machine-user-list`
- `api-invalid-response.membership-list.envelope`,
  `api-invalid-response.membership-list.items`,
  `api-invalid-response.membership-list.id`,
  `api-invalid-response.membership-list.realm-id`,
  `api-invalid-response.membership-list.organization-id`,
  `api-invalid-response.membership-list.user-id`,
  `api-invalid-response.membership-list.created-at`,
  `api-invalid-response.membership-list.updated-at`,
  `api-invalid-response.membership-list.roles`,
  `api-invalid-response.membership-list.next-page-token`,
  `api-invalid-response.membership-list.unknown`
- `api-invalid-response.user-create`,
  `api-invalid-response.user-email-verification-set`,
  `api-invalid-response.user-lifecycle-set`,
  `api-invalid-response.password-credential-replace`,
  `api-invalid-response.membership-create`,
  `api-invalid-response.membership-update`
- `internal-failed`

The command never writes an error message, API body, request ID, identifier,
email, password, token, hash, or other failure detail. Remote HTTP and
transport failures are normalized to the closed `api-*` set; unexpected
exceptions use `internal-failed`. Invalid successful API responses include
only the closed operation stage suffix shown above; they never include a URL,
ID, status, response body, credential or account data, or raw message.

For `membership-list`, the response-schema diagnostic uses exactly one field
category. `envelope` means the top-level value is not the strict list envelope
or has an extra top-level field; `items` means `items` is not an array or an
item is not an object; the remaining categories identify the corresponding
strict membership field, and `unknown` covers an extra membership field or a
failure not attributable to an allowlisted field. Missing `items` is `items`,
and the optional `nextPageToken` is checked only when present. No category
contains a value, array index, path, status, URL, ID, or raw validation
message.

## Operator password API

The command uses the system-token-only endpoint
`POST /system/realms/:realmId/users/:userId/password` with the strict body
`{"password":"<private-password>"}`. It returns only `{"changed":true}` or
`{"changed":false}`. The endpoint validates the realm password policy, creates
or replaces the credential hash, clears lockout state, and appends the normal
audit-safe password event when the credential changes. It is not a recovery or
self-service endpoint and never returns credential material.
