import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import type { AccountSecurityHistoryItem } from "../public/accountSecurityHistoryItemSchema.js"

const categoryMessageKeyByCategory = {
  email_changes: "account.securityHistory.category.emailChanges",
  impersonation: "account.securityHistory.category.impersonation",
  linked_identities: "account.securityHistory.category.linkedIdentities",
  mfa: "account.securityHistory.category.mfa",
  passwords: "account.securityHistory.category.passwords",
  passkeys: "account.securityHistory.category.passkeys",
  refresh_tokens: "account.securityHistory.category.refreshTokens",
  sessions: "account.securityHistory.category.sessions",
} as const satisfies Readonly<Record<AccountSecurityHistoryItem["category"], MessageKey>>

const displayMessageKeyByCode = {
  "email_change.changed": "account.securityHistory.event.emailChanged",
  "email_change.failed": "account.securityHistory.event.emailChangeFailed",
  "email_change.requested": "account.securityHistory.event.emailChangeRequested",
  "email_change.verified": "account.securityHistory.event.emailChangeVerified",
  "impersonation.ended": "account.securityHistory.event.impersonationEnded",
  "impersonation.started": "account.securityHistory.event.impersonationStarted",
  "linked_identity.linked": "account.securityHistory.event.identityLinked",
  "linked_identity.unlinked": "account.securityHistory.event.identityUnlinked",
  "mfa.challenge.completed": "account.securityHistory.event.mfaCompleted",
  "mfa.challenge.failed": "account.securityHistory.event.mfaFailed",
  "mfa.challenge.started": "account.securityHistory.event.mfaStarted",
  "mfa.recovery_code.used": "account.securityHistory.event.recoveryCodeUsed",
  "mfa.recovery_codes.generated": "account.securityHistory.event.recoveryCodesGenerated",
  "mfa.totp.enrollment.confirmed": "account.securityHistory.event.totpEnrollmentConfirmed",
  "mfa.totp.enrollment.started": "account.securityHistory.event.totpEnrollmentStarted",
  "mfa.totp.removed": "account.securityHistory.event.totpRemoved",
  "mfa.totp.verified": "account.securityHistory.event.totpVerified",
  "passkey.authentication_completed": "account.securityHistory.event.passkeyAuthenticationCompleted",
  "passkey.authentication_started": "account.securityHistory.event.passkeyAuthenticationStarted",
  "passkey.credential_revoked": "account.securityHistory.event.passkeyCredentialRevoked",
  "passkey.credential_used": "account.securityHistory.event.passkeyCredentialUsed",
  "passkey.registration_completed": "account.securityHistory.event.passkeyRegistrationCompleted",
  "passkey.registration_started": "account.securityHistory.event.passkeyRegistrationStarted",
  "password.credential_changed": "account.securityHistory.event.passwordChanged",
  "password.email_verified": "account.securityHistory.event.passwordEmailVerified",
  "password.locked": "account.securityHistory.event.passwordLocked",
  "password.login_failed": "account.securityHistory.event.passwordLoginFailed",
  "password.login_succeeded": "account.securityHistory.event.passwordLoginSucceeded",
  "password.recovered": "account.securityHistory.event.passwordRecovered",
  "password.recovery_requested": "account.securityHistory.event.passwordRecoveryRequested",
  "password.unlocked": "account.securityHistory.event.passwordUnlocked",
  "password.whatsapp_verified": "account.securityHistory.event.passwordWhatsappVerified",
  "refresh_token.access_revoked": "account.securityHistory.event.accessTokenRevoked",
  "refresh_token.family_revoked": "account.securityHistory.event.refreshTokenFamilyRevoked",
  "session.created": "account.securityHistory.event.sessionCreated",
  "session.revoked": "account.securityHistory.event.sessionRevoked",
  "session.revoked_all": "account.securityHistory.event.sessionsRevoked",
  "session.rotated": "account.securityHistory.event.sessionRotated",
} as const satisfies Readonly<Record<AccountSecurityHistoryItem["displayCode"], MessageKey>>

/** Returns the catalog keys describing a security-history item's category and its safe display text. */
export function accountSecurityHistoryMessageKeyGet(item: AccountSecurityHistoryItem): {
  readonly category: MessageKey
  readonly display: MessageKey
} {
  return { category: categoryMessageKeyByCategory[item.category], display: displayMessageKeyByCode[item.displayCode] }
}
