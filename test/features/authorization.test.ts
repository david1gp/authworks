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
import { instanceBootstrapAdminAuthenticate } from "../../src/features/instances/actions/instanceBootstrapAdminAuthenticate.js"
import { instanceBootstrapAdminCreate } from "../../src/features/instances/actions/instanceBootstrapAdminCreate.js"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
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
  const member = authorizationUserActorContextCreate("instance-a", "user-a")
  const read = authorizationPolicyEvaluate({
    actor: member,
    instanceId: "instance-a",
    organizationId: "organization-a",
    permission: "organization.read",
    roles: ["member"],
  })
  expect(read).toMatchObject({ success: true, data: { allowed: true, reason: "role" } })

  const manage = authorizationPolicyEvaluate({
    actor: member,
    instanceId: "instance-a",
    organizationId: "organization-a",
    permission: "organization.manage",
    roles: ["member"],
  })
  expect(manage).toMatchObject({ success: true, data: { allowed: false, reason: "no_permission" } })

  const owner = authorizationPolicyEvaluate({
    actor: member,
    instanceId: "instance-a",
    organizationId: "organization-a",
    permission: "organization.members.manage",
    roles: ["owner"],
  })
  expect(owner).toMatchObject({ success: true, data: { allowed: true, reason: "role" } })
})

test("custom roles and fine-grained policy rules support resource scoping and deny precedence", () => {
  const actor = authorizationUserActorContextCreate("instance-a", "user-a")
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
    instanceId: "instance-a",
    permission: "project.read",
    resourceId: "project-a",
    roles: ["project_reader"],
  })
  expect(resourceRead).toMatchObject({ success: true, data: { allowed: true, reason: "role" } })

  const denied = authorizationPolicyEvaluate({
    actor,
    customRoles: [role],
    instanceId: "instance-a",
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
    instanceId: "instance-a",
    permission: "project.read",
    roles: ["project_blocked"],
  })
  expect(deniedByRole).toMatchObject({ success: true, data: { allowed: false, reason: "policy" } })

  const otherResource = authorizationPolicyEvaluate({
    actor,
    instanceId: "instance-a",
    permission: "project.read",
    policies: [{ effect: "allow", permission: "project.read", resourceId: "project-a" }],
    resourceId: "project-b",
  })
  expect(otherResource).toMatchObject({ success: true, data: { allowed: false, reason: "resource_mismatch" } })
})

test("actor scope isolation rejects forged tenant and organization contexts", () => {
  const actor = authorizationUserActorContextCreate("instance-a", "user-a", "organization-a")
  expect(
    authorizationEnforce({
      actor,
      instanceId: "instance-b",
      organizationId: "organization-a",
      permission: "organization.read",
      roles: ["owner"],
    }),
  ).toEqual({
    errorMessage: "The actor is not available in this tenant context.",
    op: "authorizationEnforce",
    success: false,
  })
  expect(
    authorizationPolicyEvaluate({
      actor,
      instanceId: "instance-a",
      organizationId: "organization-b",
      permission: "organization.read",
      roles: ["owner"],
    }),
  ).toMatchObject({ success: true, data: { allowed: false, reason: "organization_mismatch" } })
  expect(
    authorizationPolicyEvaluate({
      actor: authorizationUserActorContextCreate("instance-a", "user-a"),
      instanceId: "instance-a",
      permission: "organization.read",
      roles: ["owner"],
    }),
  ).toMatchObject({ success: true, data: { allowed: true } })
})

test("anonymous, system, and bootstrap actors have explicit boundary behavior", () => {
  expect(
    authorizationPolicyEvaluate({
      actor: instanceTenantContextCreate("instance-a", "anonymous").actor,
      instanceId: "instance-a",
      permission: "instance.read",
    }),
  ).toMatchObject({ success: true, data: { allowed: false, reason: "anonymous" } })
  expect(
    authorizationPolicyEvaluate({
      actor: authorizationSystemActorContextCreate(),
      instanceId: "instance-b",
      organizationId: "organization-b",
      permission: "anything.read",
    }),
  ).toMatchObject({ success: true, data: { allowed: true, reason: "system" } })
  expect(
    authorizationPolicyEvaluate({
      actor: authorizationBootstrapAdminActorContextCreate("instance-a", "admin-a"),
      instanceId: "instance-a",
      organizationId: "organization-a",
      permission: "anything.write",
    }),
  ).toMatchObject({ success: true, data: { allowed: true, reason: "bootstrap_admin" } })
})

test("organization enforcement uses database membership and keeps bootstrap administration tenant scoped", async () => {
  await withDatabase(async (database) => {
    const system = instanceSystemContextCreate()
    const alpha = instanceCreate({
      context: system,
      database,
      input: { domain: "auth-alpha.example.com", name: "Alpha" },
    })
    const beta = instanceCreate({
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
      instanceId: alpha.data.instance.id,
    })
    const betaOrganization = organizationCreate({
      context: system,
      database,
      input: { name: "Beta", ownerUserId: "user-b" },
      instanceId: beta.data.instance.id,
    })
    expect(alphaOrganization.success && betaOrganization.success).toBe(true)
    if (!alphaOrganization.success || !betaOrganization.success) return

    expect(
      organizationGet({
        context: instanceTenantContextCreate(alpha.data.instance.id, "user-a"),
        database,
        instanceId: alpha.data.instance.id,
        organizationId: alphaOrganization.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationGet({
        context: instanceTenantContextCreate(alpha.data.instance.id, "user-a"),
        database,
        instanceId: beta.data.instance.id,
        organizationId: betaOrganization.data.organization.id,
      }).success,
    ).toBe(false)

    const bootstrap = instanceBootstrapAdminCreate({
      context: system,
      database,
      instanceId: alpha.data.instance.id,
    })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const authenticated = instanceBootstrapAdminAuthenticate({
      context: instanceTenantContextCreate(alpha.data.instance.id, "anonymous"),
      database,
      secret: bootstrap.data.bootstrapAdmin.secret.valueGet(),
    })
    expect(authenticated.success).toBe(true)
    if (!authenticated.success) return
    expect(
      organizationGet({
        context: authenticated.data,
        database,
        instanceId: alpha.data.instance.id,
        organizationId: alphaOrganization.data.organization.id,
      }).success,
    ).toBe(true)
    expect(
      organizationMembershipCreate({
        context: authenticated.data,
        database,
        input: { roles: ["member"], userId: "user-c" },
        instanceId: beta.data.instance.id,
        organizationId: betaOrganization.data.organization.id,
      }).success,
    ).toBe(false)
  })
})
