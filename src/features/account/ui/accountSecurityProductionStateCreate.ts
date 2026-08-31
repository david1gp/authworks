import { createEffect, on, onCleanup } from "solid-js"
import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ExternalIdentityCallbackResponse } from "../../externalIdentities/public/externalIdentityCallbackResponseSchema.js"
import { externalIdentityCallbackResponseSchema } from "../../externalIdentities/public/externalIdentityCallbackResponseSchema.js"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import type { ExternalIdentity } from "../../externalIdentities/public/externalIdentitySchema.js"
import type { MfaTotpEnrollmentStartResponse } from "../../mfa/public/mfaTotpEnrollmentStartResponseSchema.js"
import type { OidcRefreshTokenMetadata } from "../../oidc/public/oidcRefreshTokenMetadataSchema.js"
import type { PasskeyCredential } from "../../passkeys/public/passkeyCredentialSchema.js"
import type { SessionMe } from "../../sessions/public/sessionMeSchema.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import type { User } from "../../users/public/userSchema.js"
import type { AccountSecurityHistoryItem } from "../public/accountSecurityHistoryItemSchema.js"
import { accountSecurityApiCreate } from "./accountSecurityApiCreate.js"
import type { AccountSecurityScreen } from "./accountSecurityScreenSchema.js"
import { passkeyRegistrationRun } from "./passkeyRegistrationRun.js"

const emptyMethods: UserAuthenticationMethods = {
  emailOtp: { available: false },
  passkeys: { credentials: [] },
  password: { available: false },
  recoveryCodes: { available: false, generatedAt: null, remaining: 0 },
  totp: { enrolled: false, enrollments: [] },
}

export function accountSecurityProductionStateCreate(options: {
  readonly apiBaseUrl?: string
  readonly realmId: () => string
  readonly screen: () => AccountSecurityScreen
}) {
  const apiBaseUrl = options.apiBaseUrl ?? window.location.origin
  const api = accountSecurityApiCreate({ baseUrl: apiBaseUrl })
  const status = createSignalObject<"error" | "loading" | "ready">("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const sessions = createSignalObject<SessionMe[]>([])
  const refreshTokens = createSignalObject<OidcRefreshTokenMetadata[]>([])
  const securityHistory = createSignalObject<AccountSecurityHistoryItem[]>([])
  const securityHistoryNextPageToken = createSignalObject<string | undefined>(undefined)
  const passkeys = createSignalObject<PasskeyCredential[]>([])
  const methods = createSignalObject<UserAuthenticationMethods>(emptyMethods)
  const user = createSignalObject<User | undefined>(undefined)
  const identities = createSignalObject<ExternalIdentity[]>([])
  const identityProviders = createSignalObject<ExternalIdentityProvider[]>([])
  const identityLinkConfirmation = createSignalObject<
    Extract<ExternalIdentityCallbackResponse, { readonly kind: "link_confirmation" }> | undefined
  >(undefined)
  const identityLinkProvider = createSignalObject<string | undefined>(undefined)
  const identityLinkMessageNonce = createSignalObject<string | undefined>(undefined)
  const identityLinkCallbackOrigin = createSignalObject<string | undefined>(undefined)
  const oneTimeCodes = createSignalObject<string[]>([])
  const totpDialogOpen = createSignalObject(false)
  const totpError = createSignalObject<string | undefined>(undefined)
  const totpSetup = createSignalObject<MfaTotpEnrollmentStartResponse | undefined>(undefined)
  const totpCode = createSignalObject("")
  let totpFlowGeneration = 0
  let identityLinkPopup: Window | null = null

  const failed = (message: string) => {
    error.set(message)
    status.set("error")
  }
  const load = async () => {
    status.set("loading")
    error.set(undefined)
    const realmId = options.realmId()
    const screen = options.screen()
    if (screen === "overview") {
      const [methodsResult, userResult, passkeysResult, identitiesResult, providersResult] = await Promise.all([
        api.methodsGet(realmId),
        api.userGet(realmId),
        api.passkeyList(realmId),
        api.identitiesList(realmId),
        api.identityProvidersList(realmId),
      ])
      if (!methodsResult.success) return failed(methodsResult.errorMessage)
      if (!userResult.success) return failed(userResult.errorMessage)
      if (!passkeysResult.success) return failed(passkeysResult.errorMessage)
      if (!identitiesResult.success) return failed(identitiesResult.errorMessage)
      if (!providersResult.success) return failed(providersResult.errorMessage)
      if (methodsResult.status === "current") methods.set(methodsResult.data)
      if (userResult.status === "current") user.set(userResult.data.user)
      passkeys.set(passkeysResult.data.items.filter((credential) => credential.revokedAt === null))
      identities.set(identitiesResult.data.items)
      identityProviders.set(providersResult.data.items)
    }
    if (screen === "sessions") {
      const result = await api.sessionsList(realmId)
      if (!result.success) return failed(result.errorMessage)
      sessions.set(result.data.items.filter((session) => session.revokedAt === null))
    }
    if (screen === "refresh-tokens") {
      const result = await api.refreshTokensList(realmId)
      if (!result.success) return failed(result.errorMessage)
      refreshTokens.set(result.data.items)
    }
    if (screen === "security-history") {
      const result = await api.securityHistoryList(realmId, { pageSize: 20 })
      if (!result.success) return failed(result.errorMessage)
      securityHistory.set(result.data.items)
      securityHistoryNextPageToken.set(result.data.nextPageToken)
    }
    if (screen === "passkeys") {
      const result = await api.passkeyList(realmId)
      if (!result.success) return failed(result.errorMessage)
      passkeys.set(result.data.items.filter((credential) => credential.revokedAt === null))
    }
    if (screen === "factors" || screen === "recovery-codes") {
      const result = await api.methodsGet(realmId)
      if (!result.success) return failed(result.errorMessage)
      if (result.status === "current") methods.set(result.data)
    }
    if (screen === "identities") {
      const [identitiesResult, providersResult] = await Promise.all([
        api.identitiesList(realmId),
        api.identityProvidersList(realmId),
      ])
      if (!identitiesResult.success) return failed(identitiesResult.errorMessage)
      if (!providersResult.success) return failed(providersResult.errorMessage)
      identities.set(identitiesResult.data.items)
      identityProviders.set(providersResult.data.items)
    }
    status.set("ready")
  }
  const mutate = async (id: string, operation: () => Promise<{ success: boolean; errorMessage?: string }>) => {
    pendingId.set(id)
    error.set(undefined)
    const result = await operation()
    pendingId.set(undefined)
    if (!result.success) {
      error.set(result.errorMessage)
      return false
    }
    await load()
    return true
  }
  const identityLinkMessageReceive = (event: MessageEvent<unknown>) => {
    const providerId = identityLinkProvider.get()
    const messageNonce = identityLinkMessageNonce.get()
    const callbackOrigin = identityLinkCallbackOrigin.get()
    if (
      providerId === undefined ||
      messageNonce === undefined ||
      callbackOrigin === undefined ||
      event.origin !== callbackOrigin ||
      event.source !== identityLinkPopup
    )
      return
    const parsed = v.safeParse(externalIdentityCallbackResponseSchema, event.data)
    if (!parsed.success || parsed.output.kind !== "link_confirmation") return
    if (parsed.output.providerId !== providerId || parsed.output.messageNonce !== messageNonce) return
    identityLinkConfirmation.set(parsed.output)
    identityLinkPopup?.close()
    identityLinkPopup = null
    identityLinkMessageNonce.set(undefined)
    identityLinkCallbackOrigin.set(undefined)
    pendingId.set(undefined)
  }
  window.addEventListener("message", identityLinkMessageReceive)
  onCleanup(() => window.removeEventListener("message", identityLinkMessageReceive))

  const totpFlowReset = () => {
    totpFlowGeneration += 1
    totpDialogOpen.set(false)
    totpError.set(undefined)
    totpSetup.set(undefined)
    totpCode.set("")
  }
  const totpStart = async () => {
    const generation = ++totpFlowGeneration
    totpDialogOpen.set(true)
    totpError.set(undefined)
    totpSetup.set(undefined)
    totpCode.set("")
    pendingId.set("totp:start")
    const result = await api.totpStart(options.realmId())
    if (pendingId.get() === "totp:start") pendingId.set(undefined)
    if (generation !== totpFlowGeneration || !totpDialogOpen.get()) return
    if (!result.success) {
      totpError.set(result.errorMessage)
      return
    }
    totpSetup.set(result.data)
  }
  const totpDialogOpenSet = (open: boolean) => {
    if (!open) {
      totpFlowReset()
      return
    }
    void totpStart()
  }

  createEffect(
    on(
      () => `${options.realmId()}:${options.screen()}`,
      () => {
        oneTimeCodes.set([])
        totpFlowReset()
        void load()
      },
    ),
  )

  return {
    code: totpCode.get,
    codeInput: (event: InputEvent & { currentTarget: HTMLInputElement }) => totpCode.set(event.currentTarget.value),
    error: error.get,
    identities: identities.get,
    identityLinkCancel: () => {
      identityLinkConfirmation.set(undefined)
      identityLinkProvider.set(undefined)
      identityLinkMessageNonce.set(undefined)
      identityLinkCallbackOrigin.set(undefined)
      identityLinkPopup?.close()
      identityLinkPopup = null
    },
    identityLinkConfirm: async () => {
      const confirmation = identityLinkConfirmation.get()
      const providerId = identityLinkProvider.get()
      if (confirmation === undefined || providerId === undefined) return
      const completed = await mutate("identity:link:confirm", () =>
        api.identityLinkComplete(options.realmId(), providerId, {
          confirm: true,
          confirmationToken: confirmation.confirmationToken,
        }),
      )
      if (completed) {
        identityLinkConfirmation.set(undefined)
        identityLinkProvider.set(undefined)
        identityLinkMessageNonce.set(undefined)
        identityLinkCallbackOrigin.set(undefined)
      }
    },
    identityLinkConfirmation: identityLinkConfirmation.get,
    identityLinkProvider: identityLinkProvider.get,
    identityLinkStart: async (providerId: string) => {
      if (pendingId.get() !== undefined) return
      const popup = window.open("about:blank", "authworks-external-identity", "popup,width=520,height=720")
      if (popup === null) return error.set(messageTranslate("account.identities.popupBlocked"))
      identityLinkPopup = popup
      identityLinkProvider.set(providerId)
      identityLinkMessageNonce.set(undefined)
      identityLinkCallbackOrigin.set(undefined)
      pendingId.set(`identity:link:${providerId}`)
      error.set(undefined)
      const started = await api.identityLinkStart(options.realmId(), providerId)
      if (!started.success) {
        popup.close()
        identityLinkPopup = null
        identityLinkProvider.set(undefined)
        identityLinkMessageNonce.set(undefined)
        identityLinkCallbackOrigin.set(undefined)
        pendingId.set(undefined)
        return error.set(started.errorMessage)
      }
      if (started.data.messageNonce === undefined || started.data.callbackOrigin !== window.location.origin) {
        popup.close()
        identityLinkPopup = null
        identityLinkProvider.set(undefined)
        identityLinkMessageNonce.set(undefined)
        identityLinkCallbackOrigin.set(undefined)
        pendingId.set(undefined)
        return error.set(messageTranslate("account.identities.popupBlocked"))
      }
      identityLinkMessageNonce.set(started.data.messageNonce)
      identityLinkCallbackOrigin.set(started.data.callbackOrigin)
      popup.location.href = started.data.authorizationUrl
    },
    identityProviderLinked: (providerId: string) =>
      identities.get().some((identity) => identity.providerId === providerId),
    identityProviders: identityProviders.get,
    identityUnlink: (providerId: string, externalSubject: string) => {
      if (!window.confirm(messageTranslate("account.identities.unlinkConfirm"))) return
      void mutate(`identity:${providerId}`, () => api.identityUnlink(options.realmId(), providerId, externalSubject))
    },
    methods: methods.get,
    oneTimeCodes: oneTimeCodes.get,
    oneTimeCodesDismiss: () => oneTimeCodes.set([]),
    passkeyAdd: async () => {
      pendingId.set("passkey:add")
      error.set(undefined)
      const start = await api.passkeyStart(options.realmId())
      if (!start.success) {
        pendingId.set(undefined)
        return error.set(start.errorMessage)
      }
      const registration = await passkeyRegistrationRun(start.data)
      if (!registration.success) {
        pendingId.set(undefined)
        return error.set(registration.errorMessage)
      }
      await mutate("passkey:add", () => api.passkeyComplete(options.realmId(), registration.data))
    },
    passkeyRevoke: (credentialId: string) =>
      void mutate(`passkey:${credentialId}`, () => api.passkeyRevoke(options.realmId(), credentialId)),
    passkeys: passkeys.get,
    pendingId: pendingId.get,
    recoveryCodesGenerate: async () => {
      pendingId.set("recovery:generate")
      error.set(undefined)
      const result = await api.recoveryCodesGenerate(options.realmId())
      pendingId.set(undefined)
      if (!result.success) return error.set(result.errorMessage)
      oneTimeCodes.set([...result.data.codes])
      await load()
    },
    reload: () => void load(),
    refreshTokenRevoke: (familyId: string) => {
      if (!window.confirm(messageTranslate("account.refreshTokens.revokeConfirm"))) return
      return mutate(`refresh-token:${familyId}`, () => api.refreshTokenRevoke(options.realmId(), familyId))
    },
    refreshTokens: refreshTokens.get,
    refreshTokensRevokeAll: () => {
      if (!window.confirm(messageTranslate("account.refreshTokens.revokeAllConfirm"))) return
      void mutate("refresh-tokens:all", () => api.refreshTokensRevokeAll(options.realmId()))
    },
    securityHistory: securityHistory.get,
    securityHistoryLoadMore: async () => {
      const pageToken = securityHistoryNextPageToken.get()
      if (pageToken === undefined || pendingId.get() !== undefined) return
      pendingId.set("security-history:next")
      const result = await api.securityHistoryList(options.realmId(), { pageSize: 20, pageToken })
      pendingId.set(undefined)
      if (!result.success) return failed(result.errorMessage)
      securityHistory.set([...securityHistory.get(), ...result.data.items])
      securityHistoryNextPageToken.set(result.data.nextPageToken)
    },
    securityHistoryNextPageToken: securityHistoryNextPageToken.get,
    screen: options.screen,
    sessionRevoke: (sessionId: string) => {
      if (!window.confirm(messageTranslate("account.sessions.revokeConfirm"))) return
      void mutate(`session:${sessionId}`, () => api.sessionRevoke(options.realmId(), sessionId))
    },
    sessions: sessions.get,
    status: status.get,
    totpConfirm: async () => {
      const setup = totpSetup.get()
      if (setup === undefined) return
      const generation = totpFlowGeneration
      pendingId.set("totp:confirm")
      totpError.set(undefined)
      const result = await api.totpConfirm(options.realmId(), {
        code: totpCode.get(),
        enrollmentId: setup.enrollment.id,
      })
      if (pendingId.get() === "totp:confirm") pendingId.set(undefined)
      if (!result.success) {
        if (generation === totpFlowGeneration && totpDialogOpen.get()) totpError.set(result.errorMessage)
        return
      }
      await load()
      if (generation === totpFlowGeneration) totpFlowReset()
    },
    totpDialogOpen: totpDialogOpen.get,
    totpDialogOpenSet,
    totpError: totpError.get,
    totpRemove: (enrollmentId?: string) =>
      void mutate("totp:remove", () =>
        api.totpRemove(options.realmId(), enrollmentId === undefined ? {} : { enrollmentId }),
      ),
    totpSetup: totpSetup.get,
    totpSetupDismiss: totpFlowReset,
    totpStart,
    user: user.get,
  }
}
