import { useLocation } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import type { ExternalIdentity } from "../../externalIdentities/public/externalIdentitySchema.js"
import type { OidcRefreshTokenMetadata } from "../../oidc/public/oidcRefreshTokenMetadataSchema.js"
import type { PasskeyCredential } from "../../passkeys/public/passkeyCredentialSchema.js"
import type { SessionMe } from "../../sessions/public/sessionMeSchema.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import { accountDemoUserFixture } from "./accountDemoUserFixture.js"
import { accountRecoveryCodeAcknowledgementStore } from "./accountRecoveryCodeAcknowledgementStore.js"
import type { AccountSecurityHistoryItem } from "../public/accountSecurityHistoryItemSchema.js"
import type { AccountSecurityScreen } from "./accountSecurityScreenSchema.js"

const now = Date.UTC(2026, 7, 21, 9, 30)
const securityHistoryFirstPage: AccountSecurityHistoryItem[] = [
  { category: "sessions", displayCode: "session.created", id: "history-session-created", occurredAt: now - 60_000 },
  {
    category: "passwords",
    displayCode: "password.login_succeeded",
    id: "history-password-login",
    occurredAt: now - 120_000,
  },
  { category: "mfa", displayCode: "mfa.challenge.completed", id: "history-mfa-complete", occurredAt: now - 180_000 },
  {
    category: "passkeys",
    displayCode: "passkey.authentication_completed",
    id: "history-passkey-authentication",
    occurredAt: now - 240_000,
  },
  {
    category: "linked_identities",
    displayCode: "linked_identity.linked",
    id: "history-identity-linked",
    occurredAt: now - 300_000,
  },
]
const securityHistorySecondPage: AccountSecurityHistoryItem[] = [
  {
    category: "email_changes",
    displayCode: "email_change.verified",
    id: "history-email-verified",
    occurredAt: now - 360_000,
  },
  {
    category: "refresh_tokens",
    displayCode: "refresh_token.family_revoked",
    id: "history-refresh-revoked",
    occurredAt: now - 420_000,
  },
  {
    category: "impersonation",
    displayCode: "impersonation.started",
    id: "history-impersonation-started",
    occurredAt: now - 480_000,
  },
]

const emptyDemoMethods: UserAuthenticationMethods = {
  emailOtp: { available: false },
  passkeys: { credentials: [] },
  recoveryCodes: { available: false, generatedAt: null, remaining: 0 },
  totp: { enrolled: false, enrollments: [] },
}

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
  const refreshTokens = createSignalObject<OidcRefreshTokenMetadata[]>([
    {
      clientId: "01900000-0000-7000-8000-000000000031",
      clientName: "Acme Dashboard",
      createdAt: now - 86_400_000,
      expiresAt: now + 29 * 86_400_000,
      familyId: "01900000-0000-7000-8000-000000000032",
      lastUsedAt: now - 60_000,
      revokedAt: null,
      scope: ["openid", "profile", "email"],
      status: "active",
    },
    {
      clientId: "01900000-0000-7000-8000-000000000033",
      clientName: "Acme Mobile",
      createdAt: now - 5_184_000_000,
      expiresAt: now - 2_592_000_000,
      familyId: "01900000-0000-7000-8000-000000000034",
      lastUsedAt: now - 2_592_000_000,
      revokedAt: now - 2_592_000_000,
      scope: ["openid", "profile"],
      status: "revoked",
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
  const identityProviders = createSignalObject<ExternalIdentityProvider[]>([
    {
      allowAccountCreation: true,
      clientId: "demo-github-client",
      createdAt: now - 5_184_000_000,
      displayName: "GitHub",
      enabled: true,
      id: "github",
      organizationId: undefined,
      realmId: "customer-identity",
      redirectUri: "https://demo.authworks.example/realms/customer-identity/external-identity/github/callback",
      scopes: ["read:user", "user:email"],
      type: "github",
      updatedAt: now - 86_400_000,
      version: 1,
    },
    {
      allowAccountCreation: true,
      clientId: "demo-google-client",
      createdAt: now - 2_592_000_000,
      displayName: "Google",
      enabled: true,
      id: "google",
      organizationId: undefined,
      realmId: "customer-identity",
      redirectUri: "https://demo.authworks.example/realms/customer-identity/external-identity/google/callback",
      scopes: ["openid", "email", "profile"],
      type: "google",
      updatedAt: now - 60_000,
      version: 1,
    },
    {
      allowAccountCreation: true,
      clientId: "demo-microsoft-client",
      createdAt: now - 5_184_000_000,
      displayName: "Microsoft",
      enabled: true,
      id: "microsoft",
      organizationId: undefined,
      realmId: "customer-identity",
      redirectUri: "https://demo.authworks.example/realms/customer-identity/external-identity/microsoft/callback",
      scopes: ["openid", "email", "profile"],
      type: "microsoft",
      updatedAt: now - 172_800_000,
      version: 1,
    },
  ])
  const securityHistory = createSignalObject([...securityHistoryFirstPage])
  const securityHistoryNextPageToken = createSignalObject<string | undefined>("demo-security-history-page-2")
  const demoRecoveryCodes = ["AX7K-2QPL", "B9MN-4TRS", "C3VW-8XYZ", "D6EF-1GHJ"]
  // The marker identifies the deterministic issuance, never any code material.
  const acknowledgementMarker = () =>
    accountRecoveryCodeAcknowledgementStore.markerBuild(
      accountDemoUserFixture.id,
      methods.get().recoveryCodes?.generatedAt,
    )
  const oneTimeCodes = createSignalObject<string[]>([])
  const totpSetup = createSignalObject<
    | {
        readonly enrollment: {
          readonly createdAt: number
          readonly id: string
          readonly realmId: string
          readonly status: "pending"
          readonly userId: string
        }
        readonly otpauthUri: string
        readonly secret: string
      }
    | undefined
  >(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const identityLinkConfirmation = createSignalObject<
    { readonly confirmationToken: string; readonly expiresAt: number; readonly kind: "link_confirmation" } | undefined
  >(undefined)
  const identityLinkProvider = createSignalObject<string | undefined>(undefined)
  const identityError = createSignalObject<string | undefined>(undefined)
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
    error: () =>
      identityError.get() ?? (selected() === "error" ? messageTranslate("demo.fixture.accountError") : undefined),
    identities: () => visible(identities.get()),
    identityLinkCancel: () => {
      identityLinkConfirmation.set(undefined)
      identityLinkProvider.set(undefined)
      pendingId.set(undefined)
      identityError.set(undefined)
    },
    identityLinkConfirm: () => {
      const providerId = identityLinkProvider.get()
      const confirmation = identityLinkConfirmation.get()
      if (providerId === undefined || confirmation === undefined) return
      const provider = identityProviders.get().find((item) => item.id === providerId)
      if (provider === undefined) return
      if (identities.get().some((item) => item.providerId === providerId)) {
        identityError.set(messageTranslate("account.identities.alreadyLinked"))
        identityLinkConfirmation.set(undefined)
        identityLinkProvider.set(undefined)
        return
      }
      const createdAt = Date.now()
      identities.set([
        ...identities.get(),
        {
          createdAt,
          displayName: "Demo external account",
          email: `linked-${provider.type}@example.com`,
          emailVerified: true,
          externalSubject: `demo-${provider.id}-subject`,
          id: `identity-${provider.id}`,
          providerId: provider.id,
          providerType: provider.type,
          realmId: provider.realmId,
          updatedAt: createdAt,
          userId: "demo-user",
          username: `demo-${provider.type}`,
          version: 1,
        },
      ])
      identityLinkConfirmation.set(undefined)
      identityLinkProvider.set(undefined)
      pendingId.set(undefined)
      identityError.set(undefined)
    },
    identityLinkConfirmation: identityLinkConfirmation.get,
    identityLinkProvider: identityLinkProvider.get,
    identityLinkStart: (providerId: string) => {
      if (identities.get().some((item) => item.providerId === providerId)) {
        return identityError.set(messageTranslate("account.identities.alreadyLinked"))
      }
      if (identityProviders.get().every((item) => item.id !== providerId)) return
      identityError.set(undefined)
      identityLinkProvider.set(providerId)
      pendingId.set(`identity:link:${providerId}`)
      // The demo callback is deterministic but still requires the same explicit confirmation step.
      identityLinkConfirmation.set({
        confirmationToken: `demo-${providerId}-confirmation-token`,
        expiresAt: now + 600_000,
        kind: "link_confirmation",
      })
      pendingId.set(undefined)
    },
    identityProviderLinked: (providerId: string) =>
      identities.get().some((identity) => identity.providerId === providerId),
    identityProviders: () => identityProviders.get(),
    identityUnlink: (providerId: string) => {
      if (!window.confirm(messageTranslate("account.identities.unlinkConfirm"))) return
      identities.set(identities.get().filter((item) => item.providerId !== providerId))
    },
    methods: () =>
      selected() === "empty"
        ? emptyDemoMethods
        : {
            ...methods.get(),
            passkeys: { credentials: visible(passkeys.get()) },
          },
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
    refreshTokenRevoke: (familyId: string) => {
      if (!window.confirm(messageTranslate("account.refreshTokens.revokeConfirm"))) return
      const revokedAt = Date.now()
      refreshTokens.set(
        refreshTokens
          .get()
          .map((token) => (token.familyId === familyId ? { ...token, revokedAt, status: "revoked" as const } : token)),
      )
    },
    refreshTokens: () => visible(refreshTokens.get()),
    refreshTokensRevokeAll: () => {
      if (!window.confirm(messageTranslate("account.refreshTokens.revokeAllConfirm"))) return
      const revokedAt = Date.now()
      refreshTokens.set(
        refreshTokens
          .get()
          .map((token) => (token.status === "active" ? { ...token, revokedAt, status: "revoked" as const } : token)),
      )
    },
    securityHistory: () => (selected() === "empty" ? [] : securityHistory.get()),
    securityHistoryLoadMore: () => {
      if (securityHistoryNextPageToken.get() === undefined) return
      securityHistory.set([...securityHistory.get(), ...securityHistorySecondPage])
      securityHistoryNextPageToken.set(undefined)
    },
    securityHistoryNextPageToken: () => (selected() === "empty" ? undefined : securityHistoryNextPageToken.get()),
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
    totpConfirm: () => {
      methods.set({
        ...methods.get(),
        totp: {
          enrolled: true,
          enrollments: [{ confirmedAt: Date.now(), id: "totp-demo", label: "Authenticator app", status: "active" }],
        },
      })
      totpSetup.set(undefined)
      code.set("")
    },
    totpRemove: () => methods.set({ ...methods.get(), totp: { enrolled: false, enrollments: [] } }),
    totpSetup: totpSetup.get,
    totpSetupDismiss: () => totpSetup.set(undefined),
    totpStart: () => {
      totpSetup.set({
        enrollment: {
          createdAt: Date.now(),
          id: "totp-demo-enrollment",
          realmId: "customer-identity",
          status: "pending",
          userId: "demo-user",
        },
        otpauthUri: "otpauth://totp/Authworks:demo-user?secret=JBSWY3DPEHPK3PXP&issuer=Authworks",
        secret: "JBSWY3DPEHPK3PXP",
      })
    },
  }
}
