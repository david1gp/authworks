import { expect, test } from "bun:test"
import { zitadelMigrationExport } from "../../src/features/zitadelMigration/actions/zitadelMigrationExport.js"

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

/*
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [{ id: "org", name: "Org", state: "ORGANIZATION_STATE_ACTIVE" }],
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
})

test("keeps conflicting policy provider names unresolved", async () => {
  const result = await zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [{ id: "org", name: "Org", state: "ORGANIZATION_STATE_ACTIVE" }],
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

*/
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
