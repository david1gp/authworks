import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
import { authorizationActorContextCreate } from "../../src/features/authorization/domain/authorizationActorContextCreate.js"
import { authorizationPolicyEvaluate } from "../../src/features/authorization/actions/authorizationPolicyEvaluate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { impersonationApiClientCreate } from "../../src/features/impersonation/client/impersonationApiClientCreate.js"
import { impersonationStart } from "../../src/features/impersonation/actions/impersonationStart.js"
import { impersonationServerAppCreate } from "../../src/features/impersonation/server/impersonationServerAppCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionServerAppCreate } from "../../src/features/sessions/server/sessionServerAppCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-impersonation-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "zitadel.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createInstance(database: StorageDatabase, domain: string) {
  const created = instanceCreate({
    context: instanceSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.instance
}

function createActiveUser(database: StorageDatabase, instanceId: string, userName: string) {
  const created = userCreate({
    context: instanceSystemContextCreate("system"),
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
    instanceId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const active = userLifecycleSet({
    context: instanceSystemContextCreate("system"),
    database,
    input: { state: "active" },
    instanceId,
    userId: created.data.user.id,
  })
  expect(active.success).toBe(true)
  if (!active.success) throw new Error(active.errorMessage)
  return active.data.user
}

test("impersonation enforces MFA, organization membership, short lifetime, and a narrow permission", async () => {
  await withDatabase(async (database, testkit) => {
    const instance = await createInstance(database, "impersonation.example.com")
    const otherInstance = await createInstance(database, "impersonation-other.example.com")
    const admin = createActiveUser(database, instance.id, "admin")
    const target = createActiveUser(database, instance.id, "target")
    const other = createActiveUser(database, instance.id, "other")
    const otherTenantTarget = createActiveUser(database, otherInstance.id, "other-tenant-target")
    const organization = organizationCreate({
      context: instanceSystemContextCreate("system"),
      database,
      input: { name: "Operations", ownerUserId: admin.id },
      instanceId: instance.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const membership = organizationMembershipCreate({
      context: instanceTenantContextCreate(instance.id, admin.id),
      database,
      input: { roles: ["admin"], userId: target.id },
      instanceId: instance.id,
      organizationId: organization.data.organization.id,
    })
    expect(membership.success).toBe(true)

    const actor = authorizationActorContextCreate({
      actorId: admin.id,
      assurance: "multi_factor",
      authenticationMethod: "trusted",
      instanceId: instance.id,
      kind: "user",
    })
    const deniedAssurance = impersonationStart({
      actor: { ...actor, assurance: "authenticated" },
      database,
      durationMs: 1_000,
      instanceId: instance.id,
      organizationId: organization.data.organization.id,
      reason: "Support case",
      targetUserId: target.id,
    })
    expect(deniedAssurance.success).toBe(false)
    const deniedTarget = impersonationStart({
      actor,
      database,
      durationMs: 1_000,
      instanceId: instance.id,
      organizationId: organization.data.organization.id,
      reason: "Support case",
      targetUserId: other.id,
    })
    expect(deniedTarget.success).toBe(false)
    const deniedTenant = impersonationStart({
      actor,
      database,
      durationMs: 1_000,
      instanceId: instance.id,
      reason: "Support case",
      targetUserId: other.id,
    })
    expect(deniedTenant.success).toBe(false)
    const deniedCrossTenant = impersonationStart({
      actor,
      database,
      durationMs: 1_000,
      instanceId: instance.id,
      organizationId: organization.data.organization.id,
      reason: "Cross tenant test",
      targetUserId: otherTenantTarget.id,
    })
    expect(deniedCrossTenant.success).toBe(false)

    const started = impersonationStart({
      actor,
      database,
      durationMs: 5_000,
      instanceId: instance.id,
      organizationId: organization.data.organization.id,
      reason: "Support case 123",
      runtime: testkit.runtime,
      targetUserId: target.id,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    expect(started.data.session).toMatchObject({
      impersonated: true,
      impersonationOrganizationId: organization.data.organization.id,
      impersonationReason: "Support case 123",
      impersonatorId: admin.id,
      userId: target.id,
    })
    const authenticated = sessionAuthenticate({ database, instanceId: instance.id, token: started.data.token })
    expect(authenticated.success).toBe(true)
    if (!authenticated.success) return
    expect(authenticated.data.actor).toMatchObject({
      actorId: target.id,
      impersonationSessionId: started.data.session.id,
      impersonatorId: admin.id,
      organizationId: organization.data.organization.id,
    })
    const chained = impersonationStart({
      actor: authenticated.data.actor,
      database,
      durationMs: 1_000,
      instanceId: instance.id,
      organizationId: organization.data.organization.id,
      reason: "Chain attempt",
      targetUserId: admin.id,
    })
    expect(chained.success).toBe(false)
    const deniedPrivilege = authorizationPolicyEvaluate({
      actor: authenticated.data.actor,
      instanceId: instance.id,
      organizationId: organization.data.organization.id,
      permission: "user.impersonate",
      roles: ["admin"],
    })
    expect(deniedPrivilege).toMatchObject({ data: { allowed: false, reason: "impersonation_limit" }, success: true })
    testkit.advance(5_001)
    expect(sessionAuthenticate({ database, instanceId: instance.id, token: started.data.token }).success).toBe(false)
  })
})

test("impersonation HTTP start/end exposes actor and subject, not credentials, and emits immutable audit events", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "impersonation-http.example.com")
    const admin = createActiveUser(database, instance.id, "http-admin")
    const target = createActiveUser(database, instance.id, "http-target")
    const organization = organizationCreate({
      context: instanceSystemContextCreate("system"),
      database,
      input: { name: "Support", ownerUserId: admin.id },
      instanceId: instance.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    organizationMembershipCreate({
      context: instanceTenantContextCreate(instance.id, admin.id),
      database,
      input: { roles: ["admin"], userId: target.id },
      instanceId: instance.id,
      organizationId: organization.data.organization.id,
    })
    const adminSession = sessionIssue({
      assurance: "multi_factor",
      authenticationMethod: "totp",
      database,
      instanceId: instance.id,
      userId: admin.id,
    })
    expect(adminSession.success).toBe(true)
    if (!adminSession.success) return
    const notifications: unknown[] = []
    const app = new Hono()
    app.route(
      "/",
      impersonationServerAppCreate({
        database,
        onSecurityNotification: (notification) => {
          notifications.push(notification)
        },
      }),
    )
    app.route("/", sessionServerAppCreate({ database }))
    const client = impersonationApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: adminSession.data.token,
    })
    const started = await client.impersonationStart(instance.id, {
      durationSeconds: 30,
      organizationId: organization.data.organization.id,
      reason: "Customer support",
      targetUserId: target.id,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    expect(started.data.token).toHaveLength(43)
    const protectedResponse = await app.request(`http://server.test/instances/${instance.id}/protected`, {
      headers: { authorization: `Bearer ${started.data.token}` },
    })
    expect(protectedResponse.status).toBe(200)
    expect(await protectedResponse.json()).toMatchObject({
      actor: { actorId: target.id, impersonatorId: admin.id },
      session: { impersonated: true, impersonatorId: admin.id, userId: target.id },
    })
    const ended = await client.impersonationEnd(instance.id, started.data.session.id)
    expect(ended).toEqual({ data: { ended: true, sessionId: started.data.session.id }, success: true })
    const events = database.db.select().from(storageEventTable).all()
    const impersonationEvents = events.filter((event) => event.aggregateType === "impersonation")
    expect(impersonationEvents.map((event) => event.eventType)).toEqual([
      "impersonation.started",
      "impersonation.ended",
    ])
    expect(JSON.stringify(impersonationEvents)).not.toContain(adminSession.data.token)
    expect(JSON.stringify(impersonationEvents)).not.toContain(started.data.token)
    expect(notifications).toHaveLength(2)
    const cli = Bun.spawn(["bun", "src/outputs/cli.ts", "impersonate", "--help"], {
      stderr: "pipe",
      stdout: "pipe",
    })
    const cliOutput = await new Response(cli.stdout).text()
    expect(await cli.exited).toBe(0)
    expect(cliOutput).toContain("Manage administrator impersonation")
  })
})

test("impersonation state and audit event roll back together", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "impersonation-atomic.example.com")
    const admin = createActiveUser(database, instance.id, "atomic-admin")
    const target = createActiveUser(database, instance.id, "atomic-target")
    const organization = organizationCreate({
      context: instanceSystemContextCreate("system"),
      database,
      input: { name: "Atomic", ownerUserId: admin.id },
      instanceId: instance.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    organizationMembershipCreate({
      context: instanceTenantContextCreate(instance.id, admin.id),
      database,
      input: { roles: ["admin"], userId: target.id },
      instanceId: instance.id,
      organizationId: organization.data.organization.id,
    })
    database.sqlite.run(
      "CREATE TRIGGER reject_impersonation_events BEFORE INSERT ON events WHEN NEW.aggregate_type = 'impersonation' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const notifications: unknown[] = []
    const before = database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()
    const failed = impersonationStart({
      actor: authorizationActorContextCreate({
        actorId: admin.id,
        assurance: "multi_factor",
        authenticationMethod: "trusted",
        instanceId: instance.id,
        kind: "user",
      }),
      database,
      durationMs: 1_000,
      instanceId: instance.id,
      organizationId: organization.data.organization.id,
      onSecurityNotification: (notification) => {
        notifications.push(notification)
      },
      reason: "Atomic test",
      targetUserId: target.id,
    })
    expect(failed.success).toBe(false)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual(before)
    expect(notifications).toHaveLength(0)
  })
})
