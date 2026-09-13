import { expect, test } from "bun:test"
import { AdminService } from "@adaptive-ds/zitadel-cli/legacy_v1"
import { createRouterTransport } from "@connectrpc/connect"
import { zitadelMigrationExport } from "../../src/features/zitadelMigration/actions/zitadelMigrationExport.js"
import { zitadelApiClientCreate } from "../../src/features/zitadelMigration/client/zitadelApiClientCreate.js"

const apiBase = {
  organizationsList: async () => ({ success: true as const, data: [] }),
  usersList: async () => ({ success: true as const, data: [] }),
  machineUsersList: async () => ({ success: true as const, data: [] }),
  organizationMembershipsList: async () => ({ success: true as const, data: [] }),
  projectsList: async () => ({ success: true as const, data: [] }),
  projectGrantsList: async () => ({ success: true as const, data: [] }),
}

test("reports every snapshot collection complete for successful empty enumeration", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      projectRolesList: async () => ({ success: true as const, data: [] }),
      projectApplicationsList: async () => ({ success: true as const, data: [] }),
      organizationDomainsList: async () => ({ success: true as const, data: [] }),
      organizationLoginPolicyGet: async () => ({ success: true as const, data: {} }),
      identityProvidersList: async () => ({ success: true as const, data: [] }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  for (const collection of Object.keys(result.data.snapshot.completeness))
    expect(result.data.snapshot.completeness[collection as keyof typeof result.data.snapshot.completeness]).toEqual({
      complete: true,
      count: 0,
    })
})

test("keeps a successful incomplete snapshot when project enumeration fails", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      projectsList: async () => ({ success: false as const, op: "projects", errorMessage: "denied" }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.completeness.projects).toEqual({ complete: false, count: 0 })
})

test("exports empty complete domain and policy collections", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationDomainsList: async () => ({ success: true as const, data: [] }),
      organizationLoginPolicyGet: async () => ({ success: true as const, data: {} }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.completeness.domains).toEqual({ complete: true, count: 0 })
  expect(result.data.snapshot.completeness.loginPolicies).toEqual({ complete: true, count: 0 })
})

test("maps organization domains and login policies", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [{ id: "123", name: "Org", state: "ORGANIZATION_STATE_ACTIVE", details: { creationDate: 1 } }],
      }),
      organizationDomainsList: async () => ({
        success: true as const,
        data: [{ id: "domain-1", domain: "example.test", isVerified: true }],
      }),
      organizationLoginPolicyGet: async () => ({
        success: true as const,
        data: { allowUsernamePassword: true, allowExternalIdp: false },
      }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.domains[0]).toEqual({
    domain: "example.test",
    isPrimary: false,
    organizationId: "123",
    sourceId: "domain-1",
    verified: true,
  })
  expect(result.data.snapshot.loginPolicies[0]).toEqual({
    allowExternalIdp: false,
    allowUsernamePassword: true,
    organizationId: "123",
    sourceId: "123",
  })
})

test("omits inherited default policies without making the collection incomplete", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [{ id: "inherited", name: "Inherited" }],
      }),
      organizationLoginPolicyGet: async () => ({ success: true as const, data: { isDefault: true } }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.loginPolicies).toEqual([])
  expect(result.data.snapshot.completeness.loginPolicies).toEqual({ complete: true, count: 0 })
})

test("marks permission failures incomplete while retaining successful entities", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [{ id: "123", name: "Org", state: "ORGANIZATION_STATE_ACTIVE", details: { creationDate: 1 } }],
      }),
      organizationDomainsList: async () => ({ success: false as const, op: "test", errorMessage: "forbidden" }),
      organizationLoginPolicyGet: async () => ({
        success: true as const,
        data: { allowUsernamePassword: false, allowExternalIdp: true },
      }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.completeness.domains.complete).toBe(false)
  expect(result.data.snapshot.completeness.loginPolicies.complete).toBe(true)
})

test("uses recognized organization policy provider references when instance listing is empty", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [{ id: "123456789012345678", name: "Org", state: "ORGANIZATION_STATE_ACTIVE" }],
      }),
      projectRolesList: async () => ({ success: true as const, data: [] }),
      projectApplicationsList: async () => ({ success: true as const, data: [] }),
      organizationDomainsList: async () => ({ success: true as const, data: [] }),
      organizationLoginPolicyGet: async () => ({
        success: true as const,
        data: {
          idps: [
            { idpId: "github-id", idpName: "GitHub" },
            { idpId: "google-id", idpName: "Google" },
            { idpId: "id-only" },
            "google-id",
          ],
        },
      }),
      identityProvidersList: async () => ({ success: true as const, data: [] }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.identityProviders.map((provider) => [provider.sourceId, provider.authworksType])).toEqual(
    [
      ["github-id", "github"],
      ["google-id", "google"],
    ],
  )
  expect(result.data.snapshot.identityProviders.every((provider) => provider.organizationId === undefined)).toBe(true)
  expect(result.data.snapshot.completeness.identityProviders).toEqual({ complete: false, count: 2 })
})

test("keeps conflicting policy provider names unresolved", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [{ id: "123456789012345678", name: "Org", state: "ORGANIZATION_STATE_ACTIVE" }],
      }),
      projectRolesList: async () => ({ success: true as const, data: [] }),
      projectApplicationsList: async () => ({ success: true as const, data: [] }),
      organizationDomainsList: async () => ({ success: true as const, data: [] }),
      organizationLoginPolicyGet: async () => ({
        success: true as const,
        data: {
          idps: [
            { idpId: "provider", idpName: "GitHub" },
            { idpId: "provider", idpName: "Google" },
          ],
        },
      }),
      identityProvidersList: async () => ({ success: true as const, data: [] }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.identityProviders).toEqual([])
  expect(result.data.snapshot.completeness.identityProviders.complete).toBe(false)
})

test("keeps instance providers and adds missing organization policy references without exposing secrets", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [{ id: "123456789012345678", name: "Org", state: "ORGANIZATION_STATE_ACTIVE" }],
      }),
      projectRolesList: async () => ({ success: true as const, data: [] }),
      projectApplicationsList: async () => ({ success: true as const, data: [] }),
      organizationDomainsList: async () => ({ success: true as const, data: [] }),
      organizationLoginPolicyGet: async () => ({
        success: true as const,
        data: { idps: [{ idpId: "org-provider", idpName: "Google" }] },
      }),
      identityProvidersList: async () => ({
        success: true as const,
        data: [
          {
            id: "instance-provider",
            name: "Microsoft",
            type: "MICROSOFT",
            oidcConfig: { clientId: "instance-client", scopes: ["openid"] },
            autoRegister: true,
            enabled: true,
            clientSecret: "must-not-export",
          },
        ],
      }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.identityProviders).toEqual([
    expect.objectContaining({
      sourceId: "instance-provider",
      authworksType: "microsoft",
      configuration: { allowAccountCreation: true, scopes: ["openid"] },
    }),
    expect.objectContaining({
      sourceId: "org-provider",
      authworksType: "google",
    }),
  ])
  expect(JSON.stringify(result.data.snapshot)).not.toContain("must-not-export")
  expect(result.data.snapshot.completeness.identityProviders).toEqual({ complete: false, count: 2 })
})

test("adapter keeps instance providers and selected organization providers from the typed legacy listing", async () => {
  const transport = createRouterTransport((router) => {
    router.service(AdminService, {
      listIDPs: async () =>
        ({
          result: [
            {
              id: "instance-provider",
              name: "Google",
              owner: 1,
              state: 1,
              autoRegister: true,
              clientSecret: "must-not-be-returned",
              config: {
                case: "oidcConfig",
                value: { clientId: "instance-client", issuer: "https://accounts.google.com/", scopes: ["openid"] },
              },
            },
            {
              id: "selected-provider",
              name: "GitHub",
              owner: 2,
              state: 2,
              autoRegister: false,
              details: { resourceOwner: "org-1" },
              config: {
                case: "oidcConfig",
                value: { clientId: "selected-client", issuer: "https://github.com", scopes: ["read:user"] },
              },
            },
            {
              id: "other-provider",
              name: "Microsoft",
              owner: 2,
              state: 1,
              autoRegister: false,
              details: { resourceOwner: "org-2" },
              config: {
                case: "oidcConfig",
                value: {
                  clientId: "other-client",
                  issuer: "https://login.microsoftonline.com/common/v2.0",
                  scopes: ["openid"],
                },
              },
            },
          ],
        }) as never,
    })
  })
  const api = zitadelApiClientCreate({ baseUrl: "https://zitadel.test", token: "token", transport })
  const result = await api.identityProvidersList(["org-1"])
  expect(result).toMatchObject({
    success: true,
    data: [
      {
        id: "instance-provider",
        type: "GOOGLE",
        autoRegister: true,
      },
      {
        id: "selected-provider",
        organizationId: "org-1",
        type: "GITHUB",
      },
    ],
  })
  expect(JSON.stringify(result, (_key, value) => (typeof value === "bigint" ? value.toString() : value))).not.toContain(
    "must-not-be-returned",
  )
})

test("marks duplicate normalized project role keys incomplete", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [{ id: "123456789012345678", name: "Org", state: "active", details: { creationDate: 1, changeDate: 2 } }],
      }),
      projectsList: async () => ({
        success: true as const,
        data: [
          {
            id: "project",
            name: "Project",
            state: "active",
            details: { resourceOwner: "123456789012345678", creationDate: 1, changeDate: 2 },
          },
        ],
      }),
      projectRolesList: async () => ({
        success: true as const,
        data: [
          { id: "role-1", key: "admin", displayName: "Admin", details: { creationDate: 1, changeDate: 2 } },
          { id: "role-2", key: "admin", displayName: "Admin 2", details: { creationDate: 1, changeDate: 2 } },
        ],
      }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.completeness.projectRoles).toEqual({ complete: false, count: 2 })
})

test("maps supported OIDC settings and retains unsupported semantics", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [
          { id: "123456789012345678", name: "Org", state: "ORGANIZATION_STATE_ACTIVE", details: { creationDate: 1 } },
        ],
      }),
      projectsList: async () => ({
        success: true as const,
        data: [
          {
            id: "project-1",
            name: "Project",
            state: "PROJECT_STATE_ACTIVE",
            details: { resourceOwner: "123456789012345678", creationDate: 1 },
          },
        ],
      }),
      projectRolesList: async () => ({ success: true as const, data: [] }),
      organizationDomainsList: async () => ({ success: true as const, data: [] }),
      organizationLoginPolicyGet: async () => ({ success: true as const, data: { isDefault: true } }),
      identityProvidersList: async () => ({ success: true as const, data: [] }),
      projectApplicationsList: async () => ({
        success: true as const,
        data: [
          {
            id: "app-1",
            name: "Native app",
            projectId: "project-1",
            state: "APPLICATION_STATE_INACTIVE",
            creationDate: 1,
            changeDate: 2,
            applicationType: "oidc",
            oidcConfig: {
              applicationType: "OIDC_APP_TYPE_NATIVE",
              authMethodType: "OIDC_AUTH_METHOD_TYPE_POST",
              grantTypes: ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE", "OIDC_GRANT_TYPE_REFRESH_TOKEN"],
              postLogoutRedirectUris: ["https://example.test/logout"],
              redirectUris: ["https://example.test/callback"],
              responseTypes: ["OIDC_RESPONSE_TYPE_CODE"],
              version: "OIDC_VERSION_1_0",
              allowedScopes: ["openid", "profile"],
              accessTokenRoleAssertion: true,
              additionalOrigins: ["https://origin.example"],
              idTokenRoleAssertion: true,
              idTokenUserinfoAssertion: true,
              loginVersion: "2.0",
              requireConsent: false,
              trusted: true,
            },
          },
        ],
      }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.oidcApplications).toEqual([
    {
      accessTokenRoleAssertion: true,
      additionalOrigins: ["https://origin.example"],
      allowedScopes: ["openid", "profile"],
      clientType: "confidential",
      credentials: [{ available: false, portable: false, type: "client-secret" }],
      name: "Native app",
      projectId: "project-1",
      redirectUris: ["https://example.test/callback"],
      postLogoutRedirectUris: ["https://example.test/logout"],
      requireConsent: false,
      sourceId: "app-1",
      status: "inactive",
      tokenEndpointAuthMethod: "client_secret_post",
      idTokenUserinfoAssertion: true,
      trusted: true,
      createdAt: 1,
      updatedAt: 2,
    },
  ])
  expect(result.data.snapshot.completeness.oidcApplications).toEqual({ complete: false, count: 1 })
  expect(result.data.report.unsupported).toEqual([
    { entity: "oidcApplication", reason: "unsupported-oidc-setting:id-token-role-assertion", sourceId: "app-1" },
    { entity: "oidcApplication", reason: "unsupported-oidc-setting:login-version", sourceId: "app-1" },
  ])
})

test("distinguishes non-OIDC, missing, and unsupported OIDC application records", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [
          { id: "123456789012345678", name: "Org", state: "ORGANIZATION_STATE_ACTIVE", details: { creationDate: 1 } },
        ],
      }),
      projectsList: async () => ({
        success: true as const,
        data: [
          {
            id: "project-1",
            name: "Project",
            state: "PROJECT_STATE_ACTIVE",
            details: { resourceOwner: "123456789012345678", creationDate: 1 },
          },
        ],
      }),
      projectRolesList: async () => ({ success: true as const, data: [] }),
      organizationDomainsList: async () => ({ success: true as const, data: [] }),
      organizationLoginPolicyGet: async () => ({ success: true as const, data: { isDefault: true } }),
      identityProvidersList: async () => ({ success: true as const, data: [] }),
      projectApplicationsList: async () => ({
        success: true as const,
        data: [
          { id: "api-1", name: "API", applicationType: "APPLICATION_TYPE_API", state: 1, creationDate: 1 },
          { id: "saml-1", name: "SAML", applicationType: "APPLICATION_TYPE_SAML", state: 1, creationDate: 1 },
          {
            id: "missing-1",
            applicationType: "oidc",
            state: "APPLICATION_STATE_ACTIVE",
            oidcConfig: {
              authMethodType: "OIDC_AUTH_METHOD_TYPE_NONE",
              redirectUris: ["https://example.test/callback"],
            },
          },
          {
            id: "private-key-1",
            name: "Private key",
            applicationType: "oidc",
            state: "APPLICATION_STATE_ACTIVE",
            creationDate: 1,
            changeDate: 2,
            oidcConfig: {
              applicationType: "OIDC_APP_TYPE_WEB",
              authMethodType: "OIDC_AUTH_METHOD_TYPE_PRIVATE_KEY_JWT",
              redirectUris: ["https://example.test/callback"],
            },
          },
        ],
      }),
    } as never,
  })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.report.unsupported).toEqual([
    { entity: "oidcApplication", reason: "unsupported-application-protocol", sourceId: "api-1" },
    { entity: "oidcApplication", reason: "unsupported-application-protocol", sourceId: "saml-1" },
    { entity: "oidcApplication", reason: "unsupported-oidc-auth-method", sourceId: "private-key-1" },
  ])
  expect(result.data.report.skipped).toEqual([
    {
      entity: "oidcApplication",
      reason: "required-fields-missing:name,creationDate,changeDate",
      sourceId: "missing-1",
    },
  ])
  expect(result.data.snapshot.oidcApplications).toEqual([])
  expect(result.data.snapshot.completeness.oidcApplications).toEqual({ complete: false, count: 0 })
})
