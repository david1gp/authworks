import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import { impersonationServerAppCreate } from "../../src/features/impersonation/server/impersonationServerAppCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-impersonation-browser-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

function activeUserCreate(database: StorageDatabase, realmId: string, userName: string) {
  const created = userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const activated = userLifecycleSet({
    context: realmSystemContextCreate("system"),
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(activated.success).toBe(true)
  if (!activated.success) throw new Error(activated.errorMessage)
  return activated.data.user
}

function sessionTokenGet(cookie: string | null): string | undefined {
  return cookie === null ? undefined : /^session=([^;]+)/.exec(cookie)?.[1]
}

test("browser impersonation issues opaque cookies, enforces CSRF, and clears the ended session", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "impersonation-browser.example.com", name: "Impersonation browser" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const admin = activeUserCreate(database, realm.data.realm.id, "browser-admin")
    const target = activeUserCreate(database, realm.data.realm.id, "browser-target")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Support", ownerUserId: admin.id },
      realmId: realm.data.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const targetMembership = organizationMembershipCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { roles: ["member"], userId: target.id },
      organizationId: organization.data.organization.id,
      realmId: realm.data.realm.id,
    })
    expect(targetMembership.success).toBe(true)
    if (!targetMembership.success) return
    const adminSession = sessionIssue({
      assurance: "multi_factor",
      authenticationMethod: "totp",
      database,
      realmId: realm.data.realm.id,
      userId: admin.id,
    })
    expect(adminSession.success).toBe(true)
    if (!adminSession.success) return

    const app = new Hono()
    app.route(
      "/",
      impersonationServerAppCreate({
        database,
        publicOrigin: "https://impersonation-browser.example.com",
      }),
    )
    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const baseHeaders = {
      cookie: `session=${adminSession.data.token}; csrf=${csrf}`,
      host: "impersonation-browser.example.com",
      origin: "https://impersonation-browser.example.com",
    }
    const invalid = await app.request(
      `https://impersonation-browser.example.com/realms/${realm.data.realm.id}/impersonations`,
      {
        body: JSON.stringify({
          durationSeconds: 901,
          organizationId: organization.data.organization.id,
          reason: "x",
          targetUserId: target.id,
        }),
        headers: { ...baseHeaders, "content-type": "application/json", "x-csrf-token": csrf },
        method: "POST",
      },
    )
    expect(invalid.status).toBe(400)
    const denied = await app.request(
      `https://impersonation-browser.example.com/realms/${realm.data.realm.id}/impersonations`,
      {
        body: JSON.stringify({
          durationSeconds: 60,
          organizationId: organization.data.organization.id,
          reason: "Support ticket",
          targetUserId: target.id,
        }),
        headers: { ...baseHeaders, "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(denied.status).toBe(403)

    const started = await app.request(
      `https://impersonation-browser.example.com/realms/${realm.data.realm.id}/impersonations`,
      {
        body: JSON.stringify({
          durationSeconds: 60,
          organizationId: organization.data.organization.id,
          reason: "  Support ticket  ",
          targetUserId: target.id,
        }),
        headers: { ...baseHeaders, "content-type": "application/json", "x-csrf-token": csrf },
        method: "POST",
      },
    )
    expect(started.status).toBe(201)
    const startedBody = (await started.json()) as {
      session?: { expiresAt: number; impersonated?: boolean; impersonatorId?: string; impersonationReason?: string }
      token?: string
    }
    const impersonationToken = sessionTokenGet(started.headers.get("set-cookie"))
    expect(startedBody.token).toBeUndefined()
    expect(startedBody.session).toMatchObject({
      expiresAt: testkit.runtime.now() + 60_000,
      impersonated: true,
      impersonatorId: admin.id,
      impersonationReason: "Support ticket",
    })
    expect(impersonationToken).toHaveLength(43)
    expect(impersonationToken).not.toBe(adminSession.data.token)
    expect(JSON.stringify(startedBody)).not.toContain(impersonationToken ?? "")
    if (impersonationToken === undefined || startedBody.session === undefined) return
    const authenticated = sessionAuthenticate({ database, realmId: realm.data.realm.id, token: impersonationToken })
    expect(authenticated).toMatchObject({
      data: { actor: { actorId: target.id, impersonatorId: admin.id } },
      success: true,
    })
    if (!authenticated.success) return

    const ended = await app.request(
      `https://impersonation-browser.example.com/realms/${realm.data.realm.id}/impersonations/${authenticated.data.session.id}/end`,
      {
        headers: {
          ...baseHeaders,
          cookie: `session=${impersonationToken}; csrf=${csrf}`,
          "x-csrf-token": csrf,
        },
        method: "POST",
      },
    )
    expect(ended.status).toBe(200)
    expect(await ended.json()).toMatchObject({ ended: true })
    expect(ended.headers.get("set-cookie")).toContain("Max-Age=0")
    expect(sessionAuthenticate({ database, realmId: realm.data.realm.id, token: impersonationToken }).success).toBe(
      false,
    )
    expect(
      database.db
        .select()
        .from(storageEventTable)
        .all()
        .filter((event) => event.aggregateType === "impersonation")
        .map((event) => event.eventType),
    ).toEqual(["impersonation.started", "impersonation.ended"])
  })
})
