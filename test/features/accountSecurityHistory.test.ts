import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { accountApiClientCreate } from "../../src/features/account/client/accountApiClientCreate.js"
import { accountSecurityHistoryList } from "../../src/features/account/actions/accountSecurityHistoryList.js"
import { accountServerAppCreate } from "../../src/features/account/server/accountServerAppCreate.js"
import { eventSecurityHistoryProjectionCreate } from "../../src/features/events/domain/eventSecurityHistoryProjectionCreate.js"
import { eventSecurityHistoryList } from "../../src/features/events/server/eventSecurityHistoryList.js"
import { eventSecurityEventAppend } from "../../src/features/events/server/eventSecurityEventAppend.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../src/platform/storage/storageTransactionRun.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-account-security-history-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
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
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

function createActiveUser(database: StorageDatabase, realmId: string, userName: string) {
  const created = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const activated = userLifecycleSet({
    context: realmSystemContextCreate(),
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(activated.success).toBe(true)
  if (!activated.success) throw new Error(activated.errorMessage)
  return activated.data.user
}

function appendEvent(
  database: StorageDatabase,
  input: {
    readonly actorId: string
    readonly aggregateId: string
    readonly eventType: string
    readonly occurredAt: number
    readonly realmId: string
    readonly userSubjectId: string
  },
) {
  const appended = storageTransactionRun(database, (transaction) =>
    eventSecurityEventAppend(
      transaction,
      {
        actorId: input.actorId,
        aggregateId: input.aggregateId,
        aggregateType: "account_security_history_test",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId: `internal-correlation-${input.aggregateId}`,
        eventType: input.eventType,
        metadata: {
          clientIp: "203.0.113.7",
          credentialId: "credential-must-not-leak",
          oauthSubject: "oauth-subject-must-not-leak",
        },
        occurredAt: input.occurredAt,
        payload: {
          password: "secret-password",
          refreshToken: "secret-token",
          secret: "secret-value",
        },
        realmId: input.realmId,
        userSubjectId: input.userSubjectId,
      },
      database.runtime,
    ),
  )
  expect(appended.success).toBe(true)
  if (!appended.success) throw new Error(appended.errorMessage)
  return appended.data
}

test("security history projects every account security family to allowlisted display fields", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "account-security-history-projection.example.com")
    const subject = createActiveUser(database, realm.id, "history-subject")
    const actor = createActiveUser(database, realm.id, "history-actor")
    const eventTypes = [
      "session.created",
      "password.login_succeeded",
      "mfa.challenge.completed",
      "passkey.authentication_completed",
      "external_identity.linked",
      "user.email_change_verified",
      "oidc.refresh_token_family_revoked",
      "impersonation.started",
    ]
    for (const [index, eventType] of eventTypes.entries())
      appendEvent(database, {
        actorId: actor.id,
        aggregateId: `projection-${index}`,
        eventType,
        occurredAt: 100 + index,
        realmId: realm.id,
        userSubjectId: subject.id,
      })

    const history = eventSecurityHistoryList({ database, realmId: realm.id, userId: subject.id })
    expect(history.success).toBe(true)
    if (!history.success) return
    expect(history.data.items).toHaveLength(eventTypes.length)
    expect(history.data.items.map((item) => item.displayCode)).toEqual([
      "impersonation.started",
      "refresh_token.family_revoked",
      "email_change.verified",
      "linked_identity.linked",
      "passkey.authentication_completed",
      "mfa.challenge.completed",
      "password.login_succeeded",
      "session.created",
    ])
    for (const item of history.data.items) {
      expect(Object.keys(item).sort()).toEqual(["category", "displayCode", "id", "occurredAt"])
      expect(item).not.toHaveProperty("actorId")
      expect(item).not.toHaveProperty("subjectId")
      expect(item).not.toHaveProperty("eventType")
      expect(item).not.toHaveProperty("payload")
      expect(item).not.toHaveProperty("metadata")
      expect(JSON.stringify(item)).not.toContain("secret")
      expect(JSON.stringify(item)).not.toContain("203.0.113.7")
      expect(JSON.stringify(item)).not.toContain("oauth-subject")
      expect(JSON.stringify(item)).not.toContain("credential-must-not-leak")
    }

    expect(
      eventSecurityHistoryProjectionCreate({
        category: "passwords",
        displayCode: "password.login_succeeded",
        eventType: "session.created",
        id: "projection-mapped",
        occurredAt: 999,
      }),
    ).toEqual({
      data: { category: "sessions", displayCode: "session.created", id: "projection-mapped", occurredAt: 999 },
      success: true,
    })
  })
})

test("the authenticated history route uses the session subject, isolates realms, and paginates by event position", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "account-security-history-route.example.com")
    const otherRealm = await createRealm(database, "account-security-history-route-other.example.com")
    const subject = createActiveUser(database, realm.id, "route-subject")
    const actor = createActiveUser(database, realm.id, "route-actor")
    const otherSubject = createActiveUser(database, otherRealm.id, "other-subject")
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      userId: subject.id,
    })
    expect(session.success).toBe(true)
    if (!session.success) return
    appendEvent(database, {
      actorId: actor.id,
      aggregateId: "subject-event",
      eventType: "session.created",
      occurredAt: 100,
      realmId: realm.id,
      userSubjectId: subject.id,
    })
    appendEvent(database, {
      actorId: actor.id,
      aggregateId: "actor-only-event",
      eventType: "session.revoked",
      occurredAt: 200,
      realmId: realm.id,
      userSubjectId: actor.id,
    })
    appendEvent(database, {
      actorId: actor.id,
      aggregateId: "impersonation-notice",
      eventType: "impersonation.started",
      occurredAt: 300,
      realmId: realm.id,
      userSubjectId: subject.id,
    })
    appendEvent(database, {
      actorId: actor.id,
      aggregateId: "other-tenant-event",
      eventType: "session.created",
      occurredAt: 400,
      realmId: otherRealm.id,
      userSubjectId: otherSubject.id,
    })
    const app = accountServerAppCreate({ database, publicOrigin: "https://account-security-history-route.example.com" })
    expect(
      (await app.request(`https://account-security-history-route.example.com/realms/${realm.id}/me/security-history`))
        .status,
    ).toBe(401)
    const firstPage = await app.request(
      `https://account-security-history-route.example.com/realms/${realm.id}/me/security-history?pageSize=1`,
      { headers: { authorization: `Bearer ${session.data.token}` } },
    )
    expect(firstPage.status).toBe(200)
    const firstBody = await firstPage.json()
    expect(firstBody.items.map((item: { readonly displayCode: string }) => item.displayCode)).toEqual([
      "impersonation.started",
    ])
    expect(firstBody.nextPageToken).toBeString()
    expect(firstBody.items[0]).not.toHaveProperty("actorId")
    expect(firstBody.items[0]).not.toHaveProperty("subjectId")

    const secondPage = await app.request(
      `https://account-security-history-route.example.com/realms/${realm.id}/me/security-history?pageSize=1&pageToken=${encodeURIComponent(firstBody.nextPageToken)}`,
      { headers: { authorization: `Bearer ${session.data.token}` } },
    )
    expect(secondPage.status).toBe(200)
    const secondBody = await secondPage.json()
    expect(secondBody.items.map((item: { readonly displayCode: string }) => item.displayCode)).toEqual([
      "session.created",
    ])

    const clientRequests: string[] = []
    const client = accountApiClientCreate({
      baseUrl: "https://account-security-history-route.example.com",
      fetch: async (input, init) => {
        clientRequests.push(String(input))
        return app.request(input, init)
      },
      token: session.data.token,
    })
    const clientResult = await client.securityHistoryList(realm.id, { pageSize: 1 })
    expect(clientResult.success).toBe(true)
    expect(clientRequests[0]).toContain(`/realms/${realm.id}/me/security-history?pageSize=1`)

    const wrongRealm = await app.request(
      `https://account-security-history-route.example.com/realms/${otherRealm.id}/me/security-history`,
      { headers: { authorization: `Bearer ${session.data.token}` } },
    )
    expect(wrongRealm.status).toBe(401)
  })
})

test("account security history rejects non-user subjects before reading events", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "account-security-history-subject-type.example.com")
    const subject = createActiveUser(database, realm.id, "subject-type-user")
    const result = accountSecurityHistoryList({
      actor: {
        actorId: subject.id,
        assurance: "authenticated",
        authenticationMethod: "trusted",
        kind: "bootstrap_admin",
        realmId: realm.id,
      },
      database,
      realmId: realm.id,
      subjectId: subject.id,
      subjectType: "bootstrap_admin",
    })
    expect(result).toMatchObject({ code: "account.forbidden", success: false })
  })
})
