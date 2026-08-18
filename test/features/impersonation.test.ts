import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { authorizationActorContextCreate } from "../../src/features/authorization/domain/authorizationActorContextCreate.js"
import { authorizationPolicyEvaluate } from "../../src/features/authorization/actions/authorizationPolicyEvaluate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { impersonationApiClientCreate } from "../../src/features/impersonation/client/impersonationApiClientCreate.js"
import { impersonationEnd } from "../../src/features/impersonation/actions/impersonationEnd.js"
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

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

function createActiveUser(database: StorageDatabase, realmId: string, userName: string) {
  const created = userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const active = userLifecycleSet({
    context: realmSystemContextCreate("system"),
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(active.success).toBe(true)
  if (!active.success) throw new Error(active.errorMessage)
  return active.data.user
}

test("impersonation enforces MFA, organization membership, short lifetime, and a narrow permission", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "impersonation.example.com")
    const otherRealm = await createRealm(database, "impersonation-other.example.com")
    const admin = createActiveUser(database, realm.id, "admin")
    const target = createActiveUser(database, realm.id, "target")
    const other = createActiveUser(database, realm.id, "other")
    const otherTenantTarget = createActiveUser(database, otherRealm.id, "other-tenant-target")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Operations", ownerUserId: admin.id },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const membership = organizationMembershipCreate({
      context: realmTenantContextCreate(realm.id, admin.id),
      database,
      input: { roles: ["admin"], userId: target.id },
      realmId: realm.id,
      organizationId: organization.data.organization.id,
    })
    expect(membership.success).toBe(true)

    const actor = authorizationActorContextCreate({
      actorId: admin.id,
      assurance: "multi_factor",
      authenticationMethod: "trusted",
      realmId: realm.id,
      kind: "user",
    })
    const deniedAssurance = impersonationStart({
      actor: { ...actor, assurance: "authenticated" },
      database,
      durationMs: 1_000,
      realmId: realm.id,
      organizationId: organization.data.organization.id,
      reason: "Support case",
      targetUserId: target.id,
    })
    expect(deniedAssurance.success).toBe(false)
    const deniedTarget = impersonationStart({
      actor,
      database,
      durationMs: 1_000,
      realmId: realm.id,
      organizationId: organization.data.organization.id,
      reason: "Support case",
      targetUserId: other.id,
    })
    expect(deniedTarget.success).toBe(false)
    const deniedTenant = impersonationStart({
      actor,
      database,
      durationMs: 1_000,
      realmId: realm.id,
      reason: "Support case",
      targetUserId: other.id,
    })
    expect(deniedTenant.success).toBe(false)
    const deniedCrossTenant = impersonationStart({
      actor,
      database,
      durationMs: 1_000,
      realmId: realm.id,
      organizationId: organization.data.organization.id,
      reason: "Cross tenant test",
      targetUserId: otherTenantTarget.id,
    })
    expect(deniedCrossTenant.success).toBe(false)

    const started = impersonationStart({
      actor,
      database,
      durationMs: 5_000,
      realmId: realm.id,
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
    const authenticated = sessionAuthenticate({ database, realmId: realm.id, token: started.data.token })
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
      realmId: realm.id,
      organizationId: organization.data.organization.id,
      reason: "Chain attempt",
      targetUserId: admin.id,
    })
    expect(chained.success).toBe(false)
    const deniedPrivilege = authorizationPolicyEvaluate({
      actor: authenticated.data.actor,
      realmId: realm.id,
      organizationId: organization.data.organization.id,
      permission: "user.impersonate",
      roles: ["admin"],
    })
    expect(deniedPrivilege).toMatchObject({ data: { allowed: false, reason: "impersonation_limit" }, success: true })
    testkit.advance(5_001)
    expect(sessionAuthenticate({ database, realmId: realm.id, token: started.data.token }).success).toBe(false)
  })
})

test("impersonation HTTP start/end exposes actor and subject, not credentials, and emits immutable audit events", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "impersonation-http.example.com")
    const admin = createActiveUser(database, realm.id, "http-admin")
    const target = createActiveUser(database, realm.id, "http-target")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Support", ownerUserId: admin.id },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    organizationMembershipCreate({
      context: realmTenantContextCreate(realm.id, admin.id),
      database,
      input: { roles: ["admin"], userId: target.id },
      realmId: realm.id,
      organizationId: organization.data.organization.id,
    })
    const adminSession = sessionIssue({
      assurance: "multi_factor",
      authenticationMethod: "totp",
      database,
      realmId: realm.id,
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
    const started = await client.impersonationStart(realm.id, {
      durationSeconds: 30,
      organizationId: organization.data.organization.id,
      reason: "Customer support",
      targetUserId: target.id,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    expect(started.data.token).toHaveLength(43)
    const protectedResponse = await app.request(`http://server.test/realms/${realm.id}/protected`, {
      headers: { authorization: `Bearer ${started.data.token}` },
    })
    expect(protectedResponse.status).toBe(200)
    expect(await protectedResponse.json()).toMatchObject({
      actor: { actorId: target.id, impersonatorId: admin.id },
      session: { impersonated: true, impersonatorId: admin.id, userId: target.id },
    })
    const ended = await client.impersonationEnd(realm.id, started.data.session.id)
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
    const realm = await createRealm(database, "impersonation-atomic.example.com")
    const admin = createActiveUser(database, realm.id, "atomic-admin")
    const target = createActiveUser(database, realm.id, "atomic-target")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Atomic", ownerUserId: admin.id },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    organizationMembershipCreate({
      context: realmTenantContextCreate(realm.id, admin.id),
      database,
      input: { roles: ["admin"], userId: target.id },
      realmId: realm.id,
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
        realmId: realm.id,
        kind: "user",
      }),
      database,
      durationMs: 1_000,
      realmId: realm.id,
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

test("impersonation authorization is explicit and marked sessions cannot widen their permissions", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "impersonation-permissions.example.com")
    const admin = createActiveUser(database, realm.id, "permission-admin")
    const target = createActiveUser(database, realm.id, "permission-target")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Permissions", ownerUserId: target.id },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    expect(
      organizationMembershipCreate({
        context: realmSystemContextCreate("system"),
        database,
        input: { roles: ["member"], userId: admin.id },
        realmId: realm.id,
        organizationId: organization.data.organization.id,
      }).success,
    ).toBe(true)
    const actor = authorizationActorContextCreate({
      actorId: admin.id,
      assurance: "multi_factor",
      authenticationMethod: "trusted",
      realmId: realm.id,
      kind: "user",
      scopes: ["user.read"],
    })

    const unrelatedPermission = impersonationStart({
      actor,
      database,
      durationMs: 1_000,
      realmId: realm.id,
      organizationId: organization.data.organization.id,
      reason: "Permission test",
      targetUserId: target.id,
    })
    expect(unrelatedPermission.success).toBe(false)

    const allowedActor = { ...actor, scopes: ["user.impersonate"] }
    const started = impersonationStart({
      actor: allowedActor,
      database,
      durationMs: 15 * 60 * 1_000,
      realmId: realm.id,
      organizationId: organization.data.organization.id,
      reason: "Permission test",
      runtime: testkit.runtime,
      targetUserId: target.id,
    })
    if (!started.success) throw new Error(started.errorMessage)
    expect(started.success).toBe(true)

    const authenticated = sessionAuthenticate({ database, realmId: realm.id, token: started.data.token })
    expect(authenticated.success).toBe(true)
    if (!authenticated.success) return
    expect(
      authorizationPolicyEvaluate({
        actor: authenticated.data.actor,
        realmId: realm.id,
        organizationId: organization.data.organization.id,
        permission: "organization.manage",
        roles: ["owner"],
      }),
    ).toMatchObject({ data: { allowed: false, reason: "impersonation_limit" }, success: true })
    expect(
      authorizationPolicyEvaluate({
        actor: authenticated.data.actor,
        realmId: realm.id,
        organizationId: organization.data.organization.id,
        permission: "user.impersonate",
        roles: ["owner"],
      }),
    ).toMatchObject({ data: { allowed: false, reason: "impersonation_limit" }, success: true })

    expect(
      authorizationPolicyEvaluate({
        actor: { ...authenticated.data.actor, impersonationSessionId: undefined },
        realmId: realm.id,
        organizationId: organization.data.organization.id,
        permission: "organization.manage",
        roles: ["owner"],
      }).success,
    ).toBe(false)

    const overLimit = impersonationStart({
      actor: allowedActor,
      database,
      durationMs: 15 * 60 * 1_000 + 1,
      realmId: realm.id,
      organizationId: organization.data.organization.id,
      reason: "Permission test",
      targetUserId: target.id,
    })
    expect(overLimit.success).toBe(false)
  })
})

test("impersonation end is isolated by tenant and subject authorization", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "impersonation-end.example.com")
    const otherRealm = await createRealm(database, "impersonation-end-other.example.com")
    const admin = createActiveUser(database, realm.id, "end-admin")
    const target = createActiveUser(database, realm.id, "end-target")
    const otherSubject = createActiveUser(database, otherRealm.id, "end-other-subject")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "End", ownerUserId: admin.id },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    expect(
      organizationMembershipCreate({
        context: realmTenantContextCreate(realm.id, admin.id),
        database,
        input: { roles: ["member"], userId: target.id },
        realmId: realm.id,
        organizationId: organization.data.organization.id,
      }).success,
    ).toBe(true)
    const actor = authorizationActorContextCreate({
      actorId: admin.id,
      assurance: "multi_factor",
      authenticationMethod: "trusted",
      realmId: realm.id,
      kind: "user",
      scopes: ["user.impersonate"],
    })
    const started = impersonationStart({
      actor,
      database,
      durationMs: 5_000,
      realmId: realm.id,
      organizationId: organization.data.organization.id,
      reason: "Tenant end test",
      runtime: testkit.runtime,
      targetUserId: target.id,
    })
    expect(started.success).toBe(true)
    if (!started.success) return

    expect(
      impersonationEnd({
        actor,
        database,
        realmId: otherRealm.id,
        runtime: testkit.runtime,
        sessionId: started.data.session.id,
      }).success,
    ).toBe(false)
    expect(
      impersonationEnd({
        actor: authorizationActorContextCreate({
          actorId: otherSubject.id,
          assurance: "authenticated",
          authenticationMethod: "trusted",
          realmId: otherRealm.id,
          kind: "user",
        }),
        database,
        realmId: realm.id,
        runtime: testkit.runtime,
        sessionId: started.data.session.id,
      }).success,
    ).toBe(false)
    expect(sessionAuthenticate({ database, realmId: realm.id, token: started.data.token }).success).toBe(true)
  })
})

test("impersonation audit events distinguish the ending subject and commit atomically", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "impersonation-audit.example.com")
    const admin = createActiveUser(database, realm.id, "audit-admin")
    const target = createActiveUser(database, realm.id, "audit-target")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Audit", ownerUserId: admin.id },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    expect(
      organizationMembershipCreate({
        context: realmTenantContextCreate(realm.id, admin.id),
        database,
        input: { roles: ["member"], userId: target.id },
        realmId: realm.id,
        organizationId: organization.data.organization.id,
      }).success,
    ).toBe(true)
    const actor = authorizationActorContextCreate({
      actorId: admin.id,
      assurance: "multi_factor",
      authenticationMethod: "trusted",
      realmId: realm.id,
      kind: "user",
      scopes: ["user.impersonate"],
    })
    const notifications: unknown[] = []
    const started = impersonationStart({
      actor,
      database,
      durationMs: 5_000,
      realmId: realm.id,
      organizationId: organization.data.organization.id,
      onSecurityNotification: (notification) => {
        notifications.push(notification)
      },
      reason: "  Audit reason  ",
      runtime: testkit.runtime,
      targetUserId: target.id,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    const startedEvent = database.db
      .select()
      .from(storageEventTable)
      .all()
      .find((event) => event.aggregateType === "impersonation" && event.eventType === "impersonation.started")
    expect(startedEvent?.payload).toMatchObject({
      actorId: admin.id,
      expiresAt: started.data.session.expiresAt,
      realmId: realm.id,
      reason: "Audit reason",
      sessionId: started.data.session.id,
      subjectId: target.id,
    })
    expect(notifications).toHaveLength(1)

    const authenticated = sessionAuthenticate({ database, realmId: realm.id, token: started.data.token })
    expect(authenticated.success).toBe(true)
    if (!authenticated.success) return
    database.sqlite.run(
      "CREATE TRIGGER reject_impersonation_end BEFORE INSERT ON events WHEN NEW.event_type = 'impersonation.ended' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const failedEnd = impersonationEnd({
      actor: authenticated.data.actor,
      database,
      realmId: realm.id,
      onSecurityNotification: (notification) => {
        notifications.push(notification)
      },
      runtime: testkit.runtime,
      sessionId: started.data.session.id,
    })
    expect(failedEnd.success).toBe(false)
    expect(sessionAuthenticate({ database, realmId: realm.id, token: started.data.token }).success).toBe(true)
    expect(notifications).toHaveLength(1)
    database.sqlite.run("DROP TRIGGER reject_impersonation_end")

    const ended = impersonationEnd({
      actor: authenticated.data.actor,
      database,
      realmId: realm.id,
      onSecurityNotification: (notification) => {
        notifications.push(notification)
      },
      runtime: testkit.runtime,
      sessionId: started.data.session.id,
    })
    expect(ended).toEqual({ data: { ended: true, sessionId: started.data.session.id }, success: true })
    const impersonationEvents = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateType === "impersonation")
    expect(impersonationEvents).toHaveLength(2)
    expect(impersonationEvents[1]?.payload).toMatchObject({
      actorId: admin.id,
      endedById: target.id,
      realmId: realm.id,
      sessionId: started.data.session.id,
      subjectId: target.id,
    })
    expect(notifications).toHaveLength(2)

    const repeatedEnd = impersonationEnd({
      actor: authenticated.data.actor,
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
      sessionId: started.data.session.id,
    })
    expect(repeatedEnd).toEqual({ data: { ended: false, sessionId: started.data.session.id }, success: true })
    expect(
      database.db
        .select()
        .from(storageEventTable)
        .all()
        .filter((event) => event.aggregateType === "impersonation"),
    ).toHaveLength(2)
  })
})
