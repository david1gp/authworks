import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { eventServerAppCreate } from "../../events/server/eventServerAppCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { organizationCreate } from "./organizationCreate.js"
import { organizationInvitationCreate } from "./organizationInvitationCreate.js"
import { organizationMembershipCreate } from "./organizationMembershipCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-organization-tenant-isolation-"))
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

function activeUserCreate(database: StorageDatabase, realmId: string, userName: string): string {
  const system = realmSystemContextCreate("system")
  const created = userCreate({
    context: system,
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
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
  if (!active.success) throw new Error(active.errorMessage)
  return created.data.user.id
}

async function organizationSeed(database: StorageDatabase, realmId: string, name: string, ownerUserId: string) {
  const organization = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name, ownerUserId },
    realmId,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  return organization.data.organization
}

test("activity route scopes and redacts before paging and requires organization administration", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = realmCreate({ context: system, database, input: { domain: "feed.example.com", name: "feed" } })
    const otherRealm = realmCreate({
      context: system,
      database,
      input: { domain: "feed-other.example.com", name: "other" },
    })
    if (!realm.success || !otherRealm.success) throw new Error("realm setup")
    const realmId = realm.data.realm.id
    const owner = activeUserCreate(database, realmId, "feed-owner")
    const admin = activeUserCreate(database, realmId, "feed-admin")
    const member = activeUserCreate(database, realmId, "feed-member")
    const guest = activeUserCreate(database, realmId, "feed-guest")
    const otherOwner = activeUserCreate(database, realmId, "feed-other-owner")
    const org = await organizationSeed(database, realmId, "Feed", owner)
    const other = await organizationSeed(database, realmId, "Other", otherOwner)
    for (const [userId, role] of [
      [admin, "admin"],
      [member, "member"],
      [guest, "guest"],
    ] as const) {
      expect(
        organizationMembershipCreate({
          context: realmTenantContextCreate(realmId, owner),
          database,
          input: { roles: [role], userId },
          organizationId: org.id,
          realmId,
        }).success,
      ).toBe(true)
    }
    expect(
      organizationInvitationCreate({
        context: realmTenantContextCreate(realmId, owner),
        database,
        input: { email: "invite@example.com", roles: ["member"] },
        organizationId: org.id,
        realmId,
      }).success,
    ).toBe(true)
    const insert = database.sqlite.prepare(
      `insert into events (id, command_index, realm_id, aggregate_type, aggregate_id, aggregate_version, correlation_id, occurred_at, event_type, payload, metadata) values (?,0,?,?,?,1,'correlation',1,?,?,?)`,
    )
    insert.run(
      "sensitive",
      realmId,
      "organization",
      org.id,
      "organization.updated",
      JSON.stringify({ password: "hidden", visible: "ok" }),
      JSON.stringify({ token: "hidden" }),
    )
    insert.run("unrelated", realmId, "organization", org.id, "unrelated.event", "{}", "{}")
    insert.run("foreign", otherRealm.data.realm.id, "organization", org.id, "organization.updated", "{}", "{}")
    const projectInsert = database.sqlite.prepare(
      `insert into projects (id, realm_id, organization_id, name, authorization_required, project_access_required, status, created_at, updated_at, version) values (?, ?, ?, ?, 0, 0, 'active', 1, 1, 1)`,
    )
    projectInsert.run("owned-project", realmId, org.id, "Owned")
    projectInsert.run("foreign-project", realmId, other.id, "Foreign")
    const projectPayload = JSON.stringify({
      name: "Project",
      organizationId: org.id,
      authorizationRequired: false,
      projectAccessRequired: false,
    })
    insert.run("project-owned", realmId, "project", "owned-project", "project.created", projectPayload, "{}")
    insert.run("project-forged", realmId, "project", "foreign-project", "project.created", projectPayload, "{}")
    insert.run("project-deleted", realmId, "project", "deleted-project", "project.created", projectPayload, "{}")
    for (let index = 0; index < 35; index++) {
      insert.run(
        `bulk-${String(index).padStart(2, "0")}`,
        realmId,
        "organization",
        org.id,
        "organization.updated",
        "{}",
        "{}",
      )
    }
    const app = eventServerAppCreate({ database })
    const token = (userId: string) => {
      const session = sessionIssue({
        assurance: "authenticated",
        authenticationMethod: "password",
        database,
        realmId,
        userId,
      })
      if (!session.success) throw new Error(session.errorMessage)
      return session.data.token
    }
    const path = `/realms/${realmId}/organizations/${org.id}/activity`
    for (const userId of [member, guest]) {
      expect((await app.request(path, { headers: { authorization: `Bearer ${token(userId)}` } })).status).toBe(403)
    }
    const adminResponse = await app.request(path, { headers: { authorization: `Bearer ${token(admin)}` } })
    expect(adminResponse.status).toBe(200)
    const ownerToken = token(owner)
    const items: Array<{ id: string; eventType: string; aggregateId: string; payload: unknown; metadata: unknown }> = []
    let pageToken: string | undefined
    do {
      const query = new URLSearchParams({ pageSize: "1", sortBy: "id", sortDirection: "asc" })
      if (pageToken) query.set("pageToken", pageToken)
      const response = await app.request(`${path}?${query}`, { headers: { cookie: `session=${ownerToken}` } })
      expect(response.status).toBe(200)
      const page = (await response.json()) as { items: typeof items; nextPageToken?: string }
      expect(page.items.length).toBeLessThanOrEqual(1)
      items.push(...page.items)
      pageToken = page.nextPageToken
    } while (pageToken)
    expect(items.some((item) => item.eventType === "organization.invitation_created")).toBe(true)
    expect(items.some((item) => item.eventType === "organization.membership_added")).toBe(true)
    expect(items.some((item) => item.aggregateId === other.id)).toBe(false)
    expect(items.some((item) => item.id === "foreign" || item.id === "unrelated")).toBe(false)
    expect(items.some((item) => item.id === "project-owned")).toBe(true)
    expect(items.some((item) => item.id === "project-forged" || item.id === "project-deleted")).toBe(false)
    for (const direction of ["asc", "desc"]) {
      const seen: string[] = []
      let cursor: string | undefined
      do {
        const query = new URLSearchParams({
          pageSize: "7",
          sortBy: "occurredAt",
          sortDirection: direction,
          eventType: "organization.updated",
          occurredFrom: "1",
          occurredTo: "1",
        })
        if (cursor) query.set("pageToken", cursor)
        const response = await app.request(`${path}?${query}`, { headers: { cookie: `session=${ownerToken}` } })
        expect(response.status).toBe(200)
        const page = (await response.json()) as { items: typeof items; nextPageToken?: string }
        seen.push(...page.items.map((item) => item.id))
        cursor = page.nextPageToken
      } while (cursor)
      expect(seen).toHaveLength(36)
      expect(new Set(seen).size).toBe(36)
      const expected = [...seen].sort()
      expect(seen).toEqual(direction === "asc" ? expected : expected.reverse())
    }
    const sensitive = items.find((item) => item.id === "sensitive")
    expect(sensitive?.payload).toEqual({ password: "[REDACTED]", visible: "ok" })
    expect(sensitive?.metadata).toEqual({ token: "[REDACTED]" })
    expect(
      (
        await app.request(`/realms/${otherRealm.data.realm.id}/organizations/${org.id}/activity`, {
          headers: { authorization: `Bearer ${ownerToken}` },
        })
      ).status,
    ).toBe(401)
  })
})
