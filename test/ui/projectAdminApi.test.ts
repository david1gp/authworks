import { describe, expect, test } from "bun:test"
import { projectAdminProductionAdapterCreate } from "../../src/features/projects/ui/projectAdminProductionAdapterCreate.js"

const realmId = "018f0000-0000-7000-8000-000000000001"
const projectId = "018f0000-0000-7000-8000-000000000031"

function adapterCreate(responder: (url: string) => Response) {
  const requests: { init?: RequestInit; url: string }[] = []
  const adapter = projectAdminProductionAdapterCreate({
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

describe("project administration production adapter", () => {
  test("reads collections from realm-scoped tenant paths with same-origin cookies", async () => {
    const { adapter, requests } = adapterCreate(() => Response.json({ items: [] }))

    await adapter.projectList()
    await adapter.applicationList(projectId)
    await adapter.grantList(projectId)
    await adapter.roleList(projectId)

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/realms/${realmId}/projects`,
      `/realms/${realmId}/projects/${projectId}/applications`,
      `/realms/${realmId}/projects/${projectId}/grants`,
      `/realms/${realmId}/projects/${projectId}/roles`,
    ])
    for (const request of requests) expect(request.init?.credentials).toBe("same-origin")
    // Never the operator-only /system/** surface.
    expect(requests.every((request) => !request.url.includes("/system/"))).toBe(true)
  })

  test("requests a bounded page size and forwards the page token", async () => {
    const { adapter, requests } = adapterCreate(() => Response.json({ items: [] }))

    await adapter.projectList("page-2")

    const url = new URL(requests[0]?.url ?? "")
    expect(url.searchParams.get("pageSize")).toBe("25")
    expect(url.searchParams.get("pageToken")).toBe("page-2")
  })

  test("sends the supplied CSRF token on mutations", async () => {
    const { adapter, requests } = adapterCreate(() =>
      Response.json({ application: { applicationType: "oidc", name: "Portal" } }),
    )

    await adapter.applicationCreate(projectId, { applicationType: "oidc", name: "Portal" })

    expect(requests[0]?.init?.method).toBe("POST")
    expect(new Headers(requests[0]?.init?.headers).get("x-csrf-token")).toBe("csrf-fixture")
  })

  test("resolves a fresh CSRF token per mutation when none is supplied", async () => {
    const requests: { init?: RequestInit; url: string }[] = []
    const adapter = projectAdminProductionAdapterCreate({
      baseUrl: "https://auth.example",
      fetch: async (input, init) => {
        const url = String(input)
        requests.push({ init, url })
        if (url.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-rotated" })
        return Response.json({ role: { displayName: "Auditor", key: "auditor" } })
      },
      realmId: () => realmId,
    })

    await adapter.roleCreate(projectId, { displayName: "Auditor", key: "auditor" })

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/realms/${realmId}/sessions/csrf`,
      `/realms/${realmId}/projects/${projectId}/roles`,
    ])
    expect(new Headers(requests[1]?.init?.headers).get("x-csrf-token")).toBe("csrf-rotated")
  })

  test("does not send a mutation when the CSRF exchange fails", async () => {
    let requestCount = 0
    const adapter = projectAdminProductionAdapterCreate({
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

    const result = await adapter.projectDelete(projectId)

    expect(result.success).toBe(false)
    expect(requestCount).toBe(1)
  })

  test("unwraps the envelope and surfaces coded failures", async () => {
    const { adapter } = adapterCreate(() =>
      Response.json({
        project: {
          authorizationRequired: false,
          createdAt: 1,
          id: projectId,
          name: "Acme",
          organizationId: projectId,
          projectAccessRequired: false,
          realmId,
          status: "active",
          updatedAt: 1,
        },
      }),
    )

    const project = await adapter.projectGet(projectId)
    expect(project.success && project.data.name).toBe("Acme")

    const { adapter: denied } = adapterCreate(() =>
      Response.json(
        { error: { code: "projects.forbidden", message: "Denied.", op: "projectList", status: 403 } },
        { status: 403 },
      ),
    )
    const failure = await denied.projectList()
    expect(failure.success).toBe(false)
    expect(!failure.success && failure.code).toBe("projects.forbidden")
  })
})
