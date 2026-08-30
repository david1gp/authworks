import type { Result } from "#result"
import { externalIdentityApiClientCreate } from "../../externalIdentities/client/externalIdentityApiClientCreate.js"
import type { ExternalIdentityLinkCompleteRequest } from "../../externalIdentities/public/externalIdentityLinkCompleteRequestSchema.js"
import { externalIdentityLinkCompleteResponseSchema } from "../../externalIdentities/public/externalIdentityLinkCompleteResponseSchema.js"
import { externalIdentityStartResponseSchema } from "../../externalIdentities/public/externalIdentityStartResponseSchema.js"
import { externalIdentityUnlinkResponseSchema } from "../../externalIdentities/public/externalIdentityUnlinkResponseSchema.js"
import { mfaApiClientCreate } from "../../mfa/client/mfaApiClientCreate.js"
import { mfaRecoveryCodesResponseSchema } from "../../mfa/public/mfaRecoveryCodesResponseSchema.js"
import type { MfaTotpEnrollmentConfirmRequest } from "../../mfa/public/mfaTotpEnrollmentConfirmRequestSchema.js"
import { mfaTotpEnrollmentConfirmResponseSchema } from "../../mfa/public/mfaTotpEnrollmentConfirmResponseSchema.js"
import type { MfaTotpEnrollmentRemoveRequest } from "../../mfa/public/mfaTotpEnrollmentRemoveRequestSchema.js"
import { mfaTotpEnrollmentRemoveResponseSchema } from "../../mfa/public/mfaTotpEnrollmentRemoveResponseSchema.js"
import { mfaTotpEnrollmentStartResponseSchema } from "../../mfa/public/mfaTotpEnrollmentStartResponseSchema.js"
import { oidcApiClientCreate } from "../../oidc/client/oidcApiClientCreate.js"
import { oidcRefreshTokenRevokeResponseSchema } from "../../oidc/public/oidcRefreshTokenRevokeResponseSchema.js"
import { passkeyApiClientCreate } from "../../passkeys/client/passkeyApiClientCreate.js"
import { passkeyCredentialRevokeResponseSchema } from "../../passkeys/public/passkeyCredentialRevokeResponseSchema.js"
import type { PasskeyRegistrationCompleteRequest } from "../../passkeys/public/passkeyRegistrationCompleteRequestSchema.js"
import { passkeyRegistrationCompleteResponseSchema } from "../../passkeys/public/passkeyRegistrationCompleteResponseSchema.js"
import { passkeyRegistrationStartResponseSchema } from "../../passkeys/public/passkeyRegistrationStartResponseSchema.js"
import { sessionApiClientCreate } from "../../sessions/client/sessionApiClientCreate.js"
import { sessionBrowserRequest } from "../../sessions/client/sessionBrowserRequest.js"
import { sessionRevocationResponseSchema } from "../../sessions/public/sessionRevocationResponseSchema.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"
import { accountApiClientCreate } from "../client/accountApiClientCreate.js"

type AccountSecurityFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export function accountSecurityApiCreate(options: { readonly baseUrl: string; readonly fetch?: AccountSecurityFetch }) {
  const browserFetch: AccountSecurityFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "include" })
  const sessions = sessionApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const passkeys = passkeyApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const mfa = mfaApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const identities = externalIdentityApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const oidc = oidcApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const users = userApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const account = accountApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
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
    identityCallback: identities.externalIdentityCallback,
    identitiesList: identities.externalIdentityMeList,
    identityLinkComplete: (realmId: string, providerId: string, input: ExternalIdentityLinkCompleteRequest) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/external-identities/${encodeURIComponent(providerId)}/link/complete`,
        { body: JSON.stringify(input), method: "POST" },
        externalIdentityLinkCompleteResponseSchema,
      ),
    identityLinkStart: (realmId: string, providerId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/external-identities/${encodeURIComponent(providerId)}/link/start`,
        { body: "{}", method: "POST" },
        externalIdentityStartResponseSchema,
      ),
    identityProvidersList: (realmId: string) => identities.externalIdentityProviderMeList(realmId),
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
    refreshTokenRevoke: (realmId: string, familyId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/refresh-tokens/${encodeURIComponent(familyId)}/revoke`,
        { method: "POST" },
        oidcRefreshTokenRevokeResponseSchema,
      ),
    refreshTokensList: oidc.oidcRefreshTokenMeList,
    refreshTokensRevokeAll: (realmId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/refresh-tokens/revoke-all`,
        { method: "POST" },
        oidcRefreshTokenRevokeResponseSchema,
      ),
    securityHistoryList: account.securityHistoryList,
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
    totpRemove: (realmId: string, input: MfaTotpEnrollmentRemoveRequest = {}) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/mfa/totp`,
        { body: JSON.stringify(input), method: "DELETE" },
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
    featureClients: { identities, mfa, oidc, passkeys, sessions, users },
  }
}
