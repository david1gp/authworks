import { useLocation } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import type { ExternalIdentity } from "../../externalIdentities/public/externalIdentitySchema.js"
import type { PasskeyCredential } from "../../passkeys/public/passkeyCredentialSchema.js"
import type { SessionMe } from "../../sessions/public/sessionMeSchema.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import { accountDemoUserFixture } from "./accountDemoUserFixture.js"
import { accountRecoveryCodeAcknowledgementStore } from "./accountRecoveryCodeAcknowledgementStore.js"
import type { AccountSecurityScreen } from "./accountSecurityScreenSchema.js"

const now = Date.UTC(2026, 7, 21, 9, 30)

export function accountSecurityDemoStateCreate(screen: () => AccountSecurityScreen) {
  const location = useLocation()
  const sessions = createSignalObject<SessionMe[]>([
    {
      assurance: "multi_factor",
      authenticationMethod: "password",
      createdAt: now - 86_400_000,
      current: true,
      device: { description: "Firefox on Linux", ipAddress: "192.0.2.10" },
      expiresAt: now + 86_400_000,
      id: "session-current",
      lastUsedAt: now - 60_000,
      mfaMethod: "totp",
      revokedAt: null,
    },
    {
      assurance: "authenticated",
      authenticationMethod: "passkey",
      createdAt: now - 604_800_000,
      current: false,
      device: { description: "Safari on iPhone", ipAddress: "198.51.100.24" },
      expiresAt: now + 3_600_000,
      id: "session-mobile",
      lastUsedAt: now - 7_200_000,
      revokedAt: null,
    },
  ])
  const passkeys = createSignalObject<PasskeyCredential[]>([
    {
      aaguid: "00000000-0000-0000-0000-000000000001",
      backedUp: true,
      createdAt: now - 2_592_000_000,
      deviceType: "multiDevice",
      id: "passkey-laptop",
      lastUsedAt: now - 60_000,
      revokedAt: null,
      transports: ["internal", "hybrid"],
    },
    {
      aaguid: "00000000-0000-0000-0000-000000000002",
      backedUp: false,
      createdAt: now - 5_184_000_000,
      deviceType: "singleDevice",
      id: "passkey-key",
      lastUsedAt: null,
      revokedAt: null,
      transports: ["usb", "nfc"],
    },
  ])
  const methods = createSignalObject<UserAuthenticationMethods>({
    emailOtp: { available: true },
    passkeys: { credentials: passkeys.get() },
    recoveryCodes: { available: true, generatedAt: now - 86_400_000, remaining: 7 },
    totp: {
      enrolled: true,
      enrollments: [
        { confirmedAt: now - 2_592_000_000, id: "totp-demo", label: "Authenticator app", status: "active" },
      ],
    },
  })
  const identities = createSignalObject<ExternalIdentity[]>([
    {
      createdAt: now - 2_592_000_000,
      displayName: "Avery Stone",
      email: "avery@example.com",
      emailVerified: true,
      externalSubject: "github-4821",
      id: "identity-github",
      providerId: "github",
      providerType: "github",
      realmId: "customer-identity",
      updatedAt: now - 86_400_000,
      userId: "demo-user",
      username: "averystone",
      version: 1,
    },
    {
      createdAt: now - 5_184_000_000,
      displayName: "Avery Stone",
      email: "avery@northwind.example",
      emailVerified: true,
      externalSubject: "microsoft-901",
      id: "identity-microsoft",
      providerId: "microsoft",
      providerType: "microsoft",
      realmId: "customer-identity",
      updatedAt: now - 172_800_000,
      userId: "demo-user",
      version: 1,
    },
  ])
  const demoRecoveryCodes = ["AX7K-2QPL", "B9MN-4TRS", "C3VW-8XYZ", "D6EF-1GHJ"]
  // The marker identifies the deterministic issuance, never any code material.
  const acknowledgementMarker = () =>
    accountRecoveryCodeAcknowledgementStore.markerBuild(
      accountDemoUserFixture.id,
      methods.get().recoveryCodes?.generatedAt,
    )
  const oneTimeCodes = createSignalObject<string[]>([])
  const pendingId = createSignalObject<string | undefined>(undefined)
  const code = createSignalObject("")
  const selected = () => demoFixtureStateSelect(location.search, ["success", "empty", "loading", "error", "one-time"])
  const visible = <T>(values: readonly T[]) => (selected() === "empty" ? [] : [...values])
  // The one-time state is reachable straight from a URL, so it seeds already-issued codes. Once
  // dismissed they must not reappear on reload, so acknowledgement is remembered for this session.
  if (selected() === "one-time" && !accountRecoveryCodeAcknowledgementStore.acknowledged(acknowledgementMarker()))
    oneTimeCodes.set([...demoRecoveryCodes])

  return {
    code: code.get,
    codeInput: (event: InputEvent & { currentTarget: HTMLInputElement }) => code.set(event.currentTarget.value),
    error: () => (selected() === "error" ? messageTranslate("demo.fixture.accountError") : undefined),
    identities: () => visible(identities.get()),
    identityUnlink: (providerId: string) => {
      if (!window.confirm(messageTranslate("account.identities.unlinkConfirm"))) return
      identities.set(identities.get().filter((item) => item.providerId !== providerId))
    },
    methods: methods.get,
    oneTimeCodes: oneTimeCodes.get,
    oneTimeCodesDismiss: () => {
      accountRecoveryCodeAcknowledgementStore.acknowledge(acknowledgementMarker())
      oneTimeCodes.set([])
    },
    passkeyAdd: () => undefined,
    passkeyRevoke: (credentialId: string) => passkeys.set(passkeys.get().filter((item) => item.id !== credentialId)),
    passkeys: () => visible(passkeys.get()),
    pendingId: pendingId.get,
    recoveryCodesGenerate: () => {
      // A regeneration is a new issuance, so it gets its own marker and is shown again.
      methods.set({ ...methods.get(), recoveryCodes: { available: true, generatedAt: now, remaining: 8 } })
      oneTimeCodes.set([...demoRecoveryCodes])
    },
    reload: () => undefined,
    screen,
    sessionRevoke: (sessionId: string) => {
      if (!window.confirm(messageTranslate("account.sessions.revokeConfirm"))) return
      sessions.set(sessions.get().filter((item) => item.id !== sessionId))
    },
    sessions: () => visible(sessions.get()),
    status: () =>
      selected() === "loading"
        ? ("loading" as const)
        : selected() === "error"
          ? ("error" as const)
          : ("ready" as const),
    totpConfirm: () => undefined,
    totpRemove: () => methods.set({ ...methods.get(), totp: { enrolled: false, enrollments: [] } }),
    totpSetup: () => undefined,
    totpSetupDismiss: () => undefined,
    totpStart: () => undefined,
  }
}
