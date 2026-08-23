import { describe, expect, mock, test } from "bun:test"
import * as v from "valibot"

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
      let prevKey: unknown = Symbol("initial")
      const checkAndRun = () => {
        currentObserver = checkAndRun
        const currentKey = deps()
        currentObserver = null
        if (currentKey !== prevKey) {
          prevKey = currentKey
          fn()
        }
      }
      checkAndRun()
    }
  },
}))

const { demoAdminOrganizationDomains } = await import("../../src/features/demo/demoAdminOrganizationDomains.js")
const { demoAdminOrganizationInvitations } = await import("../../src/features/demo/demoAdminOrganizationInvitations.js")
const { demoAdminOrganizationProviders } = await import("../../src/features/demo/demoAdminOrganizationProviders.js")
const { demoAdminOrganizationRoles } = await import("../../src/features/demo/demoAdminOrganizationRoles.js")
const { externalIdentityProviderSchema } = await import(
  "../../src/features/externalIdentities/public/externalIdentityProviderSchema.js"
)
const { organizationDomainSchema } = await import("../../src/features/organizations/public/organizationDomainSchema.js")
const { organizationInvitationSchema } = await import(
  "../../src/features/organizations/public/organizationInvitationSchema.js"
)
const { organizationRoleSchema } = await import("../../src/features/organizations/public/organizationRoleSchema.js")
const { organizationAdminDemoAdapterCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminDemoAdapterCreate.js"
)
const { organizationAdminPageStateCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminPageStateCreate.js"
)
type DemoFixtureState = import("../../src/features/demo/demoFixtureStateSchema.js").DemoFixtureState

const organizationId = "01900000-0000-7000-8000-000000000011"

describe("organization administration demo fixtures", () => {
  test("parse against the public transport schemas", () => {
    expect(v.safeParse(v.array(organizationDomainSchema), demoAdminOrganizationDomains).success).toBe(true)
    expect(v.safeParse(v.array(organizationInvitationSchema), demoAdminOrganizationInvitations).success).toBe(true)
    expect(v.safeParse(v.array(externalIdentityProviderSchema), demoAdminOrganizationProviders).success).toBe(true)
    expect(v.safeParse(v.array(organizationRoleSchema), demoAdminOrganizationRoles).success).toBe(true)
  })

  test("expose only the four fixed organization roles", () => {
    expect(demoAdminOrganizationRoles.map((role) => role.id)).toEqual(["owner", "admin", "member", "guest"])
  })
})

describe("organization administration demo adapter", () => {
  test("returns fixture collections for the success state", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")

    const organizations = await adapter.organizationList()
    const memberships = await adapter.membershipList(organizationId)

    expect(organizations.success && organizations.data.items.length).toBeGreaterThan(0)
    expect(memberships.success && memberships.data.items.length).toBeGreaterThan(0)
  })

  test("returns empty collections for the empty state", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "empty")

    const invitations = await adapter.invitationList(organizationId)
    const domains = await adapter.domainList(organizationId)

    expect(invitations.success && invitations.data.items).toEqual([])
    expect(domains.success && domains.data.items).toEqual([])
  })

  test("maps the denied state onto a forbidden result", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "permission-denied")

    const result = await adapter.organizationList()

    expect(result.success).toBe(false)
    expect(result.success === false && result.statusCode).toBe(403)
  })

  test("never returns a stored provider client secret", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")

    const created = await adapter.providerCreate({
      allowAccountCreation: true,
      clientId: "client-id",
      clientSecret: "super-secret-value",
      displayName: "Google",
      redirectUri: "https://auth.example/callback",
      type: "google",
    })
    const list = await adapter.providerList(organizationId)

    expect(created.success).toBe(true)
    expect(JSON.stringify(created)).not.toContain("super-secret-value")
    expect(JSON.stringify(list)).not.toContain("super-secret-value")
  })

  test("issues an invitation token exactly once at creation", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")

    const created = await adapter.invitationCreate(organizationId, { email: "new@example.com", roles: ["member"] })
    const list = await adapter.invitationList(organizationId)

    expect(created.success && created.data.token.length).toBeGreaterThan(0)
    const token = created.success ? created.data.token : ""
    expect(JSON.stringify(list)).not.toContain(token)
  })

  test("verifies a claimed domain and clears its DNS challenge", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")

    const verified = await adapter.domainVerify(organizationId, "acme-labs.example")

    expect(verified.success && verified.data.domain.verified).toBe(true)
    expect(verified.success && verified.data.domain.verification).toBeUndefined()
  })

  test("never settles while the loading state is selected", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "loading")
    let settled = false

    void adapter.organizationList().then(() => {
      settled = true
    })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(settled).toBe(false)
  })
})

function reactiveSignalCreate<T>(initial: T) {
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
}

describe("organization administration page state token seeding and dismissal", () => {
  test("seeds initial token, allows dismissal, and re-seeds upon selector reloadKey change", async () => {
    const [fixtureState, setFixtureState] = reactiveSignalCreate<DemoFixtureState>("one-time")
    const adapter = organizationAdminDemoAdapterCreate(fixtureState)
    const initialInvitationToken = () =>
      fixtureState() === "one-time" ? "demo-invitation-token-0f9c31a7e5b24d68" : undefined

    const page = organizationAdminPageStateCreate({
      adapter,
      confirm: () => true,
      initialInvitationToken,
      organizationId: () => organizationId,
      reloadKey: fixtureState,
      screen: () => "invitations",
    })

    expect(page.invitationToken()).toBe("demo-invitation-token-0f9c31a7e5b24d68")

    page.invitationTokenDismiss()
    expect(page.invitationToken()).toBeUndefined()

    // Switch to success state: token remains cleared
    setFixtureState("success")
    await Promise.resolve()
    await Promise.resolve()
    expect(page.invitationToken()).toBeUndefined()

    // Switch back to one-time state: token is re-seeded
    setFixtureState("one-time")
    await Promise.resolve()
    await Promise.resolve()
    expect(page.invitationToken()).toBe("demo-invitation-token-0f9c31a7e5b24d68")
  })
})

describe("organization administration page state reactive cloned mutations", () => {
  test("reactively updates organization on rename and lifecycle set with cloned references", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    const page = organizationAdminPageStateCreate({
      adapter,
      confirm: () => true,
      organizationId: () => organizationId,
      screen: () => "organization-detail",
    })

    await Promise.resolve()
    await Promise.resolve()

    const initialOrg = page.organization()
    expect(initialOrg).toBeDefined()

    await page.organizationRename("Northwind Global")
    const renamedOrg = page.organization()
    expect(renamedOrg?.name).toBe("Northwind Global")
    expect(renamedOrg).not.toBe(initialOrg)
    expect(page.notice()).toBe("organization-renamed")

    await page.organizationLifecycleSet("inactive")
    const inactiveOrg = page.organization()
    expect(inactiveOrg?.status).toBe("inactive")
    expect(inactiveOrg).not.toBe(renamedOrg)
    expect(page.notice()).toBe("organization-lifecycle")
  })

  test("reactively updates memberships list on role change and removal", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    const page = organizationAdminPageStateCreate({
      adapter,
      confirm: () => true,
      organizationId: () => organizationId,
      screen: () => "memberships",
    })

    await Promise.resolve()
    await Promise.resolve()

    const initialMemberships = page.memberships()
    expect(initialMemberships.length).toBeGreaterThan(0)
    const targetId = initialMemberships[0]!.id

    await page.membershipRolesSet(targetId, ["owner", "admin"])
    const updatedMemberships = page.memberships()
    expect(updatedMemberships.find((m) => m.id === targetId)?.roles).toEqual(["owner", "admin"])
    expect(updatedMemberships).not.toBe(initialMemberships)
    expect(page.notice()).toBe("membership-updated")

    await page.membershipRemove(targetId, "user-id")
    const removedMemberships = page.memberships()
    expect(removedMemberships.some((m) => m.id === targetId)).toBe(false)
    expect(page.notice()).toBe("membership-removed")
  })

  test("reactively updates domains, branding, and policy", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    const page = organizationAdminPageStateCreate({
      adapter,
      confirm: () => true,
      organizationId: () => organizationId,
      screen: () => "domains",
    })

    await Promise.resolve()
    await Promise.resolve()

    const initialDomains = page.domains()
    expect(initialDomains.length).toBeGreaterThan(0)
    const domainName = initialDomains[0]!.domain

    await page.domainRemove(domainName)
    expect(page.domains().some((d) => d.domain === domainName)).toBe(false)
    expect(page.notice()).toBe("domain-removed")

    await page.brandingSave({
      ...page.branding(),
      light: { ...page.branding().light, primaryColor: "#0f766e" },
    })
    expect(page.branding().light.primaryColor).toBe("#0f766e")
    expect(page.notice()).toBe("branding-saved")

    await page.policySave({
      allowDomainDiscovery: false,
    })
    expect(page.overrides().allowDomainDiscovery).toBe(false)
    expect(page.notice()).toBe("policy-saved")
  })

  test("reactively updates provider list on disable and update with cloned references", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    const page = organizationAdminPageStateCreate({
      adapter,
      confirm: () => true,
      organizationId: () => organizationId,
      screen: () => "login-policy",
    })

    await Promise.resolve()
    await Promise.resolve()

    const initialProviders = page.providers()
    expect(initialProviders.length).toBeGreaterThan(0)
    const enabledProvider = initialProviders.find((p) => p.enabled)!
    expect(enabledProvider).toBeDefined()

    await page.providerDisable(enabledProvider.id, enabledProvider.displayName)
    const afterDisable = page.providers()
    const disabledProvider = afterDisable.find((p) => p.id === enabledProvider.id)
    expect(disabledProvider?.enabled).toBe(false)
    expect(disabledProvider).not.toBe(enabledProvider)
    expect(page.notice()).toBe("provider-disabled")

    await page.providerUpdate(enabledProvider.id, { displayName: "Updated Provider", enabled: true })
    const afterUpdate = page.providers()
    const updatedProvider = afterUpdate.find((p) => p.id === enabledProvider.id)
    expect(updatedProvider?.displayName).toBe("Updated Provider")
    expect(updatedProvider?.enabled).toBe(true)
    expect(updatedProvider).not.toBe(disabledProvider)
    expect(page.notice()).toBe("provider-updated")
  })
})

describe("organization administration selector transitions", () => {
  test("reacts to selector fixture state changes between success, empty, and permission-denied", async () => {
    const [fixtureState, setFixtureState] = reactiveSignalCreate<DemoFixtureState>("success")
    const adapter = organizationAdminDemoAdapterCreate(fixtureState)
    const page = organizationAdminPageStateCreate({
      adapter,
      confirm: () => true,
      organizationId: () => organizationId,
      reloadKey: fixtureState,
      screen: () => "organizations",
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(page.status()).toBe("ready")
    expect(page.organizations().length).toBeGreaterThan(0)

    setFixtureState("empty")
    await Promise.resolve()
    await Promise.resolve()
    expect(page.status()).toBe("empty")
    expect(page.organizations()).toHaveLength(0)

    setFixtureState("permission-denied")
    await Promise.resolve()
    await Promise.resolve()
    expect(page.status()).toBe("permission-denied")
    expect(page.error()).toBeDefined()
  })
})

describe("organization administration branding accessibility", () => {
  test("does not apply aria-hidden to focusable color inputs and provides accessible labels", async () => {
    const { readFileSync } = await import("node:fs")
    const brandingViewSource = readFileSync("src/features/organizations/ui/OrganizationAdminBrandingView.tsx", "utf8")

    expect(brandingViewSource).not.toMatch(/<input[^>]*aria-hidden=["']true["'][^>]*type=["']color["']/)
    expect(brandingViewSource).not.toMatch(/<input[^>]*type=["']color["'][^>]*aria-hidden=["']true["']/)
    expect(brandingViewSource).toMatch(/type="color"/)
    expect(brandingViewSource).toMatch(/aria-label=\{messageTranslate\(field\.labelKey\)\}/)
  })
})
