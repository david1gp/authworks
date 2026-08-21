import { describe, expect, test } from "bun:test"
import { machineAdminFailureStatusSelect } from "../../src/features/machineUsers/ui/machineAdminFailureStatusSelect.js"
import { machineAdminProductionAdapterCreate } from "../../src/features/machineUsers/ui/machineAdminProductionAdapterCreate.js"
import { machineAdminScopeListParse } from "../../src/features/machineUsers/ui/machineAdminScopeListParse.js"

const realmId = "018f0000-0000-7000-8000-000000000001"
const machineUserId = "018f0000-0000-7000-8000-000000000071"
const credentialId = "018f0000-0000-7000-8000-000000000081"

const machineUser = {
  createdAt: 1,
  displayName: "Billing Sync Service",
  id: machineUserId,
  realmId,
  scopes: ["billing.read"],
  status: "active",
  updatedAt: 1,
  userName: "billing-sync",
}
const credential = {
  createdAt: 1,
  id: credentialId,
  kind: "api_key",
  machineUserId,
  name: "Integration key",
  realmId,
  scopes: ["billing.read"],
}

function adapterCreate(responder: (url: string) => Response) {
  const requests: { init?: RequestInit; url: string }[] = []
  const adapter = machineAdminProductionAdapterCreate({
    baseUrl: "https://auth.example",
    csrfToken: () => "csrf-fixture",
    fetch: async (input, init) => {
      const url = String(input)
      requests.push({ init, url })
      return responder(url)
    },
    realmId: () => realmId,
  })
  return { adapter, requests }
}

describe("machine-user administration production adapter", () => {
  test("reads collections from realm-scoped tenant paths with same-origin cookies", async () => {
    const { adapter, requests } = adapterCreate(() => Response.json({ items: [] }))

    await adapter.machineUserList()
    await adapter.credentialList(machineUserId)

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/realms/${realmId}/machine-users`,
      `/realms/${realmId}/machine-users/${machineUserId}/credentials`,
    ])
    for (const request of requests) expect(request.init?.credentials).toBe("same-origin")
    // The browser must never reach the operator-only system surface.
    expect(requests.every((request) => !request.url.includes("/system/"))).toBe(true)
  })

  test("requests a bounded page size and forwards the page token", async () => {
    const { adapter, requests } = adapterCreate(() => Response.json({ items: [] }))

    await adapter.machineUserList("page-2")

    const url = new URL(requests[0]?.url ?? "")
    expect(url.searchParams.get("pageSize")).toBe("25")
    expect(url.searchParams.get("pageToken")).toBe("page-2")
  })

  test("sends the supplied CSRF token on machine-user mutations", async () => {
    const { adapter, requests } = adapterCreate(() => Response.json({ machineUser }))

    await adapter.machineUserLifecycleSet(machineUserId, { status: "inactive" })

    expect(requests[0]?.init?.method).toBe("POST")
    expect(new Headers(requests[0]?.init?.headers).get("x-csrf-token")).toBe("csrf-fixture")
  })

  test("resolves a fresh CSRF token per mutation when none is supplied", async () => {
    const requests: { init?: RequestInit; url: string }[] = []
    const adapter = machineAdminProductionAdapterCreate({
      baseUrl: "https://auth.example",
      fetch: async (input, init) => {
        const url = String(input)
        requests.push({ init, url })
        if (url.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-rotated" })
        return Response.json({ clientId: "billing-sync", clientSecret: "s".repeat(43), machineUser })
      },
      realmId: () => realmId,
    })

    await adapter.clientSecretRotate(machineUserId)

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/realms/${realmId}/sessions/csrf`,
      `/realms/${realmId}/machine-users/${machineUserId}/client-secret/rotate`,
    ])
    expect(new Headers(requests[1]?.init?.headers).get("x-csrf-token")).toBe("csrf-rotated")
  })

  test("does not send a mutation when the CSRF exchange fails", async () => {
    let requestCount = 0
    const adapter = machineAdminProductionAdapterCreate({
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

    const result = await adapter.clientSecretRotate(machineUserId)

    expect(result.success).toBe(false)
    expect(requestCount).toBe(1)
  })

  test("posts credential issue and revocation to their dedicated tenant paths", async () => {
    const { adapter, requests } = adapterCreate((url) =>
      url.endsWith("/revoke") ? Response.json({ credential }) : Response.json({ credential, secret: "k".repeat(43) }),
    )

    const token = await adapter.personalAccessTokenCreate(machineUserId, { machineUserId, name: "Pipeline" })
    await adapter.apiKeyCreate(machineUserId, { machineUserId, name: "Integration" })
    await adapter.credentialRevoke(credentialId, "Rotated by policy")

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/realms/${realmId}/machine-users/${machineUserId}/personal-access-tokens`,
      `/realms/${realmId}/machine-users/${machineUserId}/api-keys`,
      `/realms/${realmId}/machine-credentials/${credentialId}/revoke`,
    ])
    for (const request of requests) expect(request.init?.method).toBe("POST")
    expect(token.success && token.data.secret).toBe("k".repeat(43))
  })

  test("forwards an optional revocation reason and omits it when absent", async () => {
    const { adapter, requests } = adapterCreate(() => Response.json({ credential }))

    await adapter.credentialRevoke(credentialId, "Compromised")
    await adapter.credentialRevoke(credentialId)

    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({ reason: "Compromised" })
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({})
  })

  test("unwraps the envelope and surfaces coded failures", async () => {
    const { adapter } = adapterCreate(() => Response.json({ machineUser }))
    const read = await adapter.machineUserGet(machineUserId)
    expect(read.success && read.data.displayName).toBe("Billing Sync Service")

    const { adapter: denied } = adapterCreate(() =>
      Response.json(
        { error: { code: "machine-users.forbidden", message: "Denied.", op: "machineUserList", status: 403 } },
        { status: 403 },
      ),
    )
    const failure = await denied.machineUserList()
    expect(!failure.success && failure.code).toBe("machine-users.forbidden")
  })

  test("exposes no operation that reads back a stored secret", () => {
    const { adapter } = adapterCreate(() => Response.json({ items: [] }))

    expect(Object.keys(adapter).filter((name) => /secret/i.test(name))).toEqual(["clientSecretRotate"])
  })
})

describe("machine-user administration failure mapping", () => {
  test("distinguishes permission, assurance, and tenant boundaries from generic errors", () => {
    expect(machineAdminFailureStatusSelect({ code: "machine-users.forbidden" })).toBe("permission-denied")
    expect(machineAdminFailureStatusSelect({ code: "machine-users.unauthorized" })).toBe("permission-denied")
    expect(machineAdminFailureStatusSelect({ statusCode: 403 })).toBe("permission-denied")
    expect(machineAdminFailureStatusSelect({ code: "authorization.insufficient-assurance" })).toBe("assurance-required")
    expect(machineAdminFailureStatusSelect({ code: "sessions.assurance-required" })).toBe("assurance-required")
    expect(machineAdminFailureStatusSelect({ code: "machine-users.tenant-mismatch" })).toBe("cross-tenant")
    expect(machineAdminFailureStatusSelect({ code: "machine-users.read-failed" })).toBe("error")
  })
})

describe("machine scope list parsing", () => {
  test("splits on spaces and commas, trims, and de-duplicates without normalising", () => {
    expect(machineAdminScopeListParse(" billing.read, billing.write  billing.read ")).toEqual([
      "billing.read",
      "billing.write",
    ])
    // Case is preserved exactly, because scopes are matched exactly by the server.
    expect(machineAdminScopeListParse("Billing.Read")).toEqual(["Billing.Read"])
    expect(machineAdminScopeListParse("   ")).toEqual([])
  })
})
