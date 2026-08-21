import type { Result } from "#result"
import { externalIdentityApiClientCreate } from "../../externalIdentities/client/externalIdentityApiClientCreate.js"
import { externalIdentityUnlinkResponseSchema } from "../../externalIdentities/public/externalIdentityUnlinkResponseSchema.js"
import { mfaApiClientCreate } from "../../mfa/client/mfaApiClientCreate.js"
import { mfaRecoveryCodesResponseSchema } from "../../mfa/public/mfaRecoveryCodesResponseSchema.js"
import type { MfaTotpEnrollmentConfirmRequest } from "../../mfa/public/mfaTotpEnrollmentConfirmRequestSchema.js"
import { mfaTotpEnrollmentConfirmResponseSchema } from "../../mfa/public/mfaTotpEnrollmentConfirmResponseSchema.js"
import { mfaTotpEnrollmentRemoveResponseSchema } from "../../mfa/public/mfaTotpEnrollmentRemoveResponseSchema.js"
import { mfaTotpEnrollmentStartResponseSchema } from "../../mfa/public/mfaTotpEnrollmentStartResponseSchema.js"
import { passkeyApiClientCreate } from "../../passkeys/client/passkeyApiClientCreate.js"
import { passkeyCredentialRevokeResponseSchema } from "../../passkeys/public/passkeyCredentialRevokeResponseSchema.js"
import type { PasskeyRegistrationCompleteRequest } from "../../passkeys/public/passkeyRegistrationCompleteRequestSchema.js"
import { passkeyRegistrationCompleteResponseSchema } from "../../passkeys/public/passkeyRegistrationCompleteResponseSchema.js"
import { passkeyRegistrationStartResponseSchema } from "../../passkeys/public/passkeyRegistrationStartResponseSchema.js"
import { sessionApiClientCreate } from "../../sessions/client/sessionApiClientCreate.js"
import { sessionBrowserRequest } from "../../sessions/client/sessionBrowserRequest.js"
import { sessionRevocationResponseSchema } from "../../sessions/public/sessionRevocationResponseSchema.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"

type AccountSecurityFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export function accountSecurityApiCreate(options: { readonly baseUrl: string; readonly fetch?: AccountSecurityFetch }) {
  const browserFetch: AccountSecurityFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "include" })
  const sessions = sessionApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const passkeys = passkeyApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const mfa = mfaApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const identities = externalIdentityApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const users = userApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const mutate = <T>(
    realmId: string,
    path: string,
    init: RequestInit,
    schema: Parameters<typeof sessionBrowserRequest<T>>[0]["schema"],
  ): Promise<Result<T>> =>
    sessionBrowserRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "accountSecurityMutation",
      path,
      realmId,
      schema,
    })

  return {
    identitiesList: identities.externalIdentityMeList,
    identityUnlink: (realmId: string, providerId: string, externalSubject: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/external-identities/${encodeURIComponent(providerId)}/${encodeURIComponent(externalSubject)}`,
        { method: "DELETE" },
        externalIdentityUnlinkResponseSchema,
      ),
    methodsGet: users.userMeAuthenticationMethodsGet,
    passkeyComplete: (realmId: string, input: PasskeyRegistrationCompleteRequest) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/passkeys/registration/complete`,
        { body: JSON.stringify(input), method: "POST" },
        passkeyRegistrationCompleteResponseSchema,
      ),
    passkeyList: passkeys.passkeyCredentialList,
    passkeyRevoke: (realmId: string, credentialId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/passkeys`,
        { body: JSON.stringify({ credentialId }), method: "DELETE" },
        passkeyCredentialRevokeResponseSchema,
      ),
    passkeyStart: (realmId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/passkeys/registration/start`,
        { body: "{}", method: "POST" },
        passkeyRegistrationStartResponseSchema,
      ),
    recoveryCodesGenerate: (realmId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/mfa/recovery-codes`,
        { body: "{}", method: "POST" },
        mfaRecoveryCodesResponseSchema,
      ),
    sessionsList: sessions.sessionMeList,
    sessionRevoke: (realmId: string, sessionId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/sessions/${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
        sessionRevocationResponseSchema,
      ),
    sessionsRevokeAll: (realmId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/sessions`,
        { method: "DELETE" },
        sessionRevocationResponseSchema,
      ),
    totpConfirm: (realmId: string, input: MfaTotpEnrollmentConfirmRequest) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/mfa/totp/confirm`,
        { body: JSON.stringify(input), method: "POST" },
        mfaTotpEnrollmentConfirmResponseSchema,
      ),
    totpRemove: (realmId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/mfa/totp`,
        { method: "DELETE" },
        mfaTotpEnrollmentRemoveResponseSchema,
      ),
    totpStart: (realmId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/mfa/totp/enroll`,
        { body: "{}", method: "POST" },
        mfaTotpEnrollmentStartResponseSchema,
      ),
    // Keep completed feature clients in this adapter even where mutations require a freshly fetched CSRF token.
    featureClients: { identities, mfa, passkeys, sessions, users },
  }
}
