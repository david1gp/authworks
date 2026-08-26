import { and, desc, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionAuthenticate } from "../../sessions/actions/sessionAuthenticate.js"
import { sessionEventTypes } from "../../sessions/events/sessionEventTypes.js"
import { sessionRevokedEventPayloadSchema } from "../../sessions/events/sessionRevokedEventPayloadSchema.js"
import { sessionRepositoryCreate } from "../../sessions/persistence/sessionRepositoryCreate.js"
import { oidcBase64UrlDecode } from "../domain/oidcBase64UrlDecode.js"
import { oidcIssuerCreate } from "../domain/oidcIssuerCreate.js"
import { oidcJwtVerify } from "../domain/oidcJwtVerify.js"
import { oidcRedirectUriMatches } from "../domain/oidcRedirectUriMatches.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcAccessTokenRevokedEventPayloadSchema } from "../events/oidcAccessTokenRevokedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcLogoutEventPayloadSchema } from "../events/oidcLogoutEventPayloadSchema.js"
import { oidcRefreshTokenFamilyRevokedEventPayloadSchema } from "../events/oidcRefreshTokenFamilyRevokedEventPayloadSchema.js"
import type { OidcClientRow } from "../persistence/oidcClientTable.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcLogoutRequest } from "../public/oidcLogoutRequestSchema.js"
import { oidcLogoutRequestSchema } from "../public/oidcLogoutRequestSchema.js"
import type { OidcLogoutResponse } from "../public/oidcLogoutResponseSchema.js"
import { oidcPublicJwkSchema } from "../public/oidcPublicJwkSchema.js"

type OidcLogoutOptions = {
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly input: OidcLogoutRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionToken?: string
  readonly correlationId?: string
}

type OidcLogoutIdentity = {
  readonly client: OidcClientRow
  readonly sessionId: string
  readonly userId: string
}

export function oidcLogout(options: OidcLogoutOptions): Result<OidcLogoutResponse> {
  const op = "oidcLogout"
  const parsed = v.safeParse(oidcLogoutRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The logout request is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The logout timestamp is invalid.", undefined, "oidc.invalid-timestamp")
  const realm = realmGet({
    context: realmSystemContextCreate(),
    database: options.database,
    realmId: options.realmId,
  })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active") return resultErrorCreate(op, "The realm is not active.")
  const issuer = oidcIssuerCreate(realm.data.realm.domain)
  const identity = oidcLogoutIdentityResolve({
    database: options.database,
    encryptionSecret: options.encryptionSecret,
    input: parsed.output,
    realmId: options.realmId,
    issuer,
    now,
    runtime,
    sessionToken: options.sessionToken,
  })
  if (!identity.success) return identity
  const postLogout = oidcPostLogoutRedirectResolve(identity.data.client, parsed.output.post_logout_redirect_uri)
  if (!postLogout.success) return postLogout
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  const completed = storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const sessions = sessionRepositoryCreate(transaction)
    const session = sessions.sessionGet(options.realmId, identity.data.sessionId)
    if (!session.success) return session
    if (session.data === null || session.data.userId !== identity.data.userId)
      return resultErrorCreate(op, "The logout session is invalid.")
    let revoked = false
    let commandIndex = 0
    if (session.data.revokedAt === null) {
      const updated = sessions.sessionVersionUpdate(options.realmId, session.data.id, session.data.version, {
        revokedAt: now,
        revocationReason: "rp_initiated_logout",
        version: session.data.version + 1,
      })
      if (!updated.success) return updated
      if (updated.data === null) return resultErrorCreate(op, "The logout session is invalid.")
      const eventVersion = sessions.sessionEventVersionGet(options.realmId, session.data.id)
      if (!eventVersion.success) return eventVersion
      const payload = v.safeParse(sessionRevokedEventPayloadSchema, {
        reason: "rp_initiated_logout",
        revokedAt: now,
        sessionId: session.data.id,
      })
      if (!payload.success) return resultErrorCreate(op, "The session event payload is invalid.")
      const event = eventSecurityEventAppend(
        transaction,
        {
          actorId: identity.data.userId,
          aggregateId: session.data.id,
          aggregateType: "session",
          aggregateVersion: eventVersion.data + 1,
          commandIndex,
          correlationId,
          eventType: sessionEventTypes.revoked,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "sessions" },
          occurredAt: now,
          payload: payload.output,
          userSubjectId: session.data.userId,
        },
        runtime,
      )
      if (!event.success) return event
      commandIndex += 1
      revoked = true
    }

    const access = repository.accessTokenSessionRevoke(options.realmId, identity.data.sessionId, now)
    if (!access.success) return access
    for (const token of access.data) {
      const payload = v.safeParse(oidcAccessTokenRevokedEventPayloadSchema, {
        clientId: token.clientId,
        sessionId: token.sessionId,
        userId: token.userId,
      })
      if (!payload.success) return resultErrorCreate(op, "The token event payload is invalid.")
      const event = eventSecurityEventAppend(
        transaction,
        {
          actorId: token.userId,
          aggregateId: token.id,
          aggregateType: "oidc_access_token",
          aggregateVersion: 2,
          commandIndex,
          correlationId,
          eventType: oidcEventTypes.accessTokenRevoked,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "oidc" },
          occurredAt: now,
          payload: payload.output,
          userSubjectId: token.userId,
        },
        runtime,
      )
      if (!event.success) return event
      commandIndex += 1
      revoked = true
    }

    const refresh = repository.refreshTokenSessionRevoke(options.realmId, identity.data.sessionId, now)
    if (!refresh.success) return refresh
    const families = new Map<string, (typeof refresh.data)[number]>()
    for (const token of refresh.data) {
      if (!families.has(token.familyId)) families.set(token.familyId, token)
    }
    for (const token of families.values()) {
      const payload = v.safeParse(oidcRefreshTokenFamilyRevokedEventPayloadSchema, {
        clientId: token.clientId,
        familyId: token.familyId,
        sessionId: token.sessionId,
        userId: token.userId,
      })
      if (!payload.success) return resultErrorCreate(op, "The token event payload is invalid.")
      const event = eventSecurityEventAppend(
        transaction,
        {
          actorId: token.userId,
          aggregateId: token.familyId,
          aggregateType: "oidc_refresh_token_family",
          aggregateVersion: 1,
          commandIndex,
          correlationId,
          eventType: oidcEventTypes.refreshTokenFamilyRevoked,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "oidc" },
          occurredAt: now,
          payload: payload.output,
          userSubjectId: token.userId,
        },
        runtime,
      )
      if (!event.success) return event
      commandIndex += 1
      revoked = true
    }

    const logoutPayload = v.safeParse(oidcLogoutEventPayloadSchema, {
      clientId: identity.data.client.id,
      redirectRequested: postLogout.data !== undefined,
      sessionId: identity.data.sessionId,
      userId: identity.data.userId,
    })
    if (!logoutPayload.success) return resultErrorCreate(op, "The logout event payload is invalid.")
    const lastLogout = transaction
      .select({ aggregateVersion: storageEventTable.aggregateVersion })
      .from(storageEventTable)
      .where(
        and(
          eq(storageEventTable.realmId, options.realmId),
          eq(storageEventTable.aggregateType, "oidc_logout"),
          eq(storageEventTable.aggregateId, identity.data.sessionId),
        ),
      )
      .orderBy(desc(storageEventTable.aggregateVersion))
      .get()
    const logoutEvent = storageEventAppend(
      transaction,
      {
        actorId: identity.data.userId,
        aggregateId: identity.data.sessionId,
        aggregateType: "oidc_logout",
        aggregateVersion: (lastLogout?.aggregateVersion ?? 0) + 1,
        commandIndex,
        correlationId,
        eventType: oidcEventTypes.logout,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "oidc" },
        occurredAt: now,
        payload: logoutPayload.output,
      },
      runtime,
    )
    if (!logoutEvent.success) return logoutEvent
    return resultCreate({
      revoked,
      response: {
        ...(postLogout.data === undefined ? {} : { post_logout_redirect_uri: postLogout.data }),
        revoked,
        ...(parsed.output.state === undefined ? {} : { state: parsed.output.state }),
      },
    })
  })
  if (!completed.success) return completed
  return resultCreate(completed.data.response)
}

type OidcLogoutIdentityOptions = {
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly input: OidcLogoutRequest
  readonly realmId: string
  readonly issuer: string
  readonly now: number
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionToken?: string
}

function oidcLogoutIdentityResolve(options: OidcLogoutIdentityOptions): Result<OidcLogoutIdentity> {
  const repository = oidcRepositoryCreate(options.database.db)
  if (options.input.id_token_hint !== undefined) {
    const hint = oidcLogoutIdTokenVerify(
      repository,
      options.input.id_token_hint,
      options.realmId,
      options.issuer,
      options.now,
    )
    if (!hint.success) return hint
    if (options.input.client_id !== undefined && options.input.client_id !== hint.data.clientId)
      return resultErrorCreate("oidcLogout", "The logout request is invalid.")
    const client = repository.clientGet(options.realmId, hint.data.clientId)
    if (!client.success) return client
    if (client.data === null || client.data.status !== "active")
      return resultErrorCreate("oidcLogout", "The logout request is invalid.")
    return resultCreate({ client: client.data, sessionId: hint.data.sessionId, userId: hint.data.userId })
  }
  if (options.input.client_id === undefined || options.sessionToken === undefined)
    return resultErrorCreate("oidcLogout", "An ID token hint or authenticated session is required.")
  const client = repository.clientGet(options.realmId, options.input.client_id)
  if (!client.success) return client
  if (client.data === null || client.data.status !== "active")
    return resultErrorCreate("oidcLogout", "The logout request is invalid.")
  const authenticated = sessionAuthenticate({
    database: options.database,
    realmId: options.realmId,
    runtime: options.runtime,
    token: options.sessionToken,
  })
  if (!authenticated.success) return resultErrorCreate("oidcLogout", "Session authorization is required.")
  return resultCreate({
    client: client.data,
    sessionId: authenticated.data.session.id,
    userId: authenticated.data.actor.actorId,
  })
}

function oidcLogoutIdTokenVerify(
  repository: ReturnType<typeof oidcRepositoryCreate>,
  token: string,
  realmId: string,
  issuer: string,
  now: number,
): Result<{ readonly clientId: string; readonly sessionId: string; readonly userId: string }> {
  try {
    const encodedHeader = token.split(".")[0]
    if (encodedHeader === undefined) return resultErrorCreate("oidcLogout", "The logout request is invalid.")
    const headerBytes = oidcBase64UrlDecode(encodedHeader)
    if (headerBytes === null) return resultErrorCreate("oidcLogout", "The logout request is invalid.")
    const header = JSON.parse(Buffer.from(headerBytes).toString("utf8")) as { kid?: string }
    if (typeof header.kid !== "string") return resultErrorCreate("oidcLogout", "The logout request is invalid.")
    const key = repository.signingKeyGet(realmId, header.kid)
    if (!key.success) return key
    if (key.data === null) return resultErrorCreate("oidcLogout", "The logout request is invalid.")
    const publicJwk = v.safeParse(oidcPublicJwkSchema, JSON.parse(key.data.publicJwk))
    if (!publicJwk.success) return resultErrorCreate("oidcLogout", "The logout request is invalid.")
    const verified = oidcJwtVerify(token, publicJwk.output)
    if (!verified.success) return resultErrorCreate("oidcLogout", "The logout request is invalid.")
    const claims = verified.data
    if (
      claims.iss !== issuer ||
      typeof claims.aud !== "string" ||
      typeof claims.sub !== "string" ||
      typeof claims.sid !== "string" ||
      typeof claims.exp !== "number" ||
      claims.exp <= Math.floor(now / 1_000)
    )
      return resultErrorCreate("oidcLogout", "The logout request is invalid.")
    return resultCreate({ clientId: claims.aud, sessionId: claims.sid, userId: claims.sub })
  } catch (_error) {
    return resultErrorCreate("oidcLogout", "The logout request is invalid.")
  }
}

function oidcPostLogoutRedirectResolve(
  client: OidcClientRow,
  requested: string | undefined,
): Result<string | undefined> {
  if (requested === undefined) return resultCreate(undefined)
  try {
    const registered = v.safeParse(
      v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
      JSON.parse(client.postLogoutRedirectUris),
    )
    if (!registered.success) return resultErrorCreate("oidcLogout", "The logout redirect is not registered.")
    const matched = oidcRedirectUriMatches(requested, registered.output)
    if (!matched.success) return resultErrorCreate("oidcLogout", "The logout redirect is not registered.")
    return resultCreate(requested)
  } catch (_error) {
    return resultErrorCreate("oidcLogout", "The logout redirect is not registered.")
  }
}
