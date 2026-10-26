import { createRoot, createSignal } from "solid-js"
import { describe, expect, test } from "bun:test"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { OidcClient } from "../../src/features/oidc/public/oidcClientSchema.js"
import { oidcAdminClientDetailViewStateCreate } from "../../src/features/oidc/ui/oidcAdminClientDetailViewStateCreate.js"
import { oidcAdminClientListViewStateCreate } from "../../src/features/oidc/ui/oidcAdminClientListViewStateCreate.js"
import { oidcAdminScopesSupported } from "../../src/features/oidc/ui/oidcAdminScopesSupported.js"

const client = {
  allowedScopes: ["openid", "profile"],
  accessTokenLifetimeSeconds: null,
  accessTokenRoleAssertion: true,
  clientType: "confidential",
  additionalOrigins: ["https://console.example"],
  createdAt: 1,
  devMode: false,
  grantTypes: ["authorization_code", "refresh_token"],
  id: "01900000-0000-7000-8000-000000000041",
  idTokenLifetimeSeconds: null,
  idTokenRoleAssertion: true,
  idTokenUserinfoAssertion: true,
  name: "Portal",
  postLogoutRedirectUris: [],
  realmId: "01900000-0000-7000-8000-000000000001",
  redirectUris: ["https://portal.example/callback"],
  refreshTokenAbsoluteLifetimeSeconds: null,
  refreshTokenIdleLifetimeSeconds: null,
  requireConsent: true,
  responseTypes: ["code"],
  status: "active",
  trusted: false,
  updatedAt: 1,
} satisfies OidcClient

const submitEvent = { preventDefault: () => undefined } as SubmitEvent

describe("OIDC client compatibility form state", () => {
  test("sends create settings and resets them after a successful create", async () => {
    const requests: unknown[] = []
    const state = oidcAdminClientListViewStateCreate({
      clientOpen: () => undefined,
      createOpen: () => true,
      createOpenSet: () => undefined,
      page: {
        clientCreate: async (input: unknown) => {
          requests.push(input)
          return true
        },
        clients: () => [],
      } as never,
      search: () => "",
      searchSet: () => undefined,
    })

    state.name.set("Compatibility client")
    state.redirectUris.set("https://portal.example/callback")
    state.idTokenUserinfoAssertion.set(true)
    state.accessTokenRoleAssertion.set(true)
    state.additionalOrigins.set("https://console.example\nhttps://admin.example")
    await state.createSubmit(submitEvent)

    expect(requests[0]).toMatchObject({
      accessTokenRoleAssertion: true,
      additionalOrigins: ["https://console.example", "https://admin.example"],
      idTokenUserinfoAssertion: true,
    })
    expect(state.accessTokenRoleAssertion.get()).toBe(false)
    expect(state.additionalOrigins.get()).toBe("")
    expect(state.idTokenUserinfoAssertion.get()).toBe(false)
  })

  test("hydrates detail settings and sends explicit false and empty values", async () => {
    const [currentClient, currentClientSet] = createSignal<OidcClient | undefined>(client)
    let request: unknown
    const state = createRoot((dispose) => {
      const detail = oidcAdminClientDetailViewStateCreate({
        onRemoved: () => undefined,
        page: {
          client: currentClient,
          clientUpdate: async (_clientId: string, input: unknown) => {
            request = input
            return true
          },
        } as never,
      })
      return { dispose, detail }
    })

    await Promise.resolve()
    expect(state.detail.accessTokenRoleAssertion.get()).toBe(true)
    expect(state.detail.idTokenUserinfoAssertion.get()).toBe(true)
    expect(state.detail.additionalOrigins.get()).toBe("https://console.example")

    state.detail.accessTokenRoleAssertion.set(false)
    state.detail.idTokenUserinfoAssertion.set(false)
    state.detail.additionalOrigins.set("")
    state.detail.settingsSubmit(submitEvent)
    await Promise.resolve()

    expect(request).toMatchObject({
      accessTokenRoleAssertion: false,
      additionalOrigins: [],
      idTokenUserinfoAssertion: false,
    })

    currentClientSet({
      ...client,
      accessTokenRoleAssertion: false,
      additionalOrigins: [],
      idTokenUserinfoAssertion: false,
    })
    await Promise.resolve()
    expect(state.detail.additionalOrigins.get()).toBe("")
    state.dispose()
  })
})

const projectFixture = {
  authorizationRequired: true,
  createdAt: 1,
  id: "01900000-0000-7000-8000-000000000031",
  name: "Acme Portal",
  organizationId: "01900000-0000-7000-8000-000000000011",
  projectAccessRequired: false,
  realmId: "01900000-0000-7000-8000-000000000001",
  status: "active",
  updatedAt: 1,
} as const

const applicationFixture = {
  applicationType: "oidc",
  createdAt: 1,
  id: "01900000-0000-7000-8000-000000000051",
  name: "Acme Web Portal",
  projectId: "01900000-0000-7000-8000-000000000031",
  realmId: "01900000-0000-7000-8000-000000000001",
  status: "active",
  updatedAt: 1,
} as const

const flush = async () => {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("OIDC client project and policy form state", () => {
  test("offers the resourceowner scope chip", () => {
    expect([...oidcAdminScopesSupported]).toContain("urn:zitadel:iam:user:resourceowner")
  })

  test("sends project, application, lifetimes, grants, and flags on create", async () => {
    const requests: unknown[] = []
    const applicationProjects: string[] = []
    const state = oidcAdminClientListViewStateCreate({
      applicationList: async (projectId: string) => {
        applicationProjects.push(projectId)
        return resultCreate([applicationFixture] as never)
      },
      clientOpen: () => undefined,
      createOpen: () => true,
      createOpenSet: () => undefined,
      page: {
        clientCreate: async (input: unknown) => {
          requests.push(input)
          return true
        },
        clients: () => [],
      } as never,
      projectList: async () => resultCreate([projectFixture] as never),
      search: () => "",
      searchSet: () => undefined,
    })
    await flush()

    expect([...state.projects()]).toHaveLength(1)
    state.name.set("Portal client")
    state.redirectUris.set("https://portal.example/callback")
    state.projectSelect(projectFixture.id)
    await flush()
    expect(applicationProjects).toEqual([projectFixture.id])
    expect([...state.applications()].map((application) => application.id)).toEqual([applicationFixture.id])
    state.applicationSelect(applicationFixture.id)
    state.accessTokenLifetimeSeconds.set("300")
    state.idTokenLifetimeSeconds.set("600")
    state.refreshTokenIdleLifetimeSeconds.set("3600")
    state.refreshTokenAbsoluteLifetimeSeconds.set("7200")
    state.grantToggle("refresh_token")
    state.devMode.set(true)
    state.idTokenRoleAssertion.set(true)
    state.scopeToggle("urn:zitadel:iam:user:resourceowner")
    await state.createSubmit(submitEvent)

    const request = requests[0] as Record<string, unknown>
    expect(request).toMatchObject({
      accessTokenLifetimeSeconds: 300,
      applicationId: applicationFixture.id,
      devMode: true,
      grantTypes: ["authorization_code"],
      idTokenLifetimeSeconds: 600,
      idTokenRoleAssertion: true,
      projectId: projectFixture.id,
      refreshTokenAbsoluteLifetimeSeconds: 7200,
      refreshTokenIdleLifetimeSeconds: 3600,
      responseTypes: ["code"],
    })
    expect(request["allowedScopes"] as readonly string[]).toContain("urn:zitadel:iam:user:resourceowner")
    expect(state.projectId.get()).toBe("")
    expect(state.applicationId.get()).toBe("")
    expect(state.accessTokenLifetimeSeconds.get()).toBe("")
    expect(state.devMode.get()).toBe(false)
    expect(state.idTokenRoleAssertion.get()).toBe(false)
    expect([...state.grants()]).toEqual(["authorization_code", "refresh_token"])
  })

  test("omits project, application, and lifetimes on create when empty", async () => {
    const requests: unknown[] = []
    const state = oidcAdminClientListViewStateCreate({
      clientOpen: () => undefined,
      createOpen: () => true,
      createOpenSet: () => undefined,
      page: {
        clientCreate: async (input: unknown) => {
          requests.push(input)
          return true
        },
        clients: () => [],
      } as never,
      search: () => "",
      searchSet: () => undefined,
    })

    state.name.set("Portal client")
    state.redirectUris.set("https://portal.example/callback")
    await state.createSubmit(submitEvent)

    expect(requests).toHaveLength(1)
    const request = requests[0] as Record<string, unknown>
    for (const key of [
      "projectId",
      "applicationId",
      "accessTokenLifetimeSeconds",
      "idTokenLifetimeSeconds",
      "refreshTokenIdleLifetimeSeconds",
      "refreshTokenAbsoluteLifetimeSeconds",
    ])
      expect(key in request, key).toBe(false)
  })

  test("rejects invalid lifetimes on create without submitting", async () => {
    for (const lifetime of ["not-a-number", "12.5", "-30", "99999999"]) {
      const requests: unknown[] = []
      const state = oidcAdminClientListViewStateCreate({
        clientOpen: () => undefined,
        createOpen: () => true,
        createOpenSet: () => undefined,
        page: {
          clientCreate: async (input: unknown) => {
            requests.push(input)
            return true
          },
          clients: () => [],
        } as never,
        search: () => "",
        searchSet: () => undefined,
      })

      state.name.set("Portal client")
      state.redirectUris.set("https://portal.example/callback")
      state.accessTokenLifetimeSeconds.set(lifetime)
      await state.createSubmit(submitEvent)

      expect(requests, lifetime).toHaveLength(0)
      expect(state.formError(), lifetime).toBeDefined()
    }
  })

  test("changing the project clears the application and reloads applications", async () => {
    const applicationProjects: string[] = []
    const state = oidcAdminClientListViewStateCreate({
      applicationList: async (projectId: string) => {
        applicationProjects.push(projectId)
        return resultCreate(projectId === projectFixture.id ? ([applicationFixture] as never) : [])
      },
      clientOpen: () => undefined,
      createOpen: () => true,
      createOpenSet: () => undefined,
      page: { clientCreate: async () => true, clients: () => [] } as never,
      projectList: async () => resultCreate([projectFixture] as never),
      search: () => "",
      searchSet: () => undefined,
    })

    state.projectSelect(projectFixture.id)
    await flush()
    state.applicationSelect(applicationFixture.id)
    state.projectSelect("")
    await flush()

    expect(state.applicationId.get()).toBe("")
    expect([...state.applications()]).toHaveLength(0)
    expect(applicationProjects).toEqual([projectFixture.id])
  })

  test("hydrates project, lifetimes, grants, and flags on detail", async () => {
    const [currentClient, currentClientSet] = createSignal<OidcClient | undefined>(undefined)
    const state = createRoot((dispose) => {
      const detail = oidcAdminClientDetailViewStateCreate({
        applicationList: async () => resultCreate([applicationFixture] as never),
        onRemoved: () => undefined,
        page: { client: currentClient, clientUpdate: async () => true } as never,
        projectList: async () => resultCreate([projectFixture] as never),
      })
      return { detail, dispose }
    })

    currentClientSet({
      ...client,
      accessTokenLifetimeSeconds: 300,
      applicationId: applicationFixture.id,
      devMode: true,
      grantTypes: ["authorization_code"],
      idTokenLifetimeSeconds: 600,
      idTokenRoleAssertion: true,
      projectId: projectFixture.id,
      refreshTokenAbsoluteLifetimeSeconds: 7200,
      refreshTokenIdleLifetimeSeconds: 3600,
      responseTypes: ["code"],
    })
    await flush()

    expect(state.detail.projectId.get()).toBe(projectFixture.id)
    expect(state.detail.applicationId.get()).toBe(applicationFixture.id)
    expect(state.detail.accessTokenLifetimeSeconds.get()).toBe("300")
    expect(state.detail.idTokenLifetimeSeconds.get()).toBe("600")
    expect(state.detail.refreshTokenIdleLifetimeSeconds.get()).toBe("3600")
    expect(state.detail.refreshTokenAbsoluteLifetimeSeconds.get()).toBe("7200")
    expect([...state.detail.grants()]).toEqual(["authorization_code"])
    expect([...state.detail.responses()]).toEqual(["code"])
    expect(state.detail.devMode.get()).toBe(true)
    expect(state.detail.idTokenRoleAssertion.get()).toBe(true)
    expect([...state.detail.projects()].map((project) => project.id)).toEqual([projectFixture.id])
    expect([...state.detail.applications()].map((application) => application.id)).toEqual([applicationFixture.id])
    state.dispose()
  })

  test("clears project and application on edit", async () => {
    const [currentClient] = createSignal<OidcClient | undefined>({
      ...client,
      applicationId: applicationFixture.id,
      projectId: projectFixture.id,
    })
    let request: unknown
    const state = createRoot((dispose) => {
      const detail = oidcAdminClientDetailViewStateCreate({
        onRemoved: () => undefined,
        page: {
          client: currentClient,
          clientUpdate: async (_clientId: string, input: unknown) => {
            request = input
            return true
          },
        } as never,
      })
      return { detail, dispose }
    })
    await flush()

    state.detail.projectSelect("")
    state.detail.settingsSubmit(submitEvent)
    await flush()

    expect(request).toMatchObject({ applicationId: null, projectId: null })
    state.dispose()
  })

  test("rejects invalid lifetimes on edit without submitting", async () => {
    const [currentClient] = createSignal<OidcClient | undefined>(client)
    let calls = 0
    const state = createRoot((dispose) => {
      const detail = oidcAdminClientDetailViewStateCreate({
        onRemoved: () => undefined,
        page: {
          client: currentClient,
          clientUpdate: async () => {
            calls += 1
            return true
          },
        } as never,
      })
      return { detail, dispose }
    })
    await flush()

    state.detail.refreshTokenIdleLifetimeSeconds.set("0")
    state.detail.settingsSubmit(submitEvent)
    await flush()

    expect(calls).toBe(0)
    expect(state.detail.formError()).toBeDefined()
    state.dispose()
  })
})
