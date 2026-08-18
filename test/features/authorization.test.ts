import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { authorizationEnforce } from "../../src/features/authorization/actions/authorizationEnforce.js"
import { authorizationPolicyEvaluate } from "../../src/features/authorization/actions/authorizationPolicyEvaluate.js"
import { authorizationRolePermissionsResolve } from "../../src/features/authorization/actions/authorizationRolePermissionsResolve.js"
import { authorizationBootstrapAdminActorContextCreate } from "../../src/features/authorization/domain/authorizationBootstrapAdminActorContextCreate.js"
import { authorizationSystemActorContextCreate } from "../../src/features/authorization/domain/authorizationSystemActorContextCreate.js"
import { authorizationUserActorContextCreate } from "../../src/features/authorization/domain/authorizationUserActorContextCreate.js"
import { realmBootstrapAdminAuthenticate } from "../../src/features/realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationGet } from "../../src/features/organizations/actions/organizationGet.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-authorization-"))
  const opened = storageDatabaseOpen(join(directory, "zitadel.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

test("fixed roles allow only their declared permissions", () => {
  const member = authorizationUserActorContextCreate("realm-a", "user-a")
  const read = authorizationPolicyEvaluate({
    actor: member,
    realmId: "realm-a",
    organizationId: "organization-a",
    permission: "organization.read",
    roles: ["member"],
  })
  expect(read).toMatchObject({ success: true, data: { allowed: true, reason: "role" } })

  const manage = authorizationPolicyEvaluate({
    actor: member,
    realmId: "realm-a",
    organizationId: "organization-a",
    permission: "organization.manage",
    roles: ["member"],
  })
  expect(manage).toMatchObject({ success: true, data: { allowed: false, reason: "no_permission" } })

  const owner = authorizationPolicyEvaluate({
    actor: member,
    realmId: "realm-a",
    organizationId: "organization-a",
    permission: "organization.members.manage",
    roles: ["owner"],
  })
  expect(owner).toMatchObject({ success: true, data: { allowed: true, reason: "role" } })
})

test("custom roles and fine-grained policy rules support resource scoping and deny precedence", () => {
  const actor = authorizationUserActorContextCreate("realm-a", "user-a")
  const role = {
    name: "Project reader",
    permissions: ["project.read"],
    roleId: "project_reader",
  }
  expect(authorizationRolePermissionsResolve({ customRoles: [role], roles: ["project_reader"] })).toMatchObject({
    success: true,
  })

  const resourceRead = authorizationPolicyEvaluate({
    actor,
    customRoles: [role],
    realmId: "realm-a",
    permission: "project.read",
    resourceId: "project-a",
    roles: ["project_reader"],
  })
  expect(resourceRead).toMatchObject({ success: true, data: { allowed: true, reason: "role" } })

  const denied = authorizationPolicyEvaluate({
    actor,
    customRoles: [role],
    realmId: "realm-a",
    permission: "project.read",
    policies: [{ effect: "deny", permission: "project.read", resourceId: "project-a" }],
    resourceId: "project-a",
    roles: ["project_reader"],
  })
  expect(denied).toMatchObject({ success: true, data: { allowed: false, reason: "policy" } })

  const deniedByRole = authorizationPolicyEvaluate({
    actor,
    customRoles: [
      {
        deniedPermissions: ["project.read"],
        name: "Project blocked",
        permissions: ["project.read"],
        roleId: "project_blocked",
      },
    ],
    realmId: "realm-a",
    permission: "project.read",
    roles: ["project_blocked"],
  })
  expect(deniedByRole).toMatchObject({ success: true, data: { allowed: false, reason: "policy" } })

  const otherResource = authorizationPolicyEvaluate({
    actor,
    realmId: "realm-a",
    permission: "project.read",
    policies: [{ effect: "allow", permission: "project.read", resourceId: "project-a" }],
    resourceId: "project-b",
  })
  expect(otherResource).toMatchObject({ success: true, data: { allowed: false, reason: "resource_mismatch" } })
})

test("global policy permissions cover a resource while scoped denies stay local", () => {
  const decision = authorizationPolicyEvaluate({
    actor: authorizationUserActorContextCreate("realm-a", "user-a"),
    realmId: "realm-a",
    permission: "project.read",
    policies: [
      { effect: "allow", permission: "project.read" },
      { effect: "deny", permission: "project.read", resourceId: "project-b" },
    ],
    resourceId: "project-a",
  })

  expect(decision).toMatchObject({
    success: true,
    data: { allowed: true, reason: "policy", resourceId: "project-a" },
  })
})

test("role resolution aggregates known roles, ignores unknown roles, and rejects fixed-role collisions", () => {
  const resolved = authorizationRolePermissionsResolve({
    customRoles: [
      { name: "Reader", permissions: ["project.read"], roleId: "reader" },
      { name: "Writer", permissions: ["project.write"], roleId: "writer" },
    ],
    roles: ["missing", "reader", "writer"],
  })
  expect(resolved).toEqual({
    success: true,
    data: [
      { effect: "allow", permission: "project.read" },
      { effect: "allow", permission: "project.write" },
    ],
  })

  expect(
    authorizationRolePermissionsResolve({
      customRoles: [{ name: "Another owner", permissions: [], roleId: "owner" }],
      roles: ["owner"],
    }),
  ).toMatchObject({ success: false, op: "authorizationRolePermissionsResolve" })
})

test("assurance requirements allow multi-factor actors and reject weaker actors", () => {
  const policy = [{ effect: "allow" as const, minimumAssurance: "authenticated" as const, permission: "project.read" }]
  const authenticated = authorizationPolicyEvaluate({
    actor: authorizationUserActorContextCreate("realm-a", "user-a"),
    realmId: "realm-a",
    minimumAssurance: "multi_factor",
    permission: "project.read",
    policies: policy,
  })
  const multiFactor = authorizationPolicyEvaluate({
    actor: { ...authorizationUserActorContextCreate("realm-a", "user-a"), assurance: "multi_factor" as const },
    realmId: "realm-a",
    minimumAssurance: "multi_factor",
    permission: "project.read",
    policies: policy,
  })

  expect(authenticated).toMatchObject({ success: true, data: { allowed: false, reason: "insufficient_assurance" } })
  expect(multiFactor).toMatchObject({ success: true, data: { allowed: true, reason: "policy" } })
})

test("actor validation runs before bootstrap privileges and rejects incompatible context metadata", () => {
  expect(
    authorizationPolicyEvaluate({
      actor: authorizationBootstrapAdminActorContextCreate("realm-a", "admin-a"),
      realmId: "realm-b",
      permission: "anything.write",
    }),
  ).toMatchObject({ success: true, data: { allowed: false, reason: "tenant_mismatch" } })

  expect(
    authorizationPolicyEvaluate({
      actor: { ...realmTenantContextCreate("realm-a", "anonymous").actor },
      realmId: "realm-a",
      permission: "project.read",
      policies: [{ effect: "allow", permission: "project.read" }],
      roles: ["owner"],
    }),
  ).toMatchObject({ success: true, data: { allowed: false, reason: "anonymous" } })

  expect(
    authorizationPolicyEvaluate({
      actor: { ...authorizationSystemActorContextCreate(), realmId: "realm-a" },
      realmId: "realm-a",
      permission: "project.read",
    }),
  ).toMatchObject({ success: false, op: "authorizationPolicyEvaluate" })

  expect(
    authorizationPolicyEvaluate({
      actor: { ...authorizationUserActorContextCreate("realm-a", "user-a"), impersonatorId: "admin-a" },
      realmId: "realm-a",
      permission: "project.read",
    }),
  ).toMatchObject({ success: false, op: "authorizationPolicyEvaluate" })
})

test("actor scope isolation rejects forged tenant and organization contexts", () => {
  const actor = authorizationUserActorContextCreate("realm-a", "user-a", "organization-a")
  expect(
    authorizationEnforce({
      actor,
      realmId: "realm-b",
      organizationId: "organization-a",
      permission: "organization.read",
      roles: ["owner"],
    }),
  ).toEqual({
    code: "authorization.tenant-mismatch",
    errorMessage: "The actor is not available in this tenant context.",
    op: "authorizationEnforce",
    success: false,
  })
  expect(
    authorizationPolicyEvaluate({
      actor,
      realmId: "realm-a",
      organizationId: "organization-b",
      permission: "organization.read",
      roles: ["owner"],
    }),
  ).toMatchObject({ success: true, data: { allowed: false, reason: "organization_mismatch" } })
  expect(
    authorizationPolicyEvaluate({
      actor: authorizationUserActorContextCreate("realm-a", "user-a"),
      realmId: "realm-a",
      permission: "organization.read",
      roles: ["owner"],
    }),
  ).toMatchObject({ success: true, data: { allowed: true } })
})

test("anonymous, system, and bootstrap actors have explicit boundary behavior", () => {
  expect(
    authorizationPolicyEvaluate({
      actor: realmTenantContextCreate("realm-a", "anonymous").actor,
      realmId: "realm-a",
      permission: "realm.read",
    }),
  ).toMatchObject({ success: true, data: { allowed: false, reason: "anonymous" } })
  expect(
    authorizationPolicyEvaluate({
      actor: authorizationSystemActorContextCreate(),
      realmId: "realm-b",
      organizationId: "organization-b",
      permission: "anything.read",
    }),
  ).toMatchObject({ success: true, data: { allowed: true, reason: "system" } })
  expect(
    authorizationPolicyEvaluate({
      actor: authorizationBootstrapAdminActorContextCreate("realm-a", "admin-a"),
      realmId: "realm-a",
      organizationId: "organization-a",
      permission: "anything.write",
    }),
  ).toMatchObject({ success: true, data: { allowed: true, reason: "bootstrap_admin" } })
})

test("organization enforcement uses database membership and keeps bootstrap administration tenant scoped", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const alpha = realmCreate({
      context: system,
      database,
      input: { domain: "auth-alpha.example.com", name: "Alpha" },
    })
    const beta = realmCreate({
      context: system,
      database,
      input: { domain: "auth-beta.example.com", name: "Beta" },
    })
    expect(alpha.success && beta.success).toBe(true)
    if (!alpha.success || !beta.success) return
    const alphaOrganization = organizationCreate({
      context: system,
      database,
      input: { name: "Alpha", ownerUserId: "user-a" },
      realmId: alpha.data.realm.id,
    })
    const betaOrganization = organizationCreate({
      context: system,
      database,
      input: { name: "Beta", ownerUserId: "user-b" },
      realmId: beta.data.realm.id,
    })
    expect(alphaOrganization.success && betaOrganization.success).toBe(true)
    if (!alphaOrganization.success || !betaOrganization.success) return

    expect(
      organizationGet({
        context: realmTenantContextCreate(alpha.data.realm.id, "user-a"),
        database,
        realmId: alpha.data.realm.id,
        organizationId: alphaOrganization.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationGet({
        context: realmTenantContextCreate(alpha.data.realm.id, "user-a"),
        database,
        realmId: beta.data.realm.id,
        organizationId: betaOrganization.data.organization.id,
      }).success,
    ).toBe(false)

    const bootstrap = realmBootstrapAdminCreate({
      context: system,
      database,
      realmId: alpha.data.realm.id,
    })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const authenticated = realmBootstrapAdminAuthenticate({
      context: realmTenantContextCreate(alpha.data.realm.id, "anonymous"),
      database,
      secret: bootstrap.data.bootstrapAdmin.secret.valueGet(),
    })
    expect(authenticated.success).toBe(true)
    if (!authenticated.success) return
    expect(
      organizationGet({
        context: authenticated.data,
        database,
        realmId: alpha.data.realm.id,
        organizationId: alphaOrganization.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationMembershipCreate({
        context: authenticated.data,
        database,
        input: { roles: ["member"], userId: "user-c" },
        realmId: beta.data.realm.id,
        organizationId: betaOrganization.data.organization.id,
      }).success,
    ).toBe(false)
  })
})
