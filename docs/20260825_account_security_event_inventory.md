# Account security event inventory

Task 6 owns the event-to-user subject index used by task 7. A covered event is appended through the events-owned
`eventSecurityEventAppend` server contract. The caller supplies the user subject explicitly; the contract never reads a
subject from actor IDs or event payloads. State, event, and subject-index writes share the caller's SQLite transaction.

The index stores only the event position, realm, explicit user subject, event type, category, and static display code. It
does not store payloads, metadata, OAuth subjects, network identifiers, credential identifiers, secrets, or correlation
identifiers. Query order is always descending event position, and a cursor contains only the last returned position.

| Family | Covered event types | Subject | Category / display mapping |
| --- | --- | --- | --- |
| Sessions | `session.created`, `session.revoked`, `session.revoked_all`, `session.rotated` | The session user subject; machine and bootstrap-admin sessions are not indexed | `sessions` / `session.*` |
| Passwords | `password.credential_changed`, `password.email_verified`, `password.login_failed`, `password.login_succeeded`, `password.locked`, `password.recovered`, `password.recovery_requested`, `password.unlocked`, `password.whatsapp_verified` | The credential or authentication user | `passwords` / `password.*` |
| MFA | `mfa.challenge.completed`, `mfa.challenge.failed`, `mfa.challenge.started`, `mfa.recovery_code.used`, `mfa.recovery_codes.generated`, `mfa.totp.enrollment.confirmed`, `mfa.totp.enrollment.started`, `mfa.totp.removed`, `mfa.totp.verified` | The user completing, enrolling, or receiving the MFA operation | `mfa` / `mfa.*` |
| Passkeys | `passkey.authentication_completed`, `passkey.authentication_started`, `passkey.credential_revoked`, `passkey.credential_used`, `passkey.registration_completed`, `passkey.registration_started` | The user owning the passkey ceremony or credential | `passkeys` / `passkey.*` |
| Linked identities | `external_identity.linked`, `external_identity.unlinked` | The account user whose identity link changed | `linked_identities` / `linked_identity.*` |
| Email changes | `user.email_change_failed`, `user.email_change_requested`, `user.email_change_verified`, `user.email_changed` | The user whose email-change challenge or address changed | `email_changes` / `email_change.*` |
| Refresh-token revocations | `oidc.access_token_revoked`, `oidc.refresh_token_family_revoked` | The token owner's user | `refresh_tokens` / `refresh_token.*` |
| Impersonation notices | `impersonation.started`, `impersonation.ended` | The impersonated user, never the impersonator | `impersonation` / `impersonation.*` |

Policy, provider-administration, generic realm, machine-user, and other event types remain outside the positive
allowlist. Task 7 owns the user-scoped response schema and presentation over this query; this task does not expose the
generic realm event API.
