import { describe, expect, mock, test } from "bun:test"
import type { ExternalIdentityProvider } from "../../src/features/externalIdentities/public/externalIdentityProviderSchema.js"
import type { OrganizationLoginPolicy } from "../../src/features/organizations/public/organizationLoginPolicySchema.js"

let currentObserver: (() => void) | null = null

mock.module("solid-js", () => ({
  createEffect: (fn: () => void) => {
    fn()
  },
  createSignal: <T>(initial: T) => {
    let value = initial
    const subscribers = new Set<() => void>()
    const get = () => {
      if (currentObserver !== null) subscribers.add(currentObserver)
      return value
    }
    const set = (next: T | ((prev: T) => T)) => {
      value = typeof next === "function" ? (next as (prev: T) => T)(value) : next
      for (const subscriber of [...subscribers]) subscriber()
      return value
    }
    return [get, set] as const
  },
  on: (deps: () => unknown, fn: () => void) => {
    return () => {
      let previousKey: unknown = Symbol("initial")
      const checkAndRun = () => {
        currentObserver = checkAndRun
        const currentKey = deps()
        currentObserver = null
        if (currentKey !== previousKey) {
          previousKey = currentKey
          fn()
        }
      }
      checkAndRun()
    }
  },
}))

const { organizationAdminProviderCreateRequestBuild } = await import(
  "../../src/features/organizations/ui/organizationAdminProviderCreateRequestBuild.js"
)
const { organizationAdminProviderEditDraftCreate, organizationAdminProviderEditRequestBuild } = await import(
  "../../src/features/organizations/ui/organizationAdminProviderEditRequestBuild.js"
)
const { organizationAdminPolicyLifetimeValidate } = await import(
  "../../src/features/organizations/ui/organizationAdminPolicyLifetimeValidate.js"
)
const { organizationAdminFormStateCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminFormStateCreate.js"
)
const { messageTranslate } = await import("../../src/ui/i18n/model/messageTranslate.js")
const { organizationAdminPageStateCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminPageStateCreate.js"
)
const { organizationAdminDemoAdapterCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminDemoAdapterCreate.js"
)

const organizationId = "01900000-0000-7000-8000-000000000011"

const googleProvider: ExternalIdentityProvider = {
  allowAccountCreation: true,
  clientId: "google-client",
  createdAt: 1_755_782_400_000,
  displayName: "Google Workspace",
  enabled: true,
  id: "provider-google",
  organizationId,
  realmId: "realm",
  redirectUri: "https://auth.example/callback",
  scopes: ["openid", "email", "profile"],
  type: "google",
  updatedAt: 1_755_782_400_000,
  version: 1,
}

const oidcProvider: ExternalIdentityProvider = {
  ...googleProvider,
  id: "provider-oidc",
  issuer: "https://issuer.example",
  type: "oidc",
}

describe("organization administration provider create request", () => {
  test("parses comma-separated scopes and omits a blank issuer", () => {
    const request = organizationAdminProviderCreateRequestBuild({
      allowAccountCreation: false,
      clientId: "client-id",
      clientSecret: "secret",
      displayName: "Google",
      issuer: "   ",
      redirectUri: "https://auth.example/callback",
      scopesText: "openid, email,  profile ",
      type: "google",
    })

    expect(request?.scopes).toEqual(["openid", "email", "profile"])
    expect(request?.issuer).toBeUndefined()
  })

  test("requires an issuer for generic OIDC providers and forbids it otherwise", () => {
    const missing = organizationAdminProviderCreateRequestBuild({
      allowAccountCreation: false,
      clientId: "client-id",
      clientSecret: "secret",
      displayName: "Generic",
      issuer: "",
      redirectUri: "https://auth.example/callback",
      scopesText: "",
      type: "oidc",
    })
    const provided = organizationAdminProviderCreateRequestBuild({
      allowAccountCreation: false,
      clientId: "client-id",
      clientSecret: "secret",
      displayName: "Generic",
      issuer: "https://issuer.example",
      redirectUri: "https://auth.example/callback",
      scopesText: "",
      type: "oidc",
    })
    const misplaced = organizationAdminProviderCreateRequestBuild({
      allowAccountCreation: false,
      clientId: "client-id",
      clientSecret: "secret",
      displayName: "Google",
      issuer: "https://issuer.example",
      redirectUri: "https://auth.example/callback",
      scopesText: "",
      type: "google",
    })

    expect(missing).toBeUndefined()
    expect(provided?.issuer).toBe("https://issuer.example")
    expect(misplaced).toBeUndefined()
  })
})

describe("organization administration provider edit request", () => {
  test("builds an edit payload with identity fields and scopes", () => {
    const request = organizationAdminProviderEditRequestBuild(googleProvider, {
      clientId: "next-client",
      displayName: "Next Name",
      issuer: "",
      redirectUri: "https://auth.example/next",
      scopesText: "openid, email",
    })

    expect(request).toEqual({
      clientId: "next-client",
      displayName: "Next Name",
      redirectUri: "https://auth.example/next",
      scopes: ["openid", "email"],
    })
  })

  test("keeps the issuer editable on generic OIDC rows", () => {
    const request = organizationAdminProviderEditRequestBuild(oidcProvider, {
      ...organizationAdminProviderEditDraftCreate(oidcProvider),
      issuer: "https://next-issuer.example",
    })

    expect(request?.issuer).toBe("https://next-issuer.example")
  })

  test("rejects blank OIDC issuers and blank identity fields", () => {
    expect(
      organizationAdminProviderEditRequestBuild(oidcProvider, {
        ...organizationAdminProviderEditDraftCreate(oidcProvider),
        issuer: "   ",
      }),
    ).toBeUndefined()
    expect(
      organizationAdminProviderEditRequestBuild(googleProvider, {
        ...organizationAdminProviderEditDraftCreate(googleProvider),
        displayName: "  ",
      }),
    ).toBeUndefined()
  })

  test("omits scopes when the scopes field is cleared", () => {
    const request = organizationAdminProviderEditRequestBuild(googleProvider, {
      ...organizationAdminProviderEditDraftCreate(googleProvider),
      scopesText: "   ",
    })

    expect(request?.scopes).toBeUndefined()
  })
})

describe("organization administration policy lifetime validation", () => {
  const draft: Pick<
    OrganizationLoginPolicy,
    | "sessionLifetimeSeconds"
    | "mfaInitSkipLifetimeSeconds"
    | "secondFactorCheckLifetimeSeconds"
    | "multiFactorCheckLifetimeSeconds"
  > = {
    mfaInitSkipLifetimeSeconds: 3600,
    multiFactorCheckLifetimeSeconds: null,
    secondFactorCheckLifetimeSeconds: null,
    sessionLifetimeSeconds: 2_592_000,
  }

  test("accepts set, null, and undefined lifetimes", () => {
    expect(organizationAdminPolicyLifetimeValidate(draft)).toBeUndefined()
    expect(
      organizationAdminPolicyLifetimeValidate({
        mfaInitSkipLifetimeSeconds: null,
        multiFactorCheckLifetimeSeconds: null,
        secondFactorCheckLifetimeSeconds: null,
        sessionLifetimeSeconds: undefined,
      }),
    ).toBeUndefined()
  })

  test("rejects zero, fractional, and over-limit lifetimes", () => {
    expect(organizationAdminPolicyLifetimeValidate({ ...draft, sessionLifetimeSeconds: 0 })).toBe(
      "admin.organizations.policy.validation.lifetime",
    )
    expect(organizationAdminPolicyLifetimeValidate({ ...draft, mfaInitSkipLifetimeSeconds: 1.5 })).toBe(
      "admin.organizations.policy.validation.lifetime",
    )
    expect(organizationAdminPolicyLifetimeValidate({ ...draft, secondFactorCheckLifetimeSeconds: 31_536_001 })).toBe(
      "admin.organizations.policy.validation.lifetime",
    )
  })
})

describe("organization administration login policy state", () => {
  test("rejects OIDC provider creation without an issuer in the form", () => {
    const form = organizationAdminFormStateCreate()
    form.providerCreate.set({
      allowAccountCreation: false,
      clientId: "client-id",
      clientSecret: "secret",
      displayName: "Generic",
      issuer: "",
      redirectUri: "https://auth.example/callback",
      scopesText: "",
      type: "oidc",
    })

    expect(form.validateProviderCreate()).toBe(false)
    expect(form.validationMessage.get()).toBe(messageTranslate("admin.organizations.providers.invalid"))
  })

  test("accepts OIDC provider creation with an issuer in the form", () => {
    const form = organizationAdminFormStateCreate()
    form.providerCreate.set({
      allowAccountCreation: true,
      clientId: "client-id",
      clientSecret: "secret",
      displayName: "Generic",
      issuer: "https://issuer.example",
      redirectUri: "https://auth.example/callback",
      scopesText: "openid, email",
      type: "oidc",
    })

    expect(form.validateProviderCreate()).toBe(true)
    const request = form.providerCreateRequest()
    expect(request?.issuer).toBe("https://issuer.example")
    expect(request?.scopes).toEqual(["openid", "email"])
  })

  test("saves the extended login policy fields through the adapter round-trip", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    const saved: unknown[] = []
    const page = organizationAdminPageStateCreate({
      adapter: {
        ...adapter,
        loginPolicySet: (id, input) => {
          saved.push(input)
          return adapter.loginPolicySet(id, input)
        },
      },
      confirm: () => true,
      organizationId: () => organizationId,
      screen: () => "login-policy",
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await page.policySave({
      allowExternalIdentityAutoLinking: false,
      allowWhatsappOtp: true,
      forceMfaLocalOnly: true,
      mfaInitSkipLifetimeSeconds: 3600,
      multiFactorCheckLifetimeSeconds: 7200,
      providerIds: [page.providers()[0]!.id],
      secondFactorCheckLifetimeSeconds: null,
      sessionLifetimeSeconds: 3600,
    })

    expect(result).toBe(true)
    expect(saved[0]).toMatchObject({
      allowExternalIdentityAutoLinking: false,
      allowWhatsappOtp: true,
      forceMfaLocalOnly: true,
      mfaInitSkipLifetimeSeconds: 3600,
      multiFactorCheckLifetimeSeconds: 7200,
      secondFactorCheckLifetimeSeconds: null,
      sessionLifetimeSeconds: 3600,
    })
    expect(page.policy().sessionLifetimeSeconds).toBe(3600)
    expect(page.policy().mfaInitSkipLifetimeSeconds).toBe(3600)
    expect(page.policy().forceMfaLocalOnly).toBe(true)
    expect(page.policy().allowWhatsappOtp).toBe(true)
    expect(page.overrides().providerIds).toEqual([page.providers()[0]!.id])
    expect(page.notice()).toBe("policy-saved")
  })

  test("sends provider identity fields through the adapter round-trip", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    const saved: unknown[] = []
    const page = organizationAdminPageStateCreate({
      adapter: {
        ...adapter,
        providerUpdate: (id, input) => {
          saved.push(input)
          return adapter.providerUpdate(id, input)
        },
      },
      confirm: () => true,
      organizationId: () => organizationId,
      screen: () => "login-policy",
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    const target = page.providers()[0]!
    const result = await page.providerUpdate(target.id, {
      clientId: "next-client",
      displayName: "Next Name",
      redirectUri: "https://auth.example/next",
      scopes: ["openid"],
    })

    expect(result).toBe(true)
    expect(saved[0]).toEqual({
      clientId: "next-client",
      displayName: "Next Name",
      redirectUri: "https://auth.example/next",
      scopes: ["openid"],
    })
    const updated = page.providers().find((provider) => provider.id === target.id)
    expect(updated?.clientId).toBe("next-client")
    expect(updated?.redirectUri).toBe("https://auth.example/next")
    expect(updated?.scopes).toEqual(["openid"])
    expect(page.notice()).toBe("provider-updated")
  })
})
