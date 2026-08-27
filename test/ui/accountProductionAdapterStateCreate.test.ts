import { afterEach, describe, expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import type { UserCurrentResponse } from "../../src/features/users/public/userCurrentResponseSchema.js"
import type { User } from "../../src/features/users/public/userSchema.js"
import type { ProductionSessionContextValue } from "../../src/ui/production/productionSessionContextValue.js"
import { accountProductionAdapterStateCreate } from "../../src/features/account/ui/accountProductionAdapterStateCreate.js"

const realmId = "01900000-0000-7000-8000-000000000001"
const secondRealmId = "01900000-0000-7000-8000-000000000003"
const session = {
  actorLabel: "Avery Stone",
  guard: {
    authentication: { status: "authenticated", userId: "01900000-0000-7000-8000-0000000000b1" },
    organization: { organizationId: "01900000-0000-7000-8000-000000000002", status: "available" },
    permission: "granted",
    realm: { realmId, status: "available" },
  },
  impersonation: null,
  organizations: [],
  organizationSelect: () => undefined,
  realms: [{ id: realmId, label: "Customer identity" }],
  realmSelect: () => undefined,
} satisfies ProductionSessionContextValue
const user = {
  createdAt: 1_774_000_000_000,
  email: "avery.stone@example.com",
  emailVerified: true,
  emailVerifiedAt: 1_774_000_060_000,
  id: "01900000-0000-7000-8000-0000000000b1",
  profile: { displayName: "Avery Stone" },
  realmId,
  state: "active",
  updatedAt: 1_774_000_060_000,
  userName: "avery.stone",
  verificationState: "verified",
} satisfies User
const secondUser = {
  ...user,
  id: "01900000-0000-7000-8000-0000000000b2",
  profile: { displayName: "Blair Stone" },
  realmId: secondRealmId,
  userName: "blair.stone",
} satisfies User
let activeSession = session

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const cleanups: (() => void)[] = []

afterEach(async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
  for (const cleanup of cleanups.splice(0)) cleanup()
  globalThis.fetch = originalFetch
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow })
  activeSession = session
})

describe("account production adapter state", () => {
  test("loads /me without browser cache revalidation for every account page kind", async () => {
    const kinds = ["overview", "profile", "email", "password", "delete"] as const
    const requests: {
      readonly cache: RequestCache
      readonly ifModifiedSince: string | null
      readonly method: string
      readonly path: string
    }[] = []
    let browserCacheHasCurrentMe = false

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { host: "auth.example.test", origin: "https://auth.example.test" } },
    })
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)
      const url = new URL(request.url)
      if (url.pathname === "/organization-discovery") return Response.json({ found: false })
      if (url.pathname === `/realms/${realmId}/me`) {
        requests.push({
          cache: request.cache,
          ifModifiedSince: request.headers.get("if-modified-since"),
          method: request.method,
          path: url.pathname,
        })
        if (browserCacheHasCurrentMe && request.cache !== "no-store") return new Response(null, { status: 304 })
        browserCacheHasCurrentMe = true
        return Response.json({ capabilities: { realmRead: true }, user } satisfies UserCurrentResponse)
      }
      if (url.pathname === `/realms/${realmId}/me/emails`) return Response.json({ items: [] })
      return Response.json({})
    }) as typeof fetch

    for (const kind of kinds) {
      const state = stateCreate(() => kind)

      await state.load(true)
      expect(state.status.get()).toBe("ready")
      await state.load(true)

      expect(state.status.get()).toBe("ready")
      expect(state.user.get()).toEqual(user)
    }

    const userRequests = requests.filter((request) => request.path === `/realms/${realmId}/me`)
    expect(userRequests).toHaveLength(kinds.length * 2)
    expect(userRequests.every((request) => request.method === "GET")).toBe(true)
    expect(userRequests.every((request) => request.cache === "no-store")).toBe(true)
    expect(userRequests.every((request) => request.ifModifiedSince === null)).toBe(true)
  })

  test("serializes concurrent /me loads and keeps the newer result last", async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    const requests: { readonly ifModifiedSince: string | null; readonly path: string }[] = []
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { host: "auth.example.test", origin: "https://auth.example.test" } },
    })
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)
      const url = new URL(request.url)
      if (url.pathname === "/organization-discovery") return Response.json({ found: false })
      if (url.pathname !== `/realms/${realmId}/me`) return Response.json({})
      requests.push({ ifModifiedSince: request.headers.get("if-modified-since"), path: url.pathname })
      return requests.length === 1 ? first.promise : second.promise
    }) as typeof fetch

    const state = stateCreate(() => "overview")
    const firstLoad = state.load(true)
    const secondLoad = state.load(true)
    await waitFor(() => requests.length === 1)
    expect(requests[0]?.ifModifiedSince).toBeNull()
    first.resolve(Response.json({ capabilities: { realmRead: true }, user } satisfies UserCurrentResponse))
    await firstLoad
    await waitFor(() => requests.length === 2)
    expect(requests[1]?.ifModifiedSince).toBeNull()
    second.resolve(Response.json({ capabilities: { realmRead: true }, user: secondUser } satisfies UserCurrentResponse))
    await secondLoad

    expect(state.user.get()).toEqual(secondUser)
  })

  test("waits for a profile mutation before reloading /me in the same session boundary", async () => {
    const updatedUser = { ...user, profile: { displayName: "Updated Avery Stone" }, updatedAt: user.updatedAt + 1 }
    const mutation = deferred<Response>()
    let profileUpdated = false
    const requests: { readonly ifModifiedSince: string | null; readonly method: string; readonly path: string }[] = []
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { host: "auth.example.test", origin: "https://auth.example.test" } },
    })
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)
      const url = new URL(request.url)
      if (url.pathname === "/organization-discovery") return Response.json({ found: false })
      if (url.pathname.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-token" })
      if (url.pathname !== `/realms/${realmId}/me`) return Response.json({})
      requests.push({
        ifModifiedSince: request.headers.get("if-modified-since"),
        method: request.method,
        path: url.pathname,
      })
      if (request.method === "PATCH") {
        profileUpdated = true
        return mutation.promise
      }
      return Response.json({ capabilities: { realmRead: true }, user: profileUpdated ? updatedUser : user })
    }) as typeof fetch

    const state = stateCreate(() => "profile")
    await state.load(true)
    state.displayName.set("Updated Avery Stone")
    const profileSubmit = state.profileSubmit({ preventDefault: () => undefined } as SubmitEvent)
    await waitFor(() => requests.some((request) => request.method === "PATCH"))
    const reload = state.load(true)
    expect(requests.filter((request) => request.method === "GET")).toHaveLength(1)
    mutation.resolve(Response.json({ user: updatedUser }))
    await profileSubmit
    await reload

    const userRequests = requests.filter((request) => request.method === "GET")
    expect(userRequests).toHaveLength(2)
    expect(userRequests.every((request) => request.ifModifiedSince === null)).toBe(true)
    expect(state.user.get()).toEqual(updatedUser)
  })

  test("resolves each load against the current realm and session boundary", async () => {
    const boundarySession = {
      ...session,
      guard: {
        ...session.guard,
        authentication: { status: "authenticated" as const, userId: user.id },
        realm: { realmId, status: "available" as const },
      },
      realms: [{ id: realmId, label: "Customer identity" }],
    }
    activeSession = boundarySession
    const paths: string[] = []
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { host: "auth.example.test", origin: "https://auth.example.test" } },
    })
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)
      const url = new URL(request.url)
      if (url.pathname === "/organization-discovery") return Response.json({ found: false })
      if (url.pathname.endsWith(`/realms/${realmId}/me`)) {
        paths.push(url.pathname)
        return Response.json({ capabilities: { realmRead: true }, user } satisfies UserCurrentResponse)
      }
      if (url.pathname.endsWith(`/realms/${secondRealmId}/me`)) {
        paths.push(url.pathname)
        return Response.json({ capabilities: { realmRead: true }, user: secondUser } satisfies UserCurrentResponse)
      }
      return Response.json({})
    }) as typeof fetch

    const state = stateCreate(() => "overview")
    await state.load(true)
    boundarySession.guard.authentication = { status: "authenticated", userId: secondUser.id }
    boundarySession.guard.realm = { realmId: secondRealmId, status: "available" }
    boundarySession.realms = [{ id: secondRealmId, label: "Other identity" }]
    await state.load(true)

    expect(paths).toEqual([`/realms/${realmId}/me`, `/realms/${secondRealmId}/me`])
    expect(state.user.get()).toEqual(secondUser)
  })

  test("reloads the correct loader across retained account route transitions", async () => {
    const [kind, setKind] = createSignal<"delete" | "email" | "overview" | "password" | "profile">("profile")
    const requests: string[] = []
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { host: "auth.example.test", origin: "https://auth.example.test" } },
    })
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)
      const url = new URL(request.url)
      if (url.pathname === "/organization-discovery") return Response.json({ found: false })
      if (url.pathname === `/realms/${realmId}/me`) {
        requests.push("me")
        return Response.json({ capabilities: { realmRead: true }, user } satisfies UserCurrentResponse)
      }
      if (url.pathname === `/realms/${realmId}/me/emails`) {
        requests.push("emails")
        return Response.json({ items: [] })
      }
      return Response.json({})
    }) as typeof fetch

    const state = stateCreate(kind)
    await state.load(true)
    await waitFor(() => state.status.get() === "ready")
    expect(requests).toEqual(["me"])

    setKind("email")
    await waitFor(() => requests.length === 3 && state.status.get() === "ready")
    expect(requests).toEqual(["me", "me", "emails"])

    setKind("password")
    await waitFor(() => requests.length === 4 && state.status.get() === "ready")
    expect(requests).toEqual(["me", "me", "emails", "me"])

    setKind("delete")
    await waitFor(() => requests.length === 5 && state.status.get() === "ready")
    expect(requests).toEqual(["me", "me", "emails", "me", "me"])

    setKind("overview")
    await waitFor(() => requests.length === 6 && state.status.get() === "ready")
    expect(requests).toEqual(["me", "me", "emails", "me", "me", "me"])

    setKind("profile")
    await waitFor(() => requests.length === 7 && state.status.get() === "ready")
    expect(requests).toEqual(["me", "me", "emails", "me", "me", "me", "me"])
  })

  test("ignores a stale /me result when a retained route changes to email", async () => {
    const [kind, setKind] = createSignal<"delete" | "email" | "overview" | "password" | "profile">("profile")
    const first = deferred<Response>()
    const second = deferred<Response>()
    const requests: string[] = []
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { host: "auth.example.test", origin: "https://auth.example.test" } },
    })
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)
      const url = new URL(request.url)
      if (url.pathname === "/organization-discovery") return Response.json({ found: false })
      if (url.pathname === `/realms/${realmId}/me`) {
        requests.push("me")
        return requests.length === 1 ? first.promise : second.promise
      }
      if (url.pathname === `/realms/${realmId}/me/emails`) {
        requests.push("emails")
        return Response.json({ items: [] })
      }
      return Response.json({})
    }) as typeof fetch

    const state = stateCreate(kind)
    const firstLoad = state.load(true)
    await waitFor(() => requests.length === 1)

    setKind("email")
    await Promise.resolve()
    first.resolve(Response.json({ capabilities: { realmRead: true }, user } satisfies UserCurrentResponse))
    await firstLoad
    await waitFor(() => requests.length === 2)

    expect(requests).toEqual(["me", "me"])
    expect(state.status.get()).toBe("loading")
    expect(state.user.get()).toBeUndefined()

    second.resolve(Response.json({ capabilities: { realmRead: true }, user: secondUser } satisfies UserCurrentResponse))
    await waitFor(() => requests.length === 3 && state.status.get() === "ready")

    expect(requests).toEqual(["me", "me", "emails"])
    expect(state.user.get()).toEqual(secondUser)
  })

  test("does not let a stale email loader overwrite a newer route status", async () => {
    const [kind, setKind] = createSignal<"delete" | "email" | "overview" | "password" | "profile">("email")
    const first = deferred<Response>()
    const firstEmails = deferred<Response>()
    const second = deferred<Response>()
    const requests: string[] = []
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { host: "auth.example.test", origin: "https://auth.example.test" } },
    })
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)
      const url = new URL(request.url)
      if (url.pathname === "/organization-discovery") return Response.json({ found: false })
      if (url.pathname === `/realms/${realmId}/me`) {
        requests.push("me")
        return requests.length === 1 ? first.promise : second.promise
      }
      if (url.pathname === `/realms/${realmId}/me/emails`) {
        requests.push("emails")
        return firstEmails.promise
      }
      return Response.json({})
    }) as typeof fetch

    const state = stateCreate(kind)
    const firstLoad = state.load(true)
    await waitFor(() => requests.length === 1)
    first.resolve(Response.json({ capabilities: { realmRead: true }, user } satisfies UserCurrentResponse))
    await waitFor(() => requests.length === 2)

    setKind("password")
    await waitFor(() => requests.length === 3)
    expect(requests).toEqual(["me", "emails", "me"])
    expect(state.status.get()).toBe("loading")

    firstEmails.resolve(Response.json({ items: [] }))
    await firstLoad
    expect(state.status.get()).toBe("loading")

    second.resolve(Response.json({ capabilities: { realmRead: true }, user: secondUser } satisfies UserCurrentResponse))
    await waitFor(() => state.status.get() === "ready")
    expect(requests).toEqual(["me", "emails", "me"])
    expect(state.user.get()).toEqual(secondUser)
  })
})

function stateCreate(kind: () => "delete" | "email" | "overview" | "password" | "profile") {
  let dispose: (() => void) | undefined
  const state = createRoot((rootDispose) => {
    dispose = rootDispose
    return accountProductionAdapterStateCreate(kind, { initialStatus: "loading", session: activeSession })
  })
  if (dispose === undefined) throw new Error("Account production state root did not provide a disposer.")
  cleanups.push(dispose)
  return state
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 10 && !predicate(); attempt += 1)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  expect(predicate()).toBe(true)
}
