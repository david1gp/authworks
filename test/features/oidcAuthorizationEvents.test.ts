import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { oidcAuthorizationCodeRedeem } from "../../src/features/oidc/actions/oidcAuthorizationCodeRedeem.js"
import { oidcAuthorizationRequestAuthorize } from "../../src/features/oidc/actions/oidcAuthorizationRequestAuthorize.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcAuthorizationCodeConsumedEventPayloadSchema } from "../../src/features/oidc/events/oidcAuthorizationCodeConsumedEventPayloadSchema.js"
import { oidcAuthorizationCodeIssuedEventPayloadSchema } from "../../src/features/oidc/events/oidcAuthorizationCodeIssuedEventPayloadSchema.js"
import { oidcAuthorizationRequestValidatedEventPayloadSchema } from "../../src/features/oidc/events/oidcAuthorizationRequestValidatedEventPayloadSchema.js"
import { oidcRefreshTokenReplayDetectedEventPayloadSchema } from "../../src/features/oidc/events/oidcRefreshTokenReplayDetectedEventPayloadSchema.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { zitadelMigrationImport } from "../../src/features/zitadelMigration/actions/zitadelMigrationImport.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const userId = "98765432109876543210"
const clientId = "018f0e3f-8b00-7000-8000-000000000001"
const sessionId = "018f0e3f-8b00-7000-8000-000000000002"

async function withDatabase<T>(operation: (database: StorageDatabase, realmId: string) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-authorization-events-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database: opened.data,
    input: { domain: "oidc-authorization-events.example.com", name: "OIDC authorization events" },
    runtime: testkit.runtime,
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  try {
    return await operation(opened.data, realm.data.realm.id)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

function pkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

function migrationSnapshot() {
  return {
    organizations: [],
    organizationMemberships: [],
    projectGrants: [],
    projectRoles: [],
    projects: [],
    unsupported: [],
    users: [
      {
        createdAt: 1_700_000_000_000,
        deletedAt: null,
        email: "numeric-user@example.com",
        emailVerified: true,
        emailVerifiedAt: 1_700_000_000_000,
        id: userId,
        profile: {
          displayName: "Numeric User",
          firstName: "Numeric",
          gender: null,
          lastName: "User",
          nickName: null,
          preferredLanguage: null,
        },
        state: "active",
        updatedAt: 1_700_000_000_000,
        userName: "numeric-user",
      },
    ],
    version: 1,
  }
}

async function tokenRequest(app: ReturnType<typeof oidcServerAppCreate>, input: Record<string, string>) {
  return app.fetch(
    new Request("https://oidc-authorization-events.example.com/oauth2/token", {
      body: new URLSearchParams(input),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    }),
  )
}

test("authorization user references accept migrated IDs without widening OIDC resource IDs", () => {
  const payload = {
    clientId,
    codeChallengeMethod: "S256" as const,
    nonceProvided: false,
    redirectUri: "https://client.example/callback",
    scope: ["openid"],
    sessionId,
    stateProvided: true as const,
    userId,
  }
  expect(v.safeParse(oidcAuthorizationRequestValidatedEventPayloadSchema, payload).success).toBe(true)
  expect(
    v.safeParse(oidcAuthorizationRequestValidatedEventPayloadSchema, { ...payload, userId: clientId }).success,
  ).toBe(true)
  expect(v.safeParse(oidcAuthorizationRequestValidatedEventPayloadSchema, { ...payload, userId: "0" }).success).toBe(
    false,
  )
  expect(
    v.safeParse(oidcAuthorizationRequestValidatedEventPayloadSchema, { ...payload, userId: "../users/123" }).success,
  ).toBe(false)
  expect(
    v.safeParse(oidcAuthorizationRequestValidatedEventPayloadSchema, { ...payload, userId: "/users/123" }).success,
  ).toBe(false)
  expect(
    v.safeParse(oidcAuthorizationRequestValidatedEventPayloadSchema, {
      ...payload,
      userId: "123456789012345678901",
    }).success,
  ).toBe(false)
  expect(
    v.safeParse(oidcAuthorizationRequestValidatedEventPayloadSchema, { ...payload, clientId: userId }).success,
  ).toBe(false)
  expect(
    v.safeParse(oidcAuthorizationRequestValidatedEventPayloadSchema, { ...payload, sessionId: userId }).success,
  ).toBe(false)
  expect(
    v.safeParse(oidcAuthorizationRequestValidatedEventPayloadSchema, {
      ...payload,
      userId: "018f0e3f-8b00-7000-8000-000000000003",
    }).success,
  ).toBe(true)
})

test("authorization and replay events store migrated numeric user IDs", async () => {
  await withDatabase(async (database, realmId) => {
    const imported = zitadelMigrationImport({ database, realmId, snapshot: migrationSnapshot() })
    expect(imported.success).toBe(true)
    if (!imported.success) return

    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId,
      userId,
    })
    expect(session.success).toBe(true)
    if (!session.success) return

    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid", "profile", "email"],
        clientType: "public",
        name: "Migrated user client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      realmId,
    })
    expect(client.success).toBe(true)
    if (!client.success) return

    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "authorization-event-secret",
      input: {
        client_id: client.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid profile email",
        state: "authorization-event-state",
      },
      realmId,
      sessionToken: session.data.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return

    const validatedEvent = database.db
      .select()
      .from(storageEventTable)
      .all()
      .find((event) => event.eventType === "oidc.authorization_request_validated")
    expect(validatedEvent?.actorId).toBe(userId)
    expect(v.parse(oidcAuthorizationRequestValidatedEventPayloadSchema, validatedEvent?.payload ?? {})).toMatchObject({
      clientId: client.data.client.id,
      sessionId: expect.any(String),
      userId,
    })
    const issuedEvent = database.db
      .select()
      .from(storageEventTable)
      .all()
      .find((event) => event.eventType === "oidc.authorization_code_issued")
    expect(v.parse(oidcAuthorizationCodeIssuedEventPayloadSchema, issuedEvent?.payload ?? {}).userId).toBe(userId)

    const redeemed = oidcAuthorizationCodeRedeem({
      database,
      encryptionSecret: "authorization-event-secret",
      input: {
        client_id: client.data.client.id,
        code: authorization.data.code,
        code_verifier: verifier,
        redirect_uri: authorization.data.redirect_uri,
      },
      realmId,
    })
    expect(redeemed.success).toBe(true)
    const consumedEvent = database.db
      .select()
      .from(storageEventTable)
      .all()
      .find((event) => event.eventType === "oidc.authorization_code_consumed")
    expect(consumedEvent?.actorId).toBe(userId)
    expect(v.parse(oidcAuthorizationCodeConsumedEventPayloadSchema, consumedEvent?.payload ?? {}).userId).toBe(userId)

    const key = oidcSigningKeyCreate({
      context: realmSystemContextCreate(),
      database,
      encryptionSecret: "authorization-event-secret",
      realmId,
    })
    expect(key.success).toBe(true)
    if (!key.success) return
    const secondAuthorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "authorization-event-secret",
      input: {
        client_id: client.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid profile email",
        state: "authorization-event-state-two",
      },
      realmId,
      sessionToken: session.data.token,
    })
    expect(secondAuthorization.success).toBe(true)
    if (!secondAuthorization.success) return
    const app = oidcServerAppCreate({ database, systemSecret: "authorization-event-secret" })
    const tokenResponse = await tokenRequest(app, {
      client_id: client.data.client.id,
      code: secondAuthorization.data.code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: secondAuthorization.data.redirect_uri,
    })
    expect(tokenResponse.status).toBe(200)
    const token = (await tokenResponse.json()) as { refresh_token: string }
    const rotatedResponse = await tokenRequest(app, {
      client_id: client.data.client.id,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    })
    expect(rotatedResponse.status).toBe(200)
    const replayResponse = await tokenRequest(app, {
      client_id: client.data.client.id,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    })
    expect(replayResponse.status).toBe(400)
    const replayEvent = database.db
      .select()
      .from(storageEventTable)
      .all()
      .find((event) => event.eventType === "oidc.refresh_token_replay_detected")
    expect(replayEvent?.actorId).toBe(userId)
    expect(v.parse(oidcRefreshTokenReplayDetectedEventPayloadSchema, replayEvent?.payload ?? {}).userId).toBe(userId)
  })
})
