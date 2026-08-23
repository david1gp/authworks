import { createEffect, on } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ExternalIdentity } from "../../externalIdentities/public/externalIdentitySchema.js"
import type { MfaTotpEnrollmentStartResponse } from "../../mfa/public/mfaTotpEnrollmentStartResponseSchema.js"
import type { PasskeyCredential } from "../../passkeys/public/passkeyCredentialSchema.js"
import type { SessionMe } from "../../sessions/public/sessionMeSchema.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import { accountSecurityApiCreate } from "./accountSecurityApiCreate.js"
import type { AccountSecurityScreen } from "./accountSecurityScreenSchema.js"
import { passkeyRegistrationRun } from "./passkeyRegistrationRun.js"

const emptyMethods: UserAuthenticationMethods = {
  emailOtp: { available: false },
  passkeys: { credentials: [] },
  recoveryCodes: { available: false, generatedAt: null, remaining: 0 },
  totp: { enrolled: false, enrollments: [] },
}

export function accountSecurityProductionStateCreate(options: {
  readonly realmId: () => string
  readonly screen: () => AccountSecurityScreen
}) {
  const api = accountSecurityApiCreate({ baseUrl: window.location.origin })
  const status = createSignalObject<"error" | "loading" | "ready">("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const sessions = createSignalObject<SessionMe[]>([])
  const passkeys = createSignalObject<PasskeyCredential[]>([])
  const methods = createSignalObject<UserAuthenticationMethods>(emptyMethods)
  const identities = createSignalObject<ExternalIdentity[]>([])
  const oneTimeCodes = createSignalObject<string[]>([])
  const totpSetup = createSignalObject<MfaTotpEnrollmentStartResponse | undefined>(undefined)
  const totpCode = createSignalObject("")

  const failed = (message: string) => {
    error.set(message)
    status.set("error")
  }
  const load = async () => {
    status.set("loading")
    error.set(undefined)
    const realmId = options.realmId()
    const screen = options.screen()
    if (screen === "sessions") {
      const result = await api.sessionsList(realmId)
      if (!result.success) return failed(result.errorMessage)
      sessions.set(result.data.items.filter((session) => session.revokedAt === null))
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
      const result = await api.identitiesList(realmId)
      if (!result.success) return failed(result.errorMessage)
      identities.set(result.data.items)
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

  createEffect(
    on(
      () => `${options.realmId()}:${options.screen()}`,
      () => {
        oneTimeCodes.set([])
        totpSetup.set(undefined)
        void load()
      },
    ),
  )

  return {
    code: totpCode.get,
    codeInput: (event: InputEvent & { currentTarget: HTMLInputElement }) => totpCode.set(event.currentTarget.value),
    error: error.get,
    identities: identities.get,
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
      const confirmed = await mutate("totp:confirm", () =>
        api.totpConfirm(options.realmId(), { code: totpCode.get(), enrollmentId: setup.enrollment.id }),
      )
      if (confirmed) {
        totpSetup.set(undefined)
        totpCode.set("")
      }
    },
    totpRemove: () => void mutate("totp:remove", () => api.totpRemove(options.realmId())),
    totpSetup: totpSetup.get,
    totpSetupDismiss: () => totpSetup.set(undefined),
    totpStart: async () => {
      pendingId.set("totp:start")
      error.set(undefined)
      const result = await api.totpStart(options.realmId())
      pendingId.set(undefined)
      if (!result.success) return error.set(result.errorMessage)
      totpSetup.set(result.data)
    },
  }
}
