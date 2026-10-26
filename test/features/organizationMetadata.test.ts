import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { machineApiKeyCreate } from "../../src/features/machineUsers/actions/machineApiKeyCreate.js"
import { machineUserCreate } from "../../src/features/machineUsers/actions/machineUserCreate.js"
import { mcpHttpHandlerCreate } from "../../src/features/mcp/mcpHttpHandler.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { organizationMetadataGet } from "../../src/features/organizations/actions/organizationMetadataGet.js"
import { organizationMetadataList } from "../../src/features/organizations/actions/organizationMetadataList.js"
import { organizationMetadataRemove } from "../../src/features/organizations/actions/organizationMetadataRemove.js"
import { organizationMetadataSet } from "../../src/features/organizations/actions/organizationMetadataSet.js"
import { realmAdministratorGrant } from "../../src/features/realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-organization-metadata-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
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

async function createOrganization(database: StorageDatabase, realmId: string, name: string, ownerUserId: string) {
  const created = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name, ownerUserId },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.organization
}

async function createActiveUser(database: StorageDatabase, realmId: string, email: string) {
  const system = realmSystemContextCreate("system")
  const created = userCreate({
    context: system,
    database,
    input: { email, profile: { displayName: email }, userName: email.split("@")[0] ?? email },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const active = userLifecycleSet({
    context: system,
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(active.success).toBe(true)
  return created.data.user
}

test("organization metadata set/get/list/remove round-trips", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "org-meta.example.com")
    const organization = await createOrganization(database, realm.id, "Metadata Org", "owner-1")
    const system = realmSystemContextCreate("system")

    const first = organizationMetadataSet({
      context: system,
      database,
      input: { value: "one" },
      key: "team.color",
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.data.metadata).toMatchObject({ key: "team.color", value: "one", version: 1 })

    const second = organizationMetadataSet({
      context: system,
      database,
      input: { value: "two" },
      key: "team:size",
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(second.success).toBe(true)

    const fetched = organizationMetadataGet({
      context: system,
      database,
      key: "team.color",
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(fetched).toMatchObject({ success: true, data: { metadata: { key: "team.color", value: "one" } } })

    const listed = organizationMetadataList({
      context: system,
      database,
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items.map((entry) => entry.key).sort()).toEqual(["team.color", "team:size"])

    const prefixed = organizationMetadataList({
      context: system,
      database,
      organizationId: organization.id,
      query: { keyPrefix: "team." },
      realmId: realm.id,
    })
    expect(prefixed).toMatchObject({ success: true, data: { items: [{ key: "team.color" }] } })

    const removed = organizationMetadataRemove({
      context: system,
      database,
      key: "team.color",
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(removed).toMatchObject({ success: true, data: { removed: true } })
    expect(
      organizationMetadataGet({
        context: system,
        database,
        key: "team.color",
        organizationId: organization.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "organizations.not-found", success: false })
  })
})

test("organization metadata rejects the 51st new key but allows updates", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "org-meta-cap.example.com")
    const organization = await createOrganization(database, realm.id, "Cap Org", "owner-1")
    const system = realmSystemContextCreate("system")

    for (let index = 0; index < 50; index += 1) {
      const saved = organizationMetadataSet({
        context: system,
        database,
        input: { value: `value-${index}` },
        key: `key-${index}`,
        organizationId: organization.id,
        realmId: realm.id,
      })
      expect(saved.success).toBe(true)
    }
    expect(
      organizationMetadataSet({
        context: system,
        database,
        input: { value: "overflow" },
        key: "key-overflow",
        organizationId: organization.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "organizations.metadata-limit", success: false })
    const updated = organizationMetadataSet({
      context: system,
      database,
      input: { value: "updated" },
      key: "key-0",
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(updated).toMatchObject({ success: true, data: { metadata: { value: "updated", version: 2 } } })
  })
})

test("organization metadata validates keys and values", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "org-meta-valid.example.com")
    const organization = await createOrganization(database, realm.id, "Valid Org", "owner-1")
    const system = realmSystemContextCreate("system")

    for (const key of ["", "has space", "has/slash", `k${"a".repeat(128)}`]) {
      expect(
        organizationMetadataSet({
          context: system,
          database,
          input: { value: "value" },
          key,
          organizationId: organization.id,
          realmId: realm.id,
        }),
      ).toMatchObject({ code: "organizations.invalid", success: false })
    }
    expect(
      organizationMetadataSet({
        context: system,
        database,
        input: { value: "x".repeat(4097) },
        key: "valid.key",
        organizationId: organization.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "organizations.invalid", success: false })
    expect(
      organizationMetadataGet({
        context: system,
        database,
        key: "has space",
        organizationId: organization.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "organizations.invalid", success: false })
    expect(
      organizationMetadataRemove({
        context: system,
        database,
        key: "has space",
        organizationId: organization.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "organizations.invalid", success: false })
  })
})

test("organization metadata stays inside one organization and realm", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "org-meta-a.example.com")
    const beta = await createRealm(database, "org-meta-b.example.com")
    const orgA = await createOrganization(database, alpha.id, "Org A", "owner-a")
    const orgB = await createOrganization(database, beta.id, "Org B", "owner-b")
    const system = realmSystemContextCreate("system")
    const saved = organizationMetadataSet({
      context: system,
      database,
      input: { value: "secret-a" },
      key: "private",
      organizationId: orgA.id,
      realmId: alpha.id,
    })
    expect(saved.success).toBe(true)

    const memberB = await createActiveUser(database, beta.id, "member-b@example.com")
    const memberInB = organizationMembershipCreate({
      context: system,
      database,
      input: { roles: ["admin"], userId: memberB.id },
      organizationId: orgB.id,
      realmId: beta.id,
    })
    expect(memberInB.success).toBe(true)
    expect(
      organizationMetadataGet({
        context: realmTenantContextCreate(beta.id, memberB.id),
        database,
        key: "private",
        organizationId: orgA.id,
        realmId: alpha.id,
      }).success,
    ).toBe(false)

    const adminA = await createActiveUser(database, alpha.id, "admin-a@example.com")
    expect(realmAdministratorGrant({ context: system, database, realmId: alpha.id, userId: adminA.id }).success).toBe(
      true,
    )
    expect(
      organizationMetadataGet({
        context: realmTenantContextCreate(alpha.id, adminA.id),
        database,
        key: "private",
        organizationId: orgA.id,
        realmId: alpha.id,
      }),
    ).toMatchObject({ success: true, data: { metadata: { value: "secret-a" } } })

    expect(
      organizationMetadataGet({
        context: realmTenantContextCreate(beta.id, adminA.id),
        database,
        key: "private",
        organizationId: orgA.id,
        realmId: alpha.id,
      }),
    ).toMatchObject({ code: "organizations.tenant-mismatch", success: false })
  })
})

test("organization metadata events carry keys but never values", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "org-meta-events.example.com")
    const organization = await createOrganization(database, realm.id, "Events Org", "owner-1")
    const system = realmSystemContextCreate("system")
    const saved = organizationMetadataSet({
      context: system,
      database,
      input: { value: "super-secret-value" },
      key: "classified",
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(saved.success).toBe(true)
    const removed = organizationMetadataRemove({
      context: system,
      database,
      key: "classified",
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(removed.success).toBe(true)

    const events = database.db.select().from(storageEventTable).all()
    const setEvent = events.find((event) => event.eventType === "organization.metadata_set")
    const removeEvent = events.find((event) => event.eventType === "organization.metadata_removed")
    expect(setEvent).toBeDefined()
    expect(removeEvent).toBeDefined()
    const setPayload = setEvent?.payload as unknown as Record<string, unknown>
    const removePayload = removeEvent?.payload as unknown as Record<string, unknown>
    expect(setPayload).toEqual({ key: "classified", organizationId: organization.id, version: 1 })
    expect(removePayload).toEqual({ key: "classified", organizationId: organization.id })
    expect(JSON.stringify(events)).not.toContain("super-secret-value")
  })
})

test("organization metadata MCP tools inherit credential scopes", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "org-meta-mcp.example.com")
    const organization = await createOrganization(database, realm.id, "MCP Org", "owner-1")
    const system = realmSystemContextCreate("system")
    const handle = mcpHttpHandlerCreate({ database })

    const scopedUser = machineUserCreate({
      context: system,
      database,
      input: {
        displayName: "Metadata worker",
        scopes: ["organization.read", "organization.manage"],
        userName: "meta-worker",
      },
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(scopedUser.success).toBe(true)
    if (!scopedUser.success) return
    const scopedKey = machineApiKeyCreate({
      context: system,
      database,
      input: {
        machineUserId: scopedUser.data.machineUser.id,
        name: "meta-key",
        scopes: ["organization.read", "organization.manage"],
      },
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(scopedKey.success).toBe(true)
    if (!scopedKey.success) return

    const call = (token: string, name: string, args: unknown) =>
      handle(
        new Request(`https://example.test/mcp?realmId=${realm.id}`, {
          body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/call", params: { arguments: args, name } }),
          headers: {
            accept: "application/json, text/event-stream",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          method: "POST",
        }),
      )
    const setResponse = await call(scopedKey.data.secret, "organization-metadata-set", {
      key: "mcp.key",
      organizationId: organization.id,
      value: "mcp-value",
    })
    expect(setResponse.status).toBe(200)
    expect((await setResponse.json()).result.isError).not.toBe(true)

    const getResponse = await call(scopedKey.data.secret, "organization-metadata-get", {
      key: "mcp.key",
      organizationId: organization.id,
    })
    expect(getResponse.status).toBe(200)
    expect(await getResponse.json()).toMatchObject({
      result: { content: [{ text: expect.stringContaining("mcp-value") }] },
    })

    const unscopedUser = machineUserCreate({
      context: system,
      database,
      input: { displayName: "Scoped out", userName: "meta-denied" },
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(unscopedUser.success).toBe(true)
    if (!unscopedUser.success) return
    const deniedKey = machineApiKeyCreate({
      context: system,
      database,
      input: { machineUserId: unscopedUser.data.machineUser.id, name: "denied-key" },
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(deniedKey.success).toBe(true)
    if (!deniedKey.success) return
    const denied = await call(deniedKey.data.secret, "organization-metadata-set", {
      key: "mcp.key",
      organizationId: organization.id,
      value: "nope",
    })
    expect(denied.status).toBe(200)
    expect((await denied.json()).result.isError).toBe(true)
  })
})
