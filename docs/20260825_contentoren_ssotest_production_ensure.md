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

## Operator password API

The command uses the system-token-only endpoint
`POST /system/realms/:realmId/users/:userId/password` with the strict body
`{"password":"<private-password>"}`. It returns only `{"changed":true}` or
`{"changed":false}`. The endpoint validates the realm password policy, creates
or replaces the credential hash, clears lockout state, and appends the normal
audit-safe password event when the credential changes. It is not a recovery or
self-service endpoint and never returns credential material.
