import { afterEach, describe, expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { accountEffectiveAccessGroupGet } from "../../src/features/account/model/accountEffectiveAccessGroupGet.js"
import { accountEffectiveAccessGroupsCreate } from "../../src/features/account/model/accountEffectiveAccessGroupsCreate.js"
import { accountOrganizationMeGet } from "../../src/features/account/model/accountOrganizationMeGet.js"
import type { AccountEffectiveAccessEntry } from "../../src/features/account/public/accountEffectiveAccessEntrySchema.js"
import { accountAccessProductionStateCreate } from "../../src/features/account/ui/accountAccessProductionStateCreate.js"
import { accountOrganizationAccessProductionStateCreate } from "../../src/features/account/ui/accountOrganizationAccessProductionStateCreate.js"
import { accountProductionAdapterStateCreate } from "../../src/features/account/ui/accountProductionAdapterStateCreate.js"
import type { OidcConsent } from "../../src/features/oidc/public/oidcConsentSchema.js"
import type { OrganizationMe } from "../../src/features/organizations/public/organizationMeSchema.js"
import type { UserCurrentResponse } from "../../src/features/users/public/userCurrentResponseSchema.js"
import type { User } from "../../src/features/users/public/userSchema.js"
import type { ProductionSessionContextValue } from "../../src/ui/production/productionSessionContextValue.js"

const realmId = "01900000-0000-7000-8000-000000000001"
const northwindId = "01900000-0000-7000-8000-000000000002"
const fieldNotesId = "01900000-0000-7000-8000-000000000004"
const userId = "01900000-0000-7000-8000-0000000000b1"
const user = {
  createdAt: 1_774_000_000_000,
  email: "avery.stone@example.com",
  emailVerified: true,
  emailVerifiedAt: 1_774_000_060_000,
  id: userId,
  profile: { displayName: "Avery Stone" },
  realmId,
  state: "active",
  updatedAt: 1_774_000_060_000,
  userName: "avery.stone",
  verificationState: "verified",
} satisfies User
const organizations: OrganizationMe[] = [
  {
    membership: {
      createdAt: 1,
      id: "01900000-0000-7000-8000-000000000005",
      organizationId: northwindId,
      realmId,
      roles: ["owner"],
      updatedAt: 1,
      userId,
    },
    organization: {
      createdAt: 1,
      id: northwindId,
      name: "Northwind Labs",
      realmId,
      status: "active" as const,
      updatedAt: 1,
    },
  },
  {
    membership: {
      createdAt: 1,
      id: "01900000-0000-7000-8000-000000000006",
      organizationId: fieldNotesId,
      realmId,
      roles: ["member"],
      updatedAt: 1,
      userId,
    },
    organization: {
      createdAt: 1,
      id: fieldNotesId,
      name: "Field Notes",
      realmId,
      status: "active" as const,
      updatedAt: 1,
    },
  },
]

const previousFetch = globalThis.fetch
const previousWindow = globalThis.window
const cleanups: Array<() => void> = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  globalThis.fetch = previousFetch
  Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow })
})

describe("account organization switch state", () => {
  test("keeps profile state loaded once while refreshing organization-scoped account data", async () => {
    const requests = { effectiveAccess: 0, organizations: 0, profile: 0 }
    const [organization, setOrganization] = createSignal<ProductionSessionContextValue["guard"]["organization"]>({
      organizationId: northwindId,
      status: "available",
    })
    const session = {
      actorLabel: "Avery Stone",
      guard: {
        authentication: { status: "authenticated" as const, userId },
        get organization() {
          return organization()
        },
        permission: "granted" as const,
        realm: { realmId, status: "available" as const },
      },
      impersonation: null,
      organizations: organizations.map((item) => ({ id: item.organization.id, label: item.organization.name })),
      organizationSelect: async (organizationId: string) => {
        setOrganization({ organizationId, status: "available" })
        return { data: undefined, success: true as const }
      },
      organizationSwitchPending: () => false,
      realms: [{ id: realmId, label: "Customer identity" }],
    } satisfies ProductionSessionContextValue

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { host: "auth.example.test", origin: "https://auth.example.test", search: "" } },
    })
    globalThis.fetch = (async (input: string | URL | Request) => {
      const pathname = new URL(String(input), "https://auth.example.test").pathname
      if (pathname === `/realms/${realmId}/me`) {
        requests.profile += 1
        return Response.json({ capabilities: { realmRead: true }, user } satisfies UserCurrentResponse)
      }
      if (pathname === `/realms/${realmId}/me/organizations`) {
        requests.organizations += 1
        return Response.json({ items: organizations })
      }
      if (pathname === `/realms/${realmId}/me/effective-access`) {
        requests.effectiveAccess += 1
        return Response.json({ items: [] })
      }
      return Response.json({})
    }) as unknown as typeof fetch

    const states = createRoot((dispose) => {
      cleanups.push(dispose)
      return {
        effectiveAccess: accountAccessProductionStateCreate(() => "effective-access", { session }),
        organizations: accountAccessProductionStateCreate(() => "organizations", { session }),
        profile: accountProductionAdapterStateCreate(() => "overview", { initialStatus: "loading", realmId, session }),
      }
    })
    await states.profile.load(true)
    await waitFor(() => requests.organizations === 1 && requests.effectiveAccess === 1)
    expect(requests.profile).toBe(1)
    const profileState = states.profile
    const profileSignal = profileState.user
    const profileStatusSignal = profileState.status
    const profileBeforeSwitch = profileSignal.get()

    await states.organizations.organizationSwitch(fieldNotesId)
    await waitFor(() => requests.organizations === 2 && requests.effectiveAccess === 2)

    expect(requests.profile).toBe(1)
    expect(states.profile).toBe(profileState)
    expect(states.profile.user).toBe(profileSignal)
    expect(states.profile.status).toBe(profileStatusSignal)
    expect(states.profile.user.get()).toBe(profileBeforeSwitch)
    expect(states.profile.status.get()).toBe("ready")
    expect(states.profile.displayName.get()).toBe("Avery Stone")
    expect(states.organizations.activeOrganizationId()).toBe(fieldNotesId)
    expect(states.organizations.status()).toBe("ready")
    expect(states.effectiveAccess.status()).toBe("empty")
    expect(session.guard.organization).toEqual({ organizationId: fieldNotesId, status: "available" })
  })

  test("does not let an old effective-access response replace the switched organization state", async () => {
    const first = deferred<Response>()
    let effectiveAccessRequests = 0
    const [organization, setOrganization] = createSignal<ProductionSessionContextValue["guard"]["organization"]>({
      organizationId: northwindId,
      status: "available",
    })
    const session = {
      actorLabel: "Avery Stone",
      guard: {
        authentication: { status: "authenticated" as const, userId },
        get organization() {
          return organization()
        },
        permission: "granted" as const,
        realm: { realmId, status: "available" as const },
      },
      impersonation: null,
      organizations: [],
      organizationSelect: async () => ({ data: undefined, success: true as const }),
      organizationSwitchPending: () => false,
      realms: [{ id: realmId, label: "Customer identity" }],
    } satisfies ProductionSessionContextValue
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "https://auth.example.test", search: "" } },
    })
    globalThis.fetch = (async () => {
      effectiveAccessRequests += 1
      return effectiveAccessRequests === 1 ? first.promise : Response.json({ items: [] })
    }) as unknown as typeof fetch

    const state = createRoot((dispose) => {
      cleanups.push(dispose)
      return accountAccessProductionStateCreate(() => "effective-access", { session })
    })
    await waitFor(() => effectiveAccessRequests === 1)

    setOrganization({ organizationId: fieldNotesId, status: "available" })
    await waitFor(() => effectiveAccessRequests === 2 && state.status() === "empty")
    expect(state.effectiveAccessNextPageToken()).toBeUndefined()

    first.resolve(Response.json({ items: [], nextPageToken: "stale-page" }))
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(state.effectiveAccessNextPageToken()).toBeUndefined()
  })

  test("clears and reloads organization-scoped data while ignoring stale pre-switch loads", async () => {
    const oldOrganizations = deferred<Response>()
    const oldEffectiveAccess = deferred<Response>()
    const newOrganizations = deferred<Response>()
    const newEffectiveAccess = deferred<Response>()
    let organizationRequests = 0
    let effectiveAccessRequests = 0
    const [organization, setOrganization] = createSignal<ProductionSessionContextValue["guard"]["organization"]>({
      organizationId: northwindId,
      status: "available",
    })
    const session = {
      actorLabel: "Avery Stone",
      guard: {
        authentication: { status: "authenticated" as const, userId },
        get organization() {
          return organization()
        },
        permission: "granted" as const,
        realm: { realmId, status: "available" as const },
      },
      impersonation: null,
      organizations: organizations.map((item) => ({ id: item.organization.id, label: item.organization.name })),
      organizationSelect: async (organizationId: string) => {
        setOrganization({ organizationId, status: "available" })
        return { data: undefined, success: true as const }
      },
      organizationSwitchPending: () => false,
      realms: [{ id: realmId, label: "Customer identity" }],
    } satisfies ProductionSessionContextValue
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "https://auth.example.test", search: "" } },
    })
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input), "https://auth.example.test")
      if (url.pathname === `/realms/${realmId}/me/organizations`) {
        organizationRequests += 1
        return organizationRequests === 1 ? oldOrganizations.promise : newOrganizations.promise
      }
      if (url.pathname === `/realms/${realmId}/me/effective-access`) {
        effectiveAccessRequests += 1
        return effectiveAccessRequests === 1 ? oldEffectiveAccess.promise : newEffectiveAccess.promise
      }
      return Response.json({})
    }) as unknown as typeof fetch

    const states = createRoot((dispose) => {
      cleanups.push(dispose)
      return {
        effectiveAccess: accountAccessProductionStateCreate(() => "effective-access", { session }),
        organizations: accountAccessProductionStateCreate(() => "organizations", { session }),
      }
    })
    await waitFor(() => organizationRequests === 1 && effectiveAccessRequests === 1)

    setOrganization({ organizationId: fieldNotesId, status: "available" })
    await waitFor(() => organizationRequests === 2 && effectiveAccessRequests === 2)

    expect(states.organizations.organizations()).toEqual([])
    expect(states.effectiveAccess.effectiveAccess()).toEqual([])
    expect(states.effectiveAccess.effectiveAccessNextPageToken()).toBeUndefined()
    expect(states.organizations.status()).toBe("loading")
    expect(states.effectiveAccess.status()).toBe("loading")

    newOrganizations.resolve(Response.json({ items: [organizations[1]!] }))
    newEffectiveAccess.resolve(
      Response.json({
        items: [effectiveAccessEntryCreate("effective-new", organizations[1]!)],
        nextPageToken: "new-page",
      }),
    )
    await waitFor(() => states.organizations.status() === "ready" && states.effectiveAccess.status() === "ready")

    expect(states.organizations.organizations()).toEqual([organizations[1]!])
    expect(states.effectiveAccess.effectiveAccess()).toEqual([
      effectiveAccessEntryCreate("effective-new", organizations[1]!),
    ])
    expect(states.effectiveAccess.effectiveAccessNextPageToken()).toBe("new-page")

    oldOrganizations.resolve(Response.json({ items: [organizations[0]] }))
    oldEffectiveAccess.resolve(
      Response.json({
        items: [effectiveAccessEntryCreate("effective-old", organizations[0]!)],
        nextPageToken: "old-page",
      }),
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(states.organizations.organizations()).toEqual([organizations[1]!])
    expect(states.effectiveAccess.effectiveAccess()).toEqual([
      effectiveAccessEntryCreate("effective-new", organizations[1]!),
    ])
    expect(states.effectiveAccess.effectiveAccessNextPageToken()).toBe("new-page")
  })

  test("ignores stale effective-access pagination after switching organizations", async () => {
    const stalePage = deferred<Response>()
    let effectiveAccessRequests = 0
    const [organization, setOrganization] = createSignal<ProductionSessionContextValue["guard"]["organization"]>({
      organizationId: northwindId,
      status: "available",
    })
    const session = {
      actorLabel: "Avery Stone",
      guard: {
        authentication: { status: "authenticated" as const, userId },
        get organization() {
          return organization()
        },
        permission: "granted" as const,
        realm: { realmId, status: "available" as const },
      },
      impersonation: null,
      organizations: [],
      organizationSelect: async () => ({ data: undefined, success: true as const }),
      organizationSwitchPending: () => false,
      realms: [{ id: realmId, label: "Customer identity" }],
    } satisfies ProductionSessionContextValue
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "https://auth.example.test", search: "" } },
    })
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input), "https://auth.example.test")
      if (url.pathname !== `/realms/${realmId}/me/effective-access`) return Response.json({})
      effectiveAccessRequests += 1
      if (url.searchParams.get("pageToken") === "old-page") return stalePage.promise
      return effectiveAccessRequests === 1
        ? Response.json({
            items: [effectiveAccessEntryCreate("effective-old", organizations[0]!)],
            nextPageToken: "old-page",
          })
        : Response.json({ items: [effectiveAccessEntryCreate("effective-new", organizations[1]!)] })
    }) as unknown as typeof fetch

    const state = createRoot((dispose) => {
      cleanups.push(dispose)
      return accountAccessProductionStateCreate(() => "effective-access", { session })
    })
    await waitFor(() => state.status() === "ready" && state.effectiveAccessNextPageToken() === "old-page")

    const stalePagination = state.effectiveAccessLoadMore()
    await waitFor(() => effectiveAccessRequests === 2)
    setOrganization({ organizationId: fieldNotesId, status: "available" })
    await waitFor(() => effectiveAccessRequests === 3 && state.status() === "ready")

    expect(state.effectiveAccess()).toEqual([effectiveAccessEntryCreate("effective-new", organizations[1]!)])
    expect(state.effectiveAccessNextPageToken()).toBeUndefined()

    stalePage.resolve(
      Response.json({
        items: [effectiveAccessEntryCreate("effective-stale", organizations[0]!)],
        nextPageToken: "stale-page",
      }),
    )
    await stalePagination

    expect(state.effectiveAccess()).toEqual([effectiveAccessEntryCreate("effective-new", organizations[1]!)])
    expect(state.effectiveAccessNextPageToken()).toBeUndefined()
  })

  test("preserves realm-scoped consents across an organization switch without refetching", async () => {
    const consent = {
      clientId: "01900000-0000-7000-8000-000000000031",
      createdAt: 1,
      realmId,
      scope: ["openid"],
      updatedAt: 1,
      userId,
    } satisfies OidcConsent
    let consentRequests = 0
    const [organization, setOrganization] = createSignal<ProductionSessionContextValue["guard"]["organization"]>({
      organizationId: northwindId,
      status: "available",
    })
    const session = {
      actorLabel: "Avery Stone",
      guard: {
        authentication: { status: "authenticated" as const, userId },
        get organization() {
          return organization()
        },
        permission: "granted" as const,
        realm: { realmId, status: "available" as const },
      },
      impersonation: null,
      organizations: [],
      organizationSelect: async (organizationId: string) => {
        setOrganization({ organizationId, status: "available" })
        return { data: undefined, success: true as const }
      },
      organizationSwitchPending: () => false,
      realms: [{ id: realmId, label: "Customer identity" }],
    } satisfies ProductionSessionContextValue
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "https://auth.example.test", search: "" } },
    })
    globalThis.fetch = (async (input: string | URL | Request) => {
      const pathname = new URL(String(input), "https://auth.example.test").pathname
      if (pathname === `/realms/${realmId}/me/consents`) {
        consentRequests += 1
        return Response.json({ items: [consent] })
      }
      return Response.json({})
    }) as unknown as typeof fetch

    const state = createRoot((dispose) => {
      cleanups.push(dispose)
      return accountAccessProductionStateCreate(() => "consents", { session })
    })
    await waitFor(() => state.status() === "ready")
    const consentsBeforeSwitch = state.consents()

    await state.organizationSwitch(fieldNotesId)

    expect(state.activeOrganizationId()).toBe(fieldNotesId)
    expect(state.consents()).toBe(consentsBeforeSwitch)
    expect(state.consents()).toEqual([consent])
    expect(consentRequests).toBe(1)
  })

  test("keeps active and viewed organizations unchanged and surfaces a failed activation", async () => {
    let organizationSelectCalls = 0
    const session = {
      actorLabel: "Avery Stone",
      guard: {
        authentication: { status: "authenticated" as const, userId },
        organization: { organizationId: northwindId, status: "available" as const },
        permission: "granted" as const,
        realm: { realmId, status: "available" as const },
      },
      impersonation: null,
      organizations: organizations.map((item) => ({ id: item.organization.id, label: item.organization.name })),
      organizationSelect: async () => {
        organizationSelectCalls += 1
        return {
          errorMessage: "The organization could not be activated.",
          op: "organizationSelect",
          success: false as const,
        }
      },
      organizationSwitchPending: () => false,
      realms: [{ id: realmId, label: "Customer identity" }],
    } satisfies ProductionSessionContextValue

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "https://auth.example.test", search: "" } },
    })
    globalThis.fetch = (async () => Response.json({ items: organizations })) as unknown as typeof fetch

    const state = createRoot((dispose) => {
      cleanups.push(dispose)
      return accountAccessProductionStateCreate(() => "organizations", { session })
    })
    await waitFor(() => state.status() === "ready")

    state.viewedOrganizationSelect(fieldNotesId)
    await state.organizationSwitch(fieldNotesId)

    expect(organizationSelectCalls).toBe(1)
    expect(state.activeOrganizationId()).toBe(northwindId)
    expect(state.viewedOrganizationId()).toBe(fieldNotesId)
    expect(state.pendingId()).toBeUndefined()
    expect(state.status()).toBe("error")
    expect(state.error()).toBe("The organization could not be activated.")
    expect(state.notice()).toBeUndefined()
  })

  test("shares the viewed organization between membership and effective-access responses", async () => {
    const effectiveAccessResponse = deferred<Response>()
    const session = {
      actorLabel: "Avery Stone",
      guard: {
        authentication: { status: "authenticated" as const, userId },
        organization: { organizationId: northwindId, status: "available" as const },
        permission: "granted" as const,
        realm: { realmId, status: "available" as const },
      },
      impersonation: null,
      organizations: organizations.map((item) => ({ id: item.organization.id, label: item.organization.name })),
      organizationSelect: async () => ({ data: undefined, success: true as const }),
      organizationSwitchPending: () => false,
      realms: [{ id: realmId, label: "Customer identity" }],
    } satisfies ProductionSessionContextValue

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "https://auth.example.test", search: "" } },
    })
    globalThis.fetch = (async (input: string | URL | Request) => {
      const pathname = new URL(String(input), "https://auth.example.test").pathname
      if (pathname === `/realms/${realmId}/me/organizations`) return Response.json({ items: organizations })
      if (pathname === `/realms/${realmId}/me/effective-access`) return effectiveAccessResponse.promise
      return Response.json({})
    }) as unknown as typeof fetch

    const state = createRoot((dispose) => {
      cleanups.push(dispose)
      return accountOrganizationAccessProductionStateCreate({ session })
    })
    await waitFor(() => state.organizations.status() === "ready")

    state.organizationSelect(fieldNotesId)

    expect(state.organizations.activeOrganizationId()).toBe(northwindId)
    expect(state.organizations.viewedOrganizationId()).toBe(fieldNotesId)
    expect(state.effectiveAccess.viewedOrganizationId()).toBe(fieldNotesId)
    effectiveAccessResponse.resolve(
      Response.json({ items: [effectiveAccessEntryCreate("effective-field-notes", organizations[1]!)] }),
    )
    await waitFor(() => state.effectiveAccess.status() === "ready")
    expect(state.effectiveAccess.viewedEffectiveAccessGroup()?.entries).toEqual([
      effectiveAccessEntryCreate("effective-field-notes", organizations[1]!),
    ])
  })

  test("keeps viewed organization selection independent and falls back after membership removal", async () => {
    const [organization, setOrganization] = createSignal<ProductionSessionContextValue["guard"]["organization"]>({
      organizationId: northwindId,
      status: "available",
    })
    let organizationRequests = 0
    let organizationSelectCalls = 0
    const session = {
      actorLabel: "Avery Stone",
      guard: {
        authentication: { status: "authenticated" as const, userId },
        get organization() {
          return organization()
        },
        permission: "granted" as const,
        realm: { realmId, status: "available" as const },
      },
      impersonation: null,
      organizations: organizations.map((item) => ({ id: item.organization.id, label: item.organization.name })),
      organizationSelect: async (organizationId: string) => {
        organizationSelectCalls += 1
        setOrganization({ organizationId, status: "available" })
        return { data: undefined, success: true as const }
      },
      organizationSwitchPending: () => false,
      realms: [{ id: realmId, label: "Customer identity" }],
    } satisfies ProductionSessionContextValue

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "https://auth.example.test", search: "" } },
    })
    globalThis.fetch = (async () => {
      organizationRequests += 1
      return Response.json({ items: organizationRequests <= 3 ? organizations : [organizations[0]!] })
    }) as unknown as typeof fetch

    const state = createRoot((dispose) => {
      cleanups.push(dispose)
      return accountAccessProductionStateCreate(() => "organizations", { session })
    })
    await waitFor(() => state.status() === "ready")

    expect(state.viewedOrganizationId()).toBe(northwindId)
    expect(state.viewedOrganization()).toEqual(organizations[0])

    state.viewedOrganizationSelect(fieldNotesId)
    expect(state.viewedOrganizationId()).toBe(fieldNotesId)
    expect(state.viewedOrganization()).toEqual(organizations[1])
    expect(state.activeOrganizationId()).toBe(northwindId)
    expect(organizationSelectCalls).toBe(0)

    setOrganization({ organizationId: fieldNotesId, status: "available" })
    await waitFor(() => organizationRequests === 2 && state.status() === "ready")
    expect(state.viewedOrganizationId()).toBe(fieldNotesId)

    setOrganization({ organizationId: northwindId, status: "available" })
    await waitFor(() => organizationRequests === 3 && state.status() === "ready")
    expect(state.viewedOrganizationId()).toBe(fieldNotesId)

    state.viewedOrganizationSelect(fieldNotesId)
    state.reload()
    await waitFor(() => organizationRequests === 4 && state.status() === "ready")
    expect(state.viewedOrganizationId()).toBe(northwindId)
    expect(state.viewedOrganization()).toEqual(organizations[0])
  })

  test("selects membership and effective access by the viewed organization", () => {
    const groups = accountEffectiveAccessGroupsCreate([
      effectiveAccessEntryCreate("effective-field-notes", organizations[1]!),
      effectiveAccessEntryCreate("effective-northwind", organizations[0]!),
    ])

    expect(accountOrganizationMeGet(organizations, fieldNotesId)).toBe(organizations[1])
    expect(accountEffectiveAccessGroupGet(groups, fieldNotesId)).toEqual({
      entries: [effectiveAccessEntryCreate("effective-field-notes", organizations[1]!)],
      organization: organizations[1]!.organization,
    })
    expect(accountOrganizationMeGet(organizations, "missing")).toBeUndefined()
    expect(accountEffectiveAccessGroupGet(groups, "missing")).toBeUndefined()
  })
})

function effectiveAccessEntryCreate(id: string, item: (typeof organizations)[number]): AccountEffectiveAccessEntry {
  return {
    id,
    organization: item,
    permissions: ["organization.read"],
    roleKeys: ["member"],
    source: "membership",
  }
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 20 && !predicate(); attempt += 1)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  expect(predicate()).toBe(true)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
