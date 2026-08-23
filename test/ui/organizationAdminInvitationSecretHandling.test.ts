import { beforeEach, describe, expect, mock, test } from "bun:test"

/** A real storage implementation so acknowledgement is exercised through the browser API. */
const sessionStorageCreate = (): Storage => {
  const entries = new Map<string, string>()
  return {
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size
    },
    removeItem: (key: string) => void entries.delete(key),
    setItem: (key: string, value: string) => void entries.set(key, value),
  } as Storage
}

const sessionStorage = sessionStorageCreate()

mock.module("solid-js", () => ({
  createEffect: (fn: () => void) => fn(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_deps: unknown, fn: () => void) => fn,
}))

const [
  { organizationAdminInvitationAcknowledgementStore },
  { organizationAdminPageStateCreate },
  { organizationAdminDemoAdapterCreate },
] = await Promise.all([
  import("../../src/features/organizations/ui/organizationAdminInvitationAcknowledgementStore.js"),
  import("../../src/features/organizations/ui/organizationAdminPageStateCreate.js"),
  import("../../src/features/organizations/ui/organizationAdminDemoAdapterCreate.js"),
])

organizationAdminInvitationAcknowledgementStore.storageSet(sessionStorage)
beforeEach(() => {
  sessionStorage.clear()
  organizationAdminInvitationAcknowledgementStore.storageSet(sessionStorage)
})

describe("organization invitation token acknowledgement store", () => {
  test("builds a marker that contains no secret token material and tracks acknowledgement", () => {
    const orgId = "01900000-0000-7000-8000-000000000011"
    const marker = organizationAdminInvitationAcknowledgementStore.markerBuild(orgId, "one-time")

    expect(marker).toBe("01900000-0000-7000-8000-000000000011:one-time")
    expect(marker).not.toContain("token")
    expect(marker).not.toContain("secret")
    expect(organizationAdminInvitationAcknowledgementStore.acknowledged(marker)).toBe(false)

    organizationAdminInvitationAcknowledgementStore.acknowledge(marker)
    expect(organizationAdminInvitationAcknowledgementStore.acknowledged(marker)).toBe(true)

    // Other organization remains unacknowledged
    const otherMarker = organizationAdminInvitationAcknowledgementStore.markerBuild(
      "01900000-0000-7000-8000-000000000012",
      "one-time",
    )
    expect(organizationAdminInvitationAcknowledgementStore.acknowledged(otherMarker)).toBe(false)
  })

  test("persists only non-secret marker into sessionStorage", () => {
    const orgId = "01900000-0000-7000-8000-000000000099"
    const marker = organizationAdminInvitationAcknowledgementStore.markerBuild(orgId, "one-time")

    organizationAdminInvitationAcknowledgementStore.acknowledge(marker)

    const raw = sessionStorage.getItem("authworks.organizations.acknowledged-invitations") ?? ""
    expect(JSON.parse(raw)).toContain(marker)
    expect(raw).not.toContain("demo-invitation-token")
  })

  test("survives reload in the same browser session", () => {
    const orgId = "01900000-0000-7000-8000-000000000011"
    const marker = organizationAdminInvitationAcknowledgementStore.markerBuild(orgId, "one-time")

    organizationAdminInvitationAcknowledgementStore.acknowledge(marker)

    // Simulating reload: new store read from sessionStorage
    expect(organizationAdminInvitationAcknowledgementStore.acknowledged(marker)).toBe(true)
  })

  test("falls back safely to in-memory state when sessionStorage is unavailable or throws", () => {
    const throwingStorage: Storage = {
      clear: () => undefined,
      getItem: () => {
        throw new Error("SecurityError: Access is denied")
      },
      key: () => null,
      length: 0,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error("QuotaExceededError")
      },
    }

    organizationAdminInvitationAcknowledgementStore.storageSet(throwingStorage)
    const marker = organizationAdminInvitationAcknowledgementStore.markerBuild("org-fallback", "one-time")

    expect(organizationAdminInvitationAcknowledgementStore.acknowledged(marker)).toBe(false)
    organizationAdminInvitationAcknowledgementStore.acknowledge(marker)
    expect(organizationAdminInvitationAcknowledgementStore.acknowledged(marker)).toBe(true)
  })
})

describe("organization administration page state dismissal wiring", () => {
  test("notifies onInvitationTokenDismiss and clears token on dismissal", () => {
    let dismissed = false
    const adapter = organizationAdminDemoAdapterCreate(() => "one-time")
    const page = organizationAdminPageStateCreate({
      adapter,
      initialInvitationToken: () => "demo-invitation-token-0f9c31a7e5b24d68",
      onInvitationTokenDismiss: () => {
        dismissed = true
      },
      organizationId: () => "01900000-0000-7000-8000-000000000011",
      screen: () => "invitations",
    })

    expect(page.invitationToken()).toBe("demo-invitation-token-0f9c31a7e5b24d68")
    page.invitationTokenDismiss()
    expect(dismissed).toBe(true)
    expect(page.invitationToken()).toBeUndefined()
  })

  test("prevents token from reappearing after dismissal on same org reload, but re-seeds on new org", () => {
    let currentOrgId = "01900000-0000-7000-8000-000000000011"
    let currentFixtureState = "one-time"

    const initialInvitationToken = () => {
      if (currentFixtureState !== "one-time") return undefined
      const marker = organizationAdminInvitationAcknowledgementStore.markerBuild(currentOrgId, currentFixtureState)
      return organizationAdminInvitationAcknowledgementStore.acknowledged(marker)
        ? undefined
        : "demo-invitation-token-0f9c31a7e5b24d68"
    }

    const onInvitationTokenDismiss = () => {
      if (currentFixtureState === "one-time") {
        organizationAdminInvitationAcknowledgementStore.acknowledge(
          organizationAdminInvitationAcknowledgementStore.markerBuild(currentOrgId, currentFixtureState),
        )
      }
    }

    const adapter = organizationAdminDemoAdapterCreate(() => currentFixtureState as any)
    const page = organizationAdminPageStateCreate({
      adapter,
      initialInvitationToken,
      onInvitationTokenDismiss,
      organizationId: () => currentOrgId,
      screen: () => "invitations",
    })

    // Initial mount: token is visible
    expect(page.invitationToken()).toBe("demo-invitation-token-0f9c31a7e5b24d68")

    // Operator dismisses token
    page.invitationTokenDismiss()
    expect(page.invitationToken()).toBeUndefined()

    // Simulating page reload in the same session with the same org
    const pageAfterReload = organizationAdminPageStateCreate({
      adapter,
      initialInvitationToken,
      onInvitationTokenDismiss,
      organizationId: () => currentOrgId,
      screen: () => "invitations",
    })
    expect(pageAfterReload.invitationToken()).toBeUndefined()

    // Fixture identity genuinely changes (different organization) -> token re-seeds!
    currentOrgId = "01900000-0000-7000-8000-000000000012"
    const pageDifferentOrg = organizationAdminPageStateCreate({
      adapter,
      initialInvitationToken,
      onInvitationTokenDismiss,
      organizationId: () => currentOrgId,
      screen: () => "invitations",
    })
    expect(pageDifferentOrg.invitationToken()).toBe("demo-invitation-token-0f9c31a7e5b24d68")
  })
})
