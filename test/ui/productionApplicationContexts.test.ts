import { afterEach, describe, expect, test } from "bun:test"
import { productionApplicationContextsCreate } from "../../src/ui/production/productionApplicationContextsCreate.js"

const realmId = "018f0000-0000-7000-8000-000000000001"
const organizationId = "123456789012345678"
const userId = "98765432109876543210"
const previousFetch = globalThis.fetch
const previousWindow = globalThis.window

afterEach(() => {
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: previousFetch })
  Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow })
})

describe("production application contexts", () => {
  test("repeats authenticated bootstrap with a fresh, uncached /me response", async () => {
    const mePath = `/realms/${realmId}/me`
    const meRequestCaches: RequestCache[] = []
    const responses: Record<string, unknown> = {
      "/organization-discovery": {
        branding: {
          dark: { backgroundColor: "#111827", fontColor: "#f9fafb", primaryColor: "#60a5fa", warnColor: "#f87171" },
          disableWatermark: true,
          light: { backgroundColor: "#f8fafc", fontColor: "#111827", primaryColor: "#2563eb", warnColor: "#dc2626" },
          themeMode: "system",
        },
        domain: "customer.example",
        found: true,
        organization: { id: organizationId, name: "Owner organization", realmId },
        policy: {
          allowDomainDiscovery: true,
          allowEmailOtp: true,
          allowExternalIdentity: true,
          allowExternalIdentityAutoLinking: true,
          allowPassword: true,
          allowPasswordRecovery: true,
          allowPasskey: true,
          allowRegistration: true,
          providerIds: [],
          requiredMfa: false,
          allowedFactors: ["totp", "email_otp", "passkey"],
          preferredFactorOrder: ["totp", "email_otp", "passkey"],
          minimumStepUpAssurance: "authenticated",
        },
        providers: [],
      },
      [`/realms/${realmId}/me`]: {
        capabilities: { realmRead: false },
        user: {
          createdAt: 1,
          email: "alice@example.com",
          emailVerified: true,
          id: userId,
          profile: { displayName: "Alice Example" },
          realmId,
          state: "active",
          updatedAt: 1,
          userName: "alice",
          verificationState: "verified",
        },
      },
      [`/realms/${realmId}/me/organizations`]: {
        items: [
          {
            membership: {
              createdAt: 1,
              id: "membership-1",
              organizationId,
              realmId,
              roles: ["member"],
              updatedAt: 1,
              userId,
            },
            organization: {
              createdAt: 1,
              id: organizationId,
              name: "Owner organization",
              realmId,
              status: "active",
              updatedAt: 1,
            },
          },
        ],
      },
      [`/realms/${realmId}/sessions/current`]: {
        session: {
          assurance: "authenticated",
          authenticationMethod: "password",
          createdAt: 1,
          current: true,
          device: {},
          expiresAt: 2,
          id: "session-1",
          lastUsedAt: 1,
          realmId,
          revokedAt: null,
          subjectId: userId,
          subjectType: "user",
          userId,
        },
      },
      [`/realms/${realmId}`]: {
        realm: {
          createdAt: 1,
          domain: "customer.example",
          domains: ["customer.example"],
          id: realmId,
          name: "customer",
          status: "active",
          updatedAt: 1,
        },
      },
    }
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async (input: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(input), "https://auth.example").pathname
        if (path === mePath) meRequestCaches.push(init?.cache ?? "default")
        const body = responses[path]
        return body === undefined ? Response.json({}, { status: 404 }) : Response.json(body)
      },
    })
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { href: "https://auth.example/account#access" } },
    })

    const contexts = await productionApplicationContextsCreate()

    expect(contexts.session.organizations).toEqual([{ id: organizationId, label: "Owner organization" }])
    expect(contexts.session.guard.organization).toEqual({ organizationId, status: "available" })
    expect(contexts.session.guard.authentication).toEqual({ status: "authenticated", userId })
    expect(contexts.session.guard.permission).toBe("denied")

    const firstMeResponse = responses[mePath]
    if (firstMeResponse === undefined || typeof firstMeResponse !== "object" || firstMeResponse === null)
      throw new Error("The /me test response was not configured.")
    const firstMeObject = firstMeResponse as {
      readonly capabilities: { readonly realmRead: boolean }
      readonly user: { readonly profile: { readonly displayName: string } }
    }
    responses[mePath] = {
      ...firstMeObject,
      user: { ...firstMeObject.user, profile: { displayName: "Refreshed User" } },
    }

    const refreshed = await productionApplicationContextsCreate()

    expect(refreshed.session.actorLabel).toBe("Refreshed User")
    expect(meRequestCaches).toEqual(["no-store", "no-store"])
  })

  test("switches the authoritative organization in-app and replaces only the organization URL state", async () => {
    const secondOrganizationId = "12345678901234567891"
    let href = `https://auth.example/account?organization=${organizationId}#access`
    let assignCount = 0
    let switchShouldFail = false
    const requests: string[] = []
    const organizations = [
      {
        membership: {
          createdAt: 1,
          id: "membership-1",
          organizationId,
          realmId,
          roles: ["member"],
          updatedAt: 1,
          userId,
        },
        organization: {
          createdAt: 1,
          id: organizationId,
          name: "Owner organization",
          realmId,
          status: "active",
          updatedAt: 1,
        },
      },
      {
        membership: {
          createdAt: 1,
          id: "membership-2",
          organizationId: secondOrganizationId,
          realmId,
          roles: ["member"],
          updatedAt: 1,
          userId,
        },
        organization: {
          createdAt: 1,
          id: secondOrganizationId,
          name: "Field Notes",
          realmId,
          status: "active",
          updatedAt: 1,
        },
      },
    ]
    const responses: Record<string, unknown> = {
      "/organization-discovery": {
        branding: {
          dark: { backgroundColor: "#111827", fontColor: "#f9fafb", primaryColor: "#60a5fa", warnColor: "#f87171" },
          disableWatermark: true,
          light: { backgroundColor: "#f8fafc", fontColor: "#111827", primaryColor: "#2563eb", warnColor: "#dc2626" },
          themeMode: "system",
        },
        domain: "customer.example",
        found: true,
        organization: { id: organizationId, name: "Owner organization", realmId },
        policy: {
          allowDomainDiscovery: true,
          allowEmailOtp: true,
          allowExternalIdentity: true,
          allowExternalIdentityAutoLinking: true,
          allowPassword: true,
          allowPasswordRecovery: true,
          allowPasskey: true,
          allowRegistration: true,
          providerIds: [],
          requiredMfa: false,
          allowedFactors: ["totp", "email_otp", "passkey"],
          preferredFactorOrder: ["totp", "email_otp", "passkey"],
          minimumStepUpAssurance: "authenticated",
        },
        providers: [],
      },
      [`/realms/${realmId}`]: {
        realm: {
          createdAt: 1,
          domain: "customer.example",
          domains: ["customer.example"],
          id: realmId,
          name: "customer",
          status: "active",
          updatedAt: 1,
        },
      },
      [`/realms/${realmId}/me`]: {
        capabilities: { realmRead: true },
        user: {
          createdAt: 1,
          email: "alice@example.com",
          emailVerified: true,
          id: userId,
          profile: { displayName: "Alice Example" },
          realmId,
          state: "active",
          updatedAt: 1,
          userName: "alice",
          verificationState: "verified",
        },
      },
      [`/realms/${realmId}/me/organizations`]: { items: organizations },
      [`/realms/${realmId}/sessions/current`]: {
        session: {
          assurance: "authenticated",
          authenticationMethod: "password",
          createdAt: 1,
          current: true,
          device: {},
          expiresAt: 2,
          id: "session-1",
          lastUsedAt: 1,
          organizationId,
          realmId,
          revokedAt: null,
          subjectId: userId,
          subjectType: "user",
          userId,
        },
      },
    }
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async (input: string | URL | Request) => {
        const requestUrl = new URL(String(input), "https://auth.example")
        requests.push(requestUrl.pathname)
        if (requestUrl.pathname.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-fixture" })
        if (requestUrl.pathname.endsWith("/me/organizations/switch")) {
          if (switchShouldFail)
            return Response.json(
              { error: { code: "organizations.forbidden", message: "Switch denied.", op: "organizationMeSwitch" } },
              { status: 403 },
            )
          return Response.json({
            activeOrganizationId: secondOrganizationId,
            context: {
              actor: {
                actorId: userId,
                assurance: "authenticated",
                authenticationMethod: "trusted",
                kind: "user",
                organizationId: secondOrganizationId,
                realmId,
              },
              actorId: userId,
              kind: "organization",
              organizationId: secondOrganizationId,
              realmId,
            },
            organization: organizations[1]?.organization,
          })
        }
        const response = responses[requestUrl.pathname]
        return response === undefined ? Response.json({}, { status: 404 }) : Response.json(response)
      },
    })
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        history: {
          replaceState: (_state: unknown, _title: string, next: string) => {
            href = new URL(next, href).toString()
          },
          state: null,
        },
        location: {
          get href() {
            return href
          },
          host: "auth.example",
          origin: "https://auth.example",
        },
      },
    })
    Object.defineProperty(globalThis.window.location, "assign", {
      configurable: true,
      value: () => {
        assignCount += 1
      },
    })

    const contexts = await productionApplicationContextsCreate()
    const switched = await contexts.session.organizationSelect(secondOrganizationId)

    expect(switched).toEqual({ data: undefined, success: true })
    expect(contexts.session.guard.organization).toEqual({
      organizationId: secondOrganizationId,
      status: "available",
    })
    expect(href).toBe(`https://auth.example/account?organization=${secondOrganizationId}#access`)
    expect(assignCount).toBe(0)
    expect(requests).toContain(`/realms/${realmId}/sessions/csrf`)
    expect(requests).toContain(`/realms/${realmId}/me/organizations/switch`)
    expect(requests.filter((path) => path === `/realms/${realmId}/me`)).toHaveLength(1)

    switchShouldFail = true
    const failed = await contexts.session.organizationSelect(organizationId)
    expect(failed.success).toBe(false)
    expect(contexts.session.guard.organization).toEqual({
      organizationId: secondOrganizationId,
      status: "available",
    })
    expect(href).toBe(`https://auth.example/account?organization=${secondOrganizationId}#access`)
  })

  test("rejects mismatched top-level switch invariants while allowing a nested actor organization mismatch", async () => {
    const secondOrganizationId = "12345678901234567891"
    const fixture = productionOrganizationSwitchFixtureInstall(secondOrganizationId)
    const contexts = await productionApplicationContextsCreate()

    fixture.setSwitchResponse(productionOrganizationSwitchResponseCreate(secondOrganizationId, organizationId))
    const nestedActorMismatch = await contexts.session.organizationSelect(secondOrganizationId)
    expect(nestedActorMismatch).toEqual({ data: undefined, success: true })
    expect(contexts.session.guard.organization).toEqual({
      organizationId: secondOrganizationId,
      status: "available",
    })

    fixture.setSwitchResponse(productionOrganizationSwitchResponseCreate(organizationId))
    const reset = await contexts.session.organizationSelect(organizationId)
    expect(reset).toEqual({ data: undefined, success: true })

    const validResponse = productionOrganizationSwitchResponseCreate(secondOrganizationId)
    const mismatches = [
      { ...validResponse, activeOrganizationId: organizationId },
      { ...validResponse, context: { ...validResponse.context, organizationId } },
      { ...validResponse, context: { ...validResponse.context, realmId: "018f0000-0000-7000-8000-000000000003" } },
      { ...validResponse, context: { ...validResponse.context, actorId: "different-actor" } },
      {
        ...validResponse,
        context: {
          ...validResponse.context,
          actor: { ...validResponse.context.actor, realmId: "018f0000-0000-7000-8000-000000000003" },
        },
      },
      { ...validResponse, organization: { ...validResponse.organization, id: organizationId } },
      {
        ...validResponse,
        organization: { ...validResponse.organization, realmId: "018f0000-0000-7000-8000-000000000003" },
      },
    ]

    for (const response of mismatches) {
      fixture.setSwitchResponse(response)
      const result = await contexts.session.organizationSelect(secondOrganizationId)

      expect(result).toMatchObject({ code: "platform.invalid-response", success: false })
      expect(contexts.session.guard.organization).toEqual({ organizationId, status: "available" })
    }
  })
})

function productionOrganizationSwitchFixtureInstall(secondOrganizationId: string) {
  const secondOrganization = {
    createdAt: 1,
    id: secondOrganizationId,
    name: "Field Notes",
    realmId,
    status: "active",
    updatedAt: 1,
  }
  const organizations = [
    {
      membership: {
        createdAt: 1,
        id: "membership-1",
        organizationId,
        realmId,
        roles: ["member"],
        updatedAt: 1,
        userId,
      },
      organization: {
        createdAt: 1,
        id: organizationId,
        name: "Owner organization",
        realmId,
        status: "active",
        updatedAt: 1,
      },
    },
    {
      membership: {
        createdAt: 1,
        id: "membership-2",
        organizationId: secondOrganizationId,
        realmId,
        roles: ["member"],
        updatedAt: 1,
        userId,
      },
      organization: secondOrganization,
    },
  ]
  const responses: Record<string, unknown> = {
    "/organization-discovery": {
      branding: {
        dark: { backgroundColor: "#111827", fontColor: "#f9fafb", primaryColor: "#60a5fa", warnColor: "#f87171" },
        disableWatermark: true,
        light: { backgroundColor: "#f8fafc", fontColor: "#111827", primaryColor: "#2563eb", warnColor: "#dc2626" },
        themeMode: "system",
      },
      domain: "customer.example",
      found: true,
      organization: { id: organizationId, name: "Owner organization", realmId },
      policy: {
        allowDomainDiscovery: true,
        allowEmailOtp: true,
        allowExternalIdentity: true,
        allowExternalIdentityAutoLinking: true,
        allowPassword: true,
        allowPasswordRecovery: true,
        allowPasskey: true,
        allowRegistration: true,
        providerIds: [],
        requiredMfa: false,
        allowedFactors: ["totp", "email_otp", "passkey"],
        preferredFactorOrder: ["totp", "email_otp", "passkey"],
        minimumStepUpAssurance: "authenticated",
      },
      providers: [],
    },
    [`/realms/${realmId}`]: {
      realm: {
        createdAt: 1,
        domain: "customer.example",
        domains: ["customer.example"],
        id: realmId,
        name: "customer",
        status: "active",
        updatedAt: 1,
      },
    },
    [`/realms/${realmId}/me`]: {
      capabilities: { realmRead: true },
      user: {
        createdAt: 1,
        email: "alice@example.com",
        emailVerified: true,
        id: userId,
        profile: { displayName: "Alice Example" },
        realmId,
        state: "active",
        updatedAt: 1,
        userName: "alice",
        verificationState: "verified",
      },
    },
    [`/realms/${realmId}/me/organizations`]: { items: organizations },
    [`/realms/${realmId}/sessions/current`]: {
      session: {
        assurance: "authenticated",
        authenticationMethod: "password",
        createdAt: 1,
        current: true,
        device: {},
        expiresAt: 2,
        id: "session-1",
        lastUsedAt: 1,
        organizationId,
        realmId,
        revokedAt: null,
        subjectId: userId,
        subjectType: "user",
        userId,
      },
    },
  }
  let switchResponse: ReturnType<typeof productionOrganizationSwitchResponseCreate> =
    productionOrganizationSwitchResponseCreate(secondOrganizationId)
  let href = `https://auth.example/account?organization=${organizationId}#access`

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: string | URL | Request) => {
      const requestUrl = new URL(String(input), "https://auth.example")
      if (requestUrl.pathname.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-fixture" })
      if (requestUrl.pathname.endsWith("/me/organizations/switch")) return Response.json(switchResponse)
      const response = responses[requestUrl.pathname]
      return response === undefined ? Response.json({}, { status: 404 }) : Response.json(response)
    },
  })
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      history: {
        replaceState: (_state: unknown, _title: string, next: string) => {
          href = new URL(next, href).toString()
        },
        state: null,
      },
      location: {
        get href() {
          return href
        },
        host: "auth.example",
        origin: "https://auth.example",
      },
    },
  })

  return {
    setSwitchResponse: (response: ReturnType<typeof productionOrganizationSwitchResponseCreate>) => {
      switchResponse = response
    },
  }
}

function productionOrganizationSwitchResponseCreate(
  targetOrganizationId: string,
  actorOrganizationId = targetOrganizationId,
) {
  return {
    activeOrganizationId: targetOrganizationId,
    context: {
      actor: {
        actorId: userId,
        assurance: "authenticated",
        authenticationMethod: "trusted",
        kind: "user",
        organizationId: actorOrganizationId,
        realmId,
      },
      actorId: userId,
      kind: "organization",
      organizationId: targetOrganizationId,
      realmId,
    },
    organization: {
      createdAt: 1,
      id: targetOrganizationId,
      name: targetOrganizationId === organizationId ? "Owner organization" : "Field Notes",
      realmId,
      status: "active",
      updatedAt: 1,
    },
  }
}
