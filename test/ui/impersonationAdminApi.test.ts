import { describe, expect, test } from "bun:test"
import { impersonationAdminProductionAdapterCreate } from "../../src/features/impersonation/ui/impersonationAdminProductionAdapterCreate.js"

const realmId = "018f0000-0000-7000-8000-000000000001"
const actorId = "018f0000-0000-7000-8000-0000000000b1"
const subjectId = "018f0000-0000-7000-8000-000000000021"
const sessionId = "018f0000-0000-7000-8000-0000000000e1"

const sessionCreate = (overrides: Record<string, unknown> = {}) => ({
  assurance: "multi_factor",
  authenticationMethod: "impersonation",
  createdAt: 1_000,
  current: true,
  device: {},
  expiresAt: 601_000,
  id: sessionId,
  impersonated: true,
  impersonationReason: "Ticket NW-1",
  impersonatorId: actorId,
  lastUsedAt: 1_000,
  realmId,
  revokedAt: null,
  subjectId: actorId,
  subjectType: "user",
  userId: subjectId,
  ...overrides,
})

const userCreate = (id: string, displayName: string) => ({
  createdAt: 1,
  email: `${displayName.toLowerCase().replace(" ", ".")}@example.test`,
  emailVerified: true,
  id,
  profile: { displayName },
  realmId,
  state: "active",
  updatedAt: 1,
  userName: displayName.toLowerCase().replace(" ", "."),
  verificationState: "verified",
})

function adapterCreate(responder: (url: string, init?: RequestInit) => Response) {
  const requests: { init?: RequestInit; url: string }[] = []
  const adapter = impersonationAdminProductionAdapterCreate({
    baseUrl: "https://auth.example",
    csrfToken: () => "csrf-fixture",
    fetch: async (input, init) => {
      const url = String(input)
      requests.push({ init, url })
      return responder(url, init)
    },
    realmId: () => realmId,
  })
  return { adapter, requests }
}

describe("impersonation administration production adapter", () => {
  test("resolves eligibility from the current realm-scoped browser session", async () => {
    const { adapter, requests } = adapterCreate((url) => {
      if (url.includes("/sessions/current"))
        return Response.json({ session: sessionCreate({ impersonatorId: undefined, impersonated: undefined }) })
      return Response.json({ user: userCreate(actorId, "Robin Vale") })
    })

    const eligibility = await adapter.eligibilityGet()

    expect(eligibility.success && eligibility.data.actorLabel).toBe("Robin Vale")
    expect(eligibility.success && eligibility.data.nested).toBe(false)
    expect(eligibility.success && eligibility.data.permitted).toBe(true)
    expect(new URL(requests[0]?.url ?? "").pathname).toBe(`/realms/${realmId}/sessions/current`)
    // The browser must never reach the operator-only system surface.
    expect(requests.every((request) => !request.url.includes("/system/"))).toBe(true)
  })

  test("marks an impersonated session as nested and not permitted to start another", async () => {
    const { adapter } = adapterCreate((url) => {
      if (url.includes("/sessions/current")) return Response.json({ session: sessionCreate() })
      return Response.json({ user: userCreate(actorId, "Robin Vale") })
    })

    const eligibility = await adapter.eligibilityGet()

    expect(eligibility.success && eligibility.data.nested).toBe(true)
    expect(eligibility.success && eligibility.data.permitted).toBe(false)
  })

  test("reports an unmet multi-factor assurance as not permitted", async () => {
    const { adapter } = adapterCreate((url) => {
      if (url.includes("/sessions/current"))
        return Response.json({
          session: sessionCreate({ assurance: "authenticated", impersonated: undefined, impersonatorId: undefined }),
        })
      return Response.json({ user: userCreate(actorId, "Robin Vale") })
    })

    const eligibility = await adapter.eligibilityGet()

    expect(eligibility.success && eligibility.data.assurance).toBe("authenticated")
    expect(eligibility.success && eligibility.data.permitted).toBe(false)
  })

  test("posts a reasoned, bounded start with the CSRF token and drops the issued credential", async () => {
    let startBody: unknown
    const { adapter, requests } = adapterCreate((url, init) => {
      if (url.includes("/impersonations") && init?.method === "POST") {
        startBody = JSON.parse(String(init.body))
        return Response.json({ session: sessionCreate(), token: "must-never-surface" }, { status: 201 })
      }
      if (url.includes(subjectId)) return Response.json({ user: userCreate(subjectId, "Alex Morgan") })
      return Response.json({ user: userCreate(actorId, "Robin Vale") })
    })

    const started = await adapter.impersonationStart({
      durationSeconds: 300,
      reason: "Ticket NW-1",
      targetUserId: subjectId,
    })

    expect(startBody).toEqual({ durationSeconds: 300, reason: "Ticket NW-1", targetUserId: subjectId })
    expect(new URL(requests[0]?.url ?? "").pathname).toBe(`/realms/${realmId}/impersonations`)
    expect(new Headers(requests[0]?.init?.headers).get("x-csrf-token")).toBe("csrf-fixture")
    expect(requests[0]?.init?.credentials).toBe("same-origin")
    expect(started.success && started.data.subjectLabel).toBe("Alex Morgan")
    // The issued session token is discarded at this boundary and never surfaces to a view.
    expect(started.success && JSON.stringify(started.data)).not.toContain("must-never-surface")
  })

  test("resolves a fresh CSRF token per mutation when none is supplied", async () => {
    const requests: { init?: RequestInit; url: string }[] = []
    const adapter = impersonationAdminProductionAdapterCreate({
      baseUrl: "https://auth.example",
      fetch: async (input, init) => {
        const url = String(input)
        requests.push({ init, url })
        if (url.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-rotated" })
        return Response.json({ ended: true, sessionId })
      },
      realmId: () => realmId,
    })

    await adapter.impersonationEnd(sessionId)

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/realms/${realmId}/sessions/csrf`,
      `/realms/${realmId}/impersonations/${sessionId}/end`,
    ])
    expect(new Headers(requests[1]?.init?.headers).get("x-csrf-token")).toBe("csrf-rotated")
  })

  test("does not send the end mutation when the CSRF exchange fails", async () => {
    let requestCount = 0
    const adapter = impersonationAdminProductionAdapterCreate({
      baseUrl: "https://auth.example",
      fetch: async () => {
        requestCount += 1
        return Response.json(
          { error: { code: "sessions.unauthorized", message: "Session expired.", op: "csrf", status: 401 } },
          { status: 401 },
        )
      },
      realmId: () => realmId,
    })

    const result = await adapter.impersonationEnd(sessionId)

    expect(result.success).toBe(false)
    expect(requestCount).toBe(1)
  })

  test("surfaces the server's nesting refusal as a coded failure", async () => {
    const { adapter } = adapterCreate(() =>
      Response.json(
        {
          error: {
            code: "authorization.impersonation-forbidden",
            message: "Nested impersonation is not allowed.",
            op: "impersonationStart",
            status: 403,
          },
        },
        { status: 403 },
      ),
    )

    const started = await adapter.impersonationStart({
      durationSeconds: 300,
      reason: "Ticket NW-1",
      targetUserId: subjectId,
    })

    expect(!started.success && started.code).toBe("authorization.impersonation-forbidden")
  })

  test("reads no active impersonation when the browser session is not impersonated", async () => {
    const { adapter } = adapterCreate(() =>
      Response.json({ session: sessionCreate({ impersonated: undefined, impersonatorId: undefined }) }),
    )

    const active = await adapter.activeGet()

    expect(active.success && active.data).toBeNull()
  })

  test("exposes no operation that reads a session credential", () => {
    const { adapter } = adapterCreate(() => Response.json({ items: [] }))

    expect(Object.keys(adapter).some((name) => /token|secret|credential/i.test(name))).toBe(false)
  })
})
