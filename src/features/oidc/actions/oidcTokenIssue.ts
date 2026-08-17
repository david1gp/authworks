import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { instanceGet } from "../../instances/actions/instanceGet.js"
import { instanceSystemContextCreate } from "../../instances/domain/instanceSystemContextCreate.js"
import { oidcAccessTokenIssuedEventPayloadSchema } from "../events/oidcAccessTokenIssuedEventPayloadSchema.js"
import { oidcAuthorizationCodeConsumedEventPayloadSchema } from "../events/oidcAuthorizationCodeConsumedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRefreshTokenIssuedEventPayloadSchema } from "../events/oidcRefreshTokenIssuedEventPayloadSchema.js"
import { oidcRefreshTokenReplayDetectedEventPayloadSchema } from "../events/oidcRefreshTokenReplayDetectedEventPayloadSchema.js"
import { oidcRefreshTokenRotatedEventPayloadSchema } from "../events/oidcRefreshTokenRotatedEventPayloadSchema.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcIssuerCreate } from "../domain/oidcIssuerCreate.js"
import { oidcJwtSign } from "../domain/oidcJwtSign.js"
import { oidcPkceVerify } from "../domain/oidcPkceVerify.js"
import { oidcRefreshTokenCreate } from "../domain/oidcRefreshTokenCreate.js"
import { oidcScopeSchema } from "../domain/oidcScopeSchema.js"
import { oidcClientSecretMatches } from "../domain/oidcClientSecretMatches.js"
import { oidcValueDecrypt } from "../domain/oidcValueEncrypt.js"
import { oidcPublicJwkSchema } from "../public/oidcPublicJwkSchema.js"
import type { OidcTokenRequest } from "../public/oidcTokenRequestSchema.js"
import { oidcTokenRequestSchema } from "../public/oidcTokenRequestSchema.js"
import type { OidcTokenResponse } from "../public/oidcTokenResponseSchema.js"
import type { OidcClientRow } from "../persistence/oidcClientTable.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { sessionTable, type SessionRow } from "../../sessions/persistence/sessionTable.js"
import { userProfileTable, type UserProfileRow } from "../../users/persistence/userProfileTable.js"
import { userTable, type UserRow } from "../../users/persistence/userTable.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { and, eq } from "drizzle-orm"

const oidcAccessTokenLifetimeMs = 5 * 60 * 1_000
const oidcRefreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1_000

type OidcTokenIssueOptions = {
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly input: OidcTokenRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

type OidcTokenSubject = {
  readonly profile: UserProfileRow | null
  readonly session: SessionRow
  readonly user: UserRow
}

type OidcTokenSigningKey = {
  readonly id: string
  readonly privateKey: string
}

type OidcTokenTransactionResult =
  | { readonly kind: "issued"; readonly response: OidcTokenResponse }
  | { readonly kind: "replay" }

export function oidcTokenIssue(options: OidcTokenIssueOptions): Result<OidcTokenResponse> {
  const op = "oidcTokenIssue"
  const parsed = v.safeParse(oidcTokenRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate("oidcTokenInvalidRequest", "The token request is invalid.")
  if (options.instanceId.length === 0)
    return resultErrorCreate("oidcTokenInvalidRequest", "The token request is invalid.")

  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate("oidcTokenInvalidRequest", "The token timestamp is invalid.")
  const instance = instanceGet({
    context: instanceSystemContextCreate(),
    database: options.database,
    instanceId: options.instanceId,
  })
  if (!instance.success) return instance
  if (instance.data.instance.status !== "active") return resultErrorCreate(op, "The instance is not active.")
  const issuer = oidcIssuerCreate(instance.data.instance.domain)
  const clientId = parsed.output.client_id
  if (clientId === undefined) return resultErrorCreate("oidcTokenInvalidClient", "Client authentication failed.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  const completed = storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const client = oidcTokenClientAuthenticate(repository.clientGet(options.instanceId, clientId), parsed.output)
    if (!client.success) return client
    if (parsed.output.grant_type === "authorization_code")
      return oidcTokenAuthorizationCodeExchange({
        client: client.data,
        correlationId,
        encryptionSecret: options.encryptionSecret,
        input: parsed.output,
        instanceId: options.instanceId,
        issuer,
        now,
        repository,
        runtime,
        transaction,
      })
    return oidcTokenRefreshExchange({
      client: client.data,
      correlationId,
      encryptionSecret: options.encryptionSecret,
      input: parsed.output,
      instanceId: options.instanceId,
      issuer,
      now,
      repository,
      runtime,
      transaction,
    })
  })
  if (!completed.success) return completed
  if (completed.data.kind === "replay")
    return resultErrorCreate("oidcTokenInvalidGrant", "The refresh token is invalid.")
  return resultCreate(completed.data.response)
}

function oidcTokenClientAuthenticate(
  clientResult: ReturnType<ReturnType<typeof oidcRepositoryCreate>["clientGet"]>,
  input: OidcTokenRequest,
): Result<OidcClientRow> {
  if (!clientResult.success) return clientResult
  const client = clientResult.data
  if (client === null || client.status !== "active")
    return resultErrorCreate("oidcTokenInvalidClient", "Client authentication failed.")
  if (client.clientType === "confidential") {
    if (input.client_secret === undefined || client.secretHash === null)
      return resultErrorCreate("oidcTokenInvalidClient", "Client authentication failed.")
    if (!oidcClientSecretMatches(input.client_secret, client.secretHash))
      return resultErrorCreate("oidcTokenInvalidClient", "Client authentication failed.")
    return resultCreate(client)
  }
  if (input.client_secret !== undefined)
    return resultErrorCreate("oidcTokenInvalidClient", "Client authentication failed.")
  return resultCreate(client)
}

type OidcTokenExchangeOptions = {
  readonly client: OidcClientRow
  readonly correlationId: string
  readonly encryptionSecret?: Secret | string
  readonly input: OidcTokenRequest
  readonly instanceId: string
  readonly issuer: string
  readonly now: number
  readonly repository: ReturnType<typeof oidcRepositoryCreate>
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly transaction: StorageTransaction
}

function oidcTokenAuthorizationCodeExchange(options: OidcTokenExchangeOptions): Result<OidcTokenTransactionResult> {
  const { input } = options
  if (input.code === undefined || input.code_verifier === undefined || input.redirect_uri === undefined)
    return resultErrorCreate("oidcTokenInvalidGrant", "The authorization grant is invalid.")
  const code = options.repository.authorizationCodeGetByTokenHash(oidcHashCreate(input.code))
  if (!code.success) return code
  if (
    code.data === null ||
    code.data.instanceId !== options.instanceId ||
    code.data.clientId !== options.client.id ||
    code.data.redirectUri !== input.redirect_uri ||
    code.data.issuer !== options.issuer ||
    code.data.usedAt !== null ||
    code.data.expiresAt <= options.now
  )
    return resultErrorCreate("oidcTokenInvalidGrant", "The authorization grant is invalid.")
  const pkce = oidcPkceVerify(input.code_verifier, code.data.codeChallenge, code.data.codeChallengeMethod)
  if (!pkce.success) return resultErrorCreate("oidcTokenInvalidGrant", "The authorization grant is invalid.")
  const scope = oidcTokenStoredScopeParse(code.data.scope)
  if (!scope.success) return resultErrorCreate("oidcTokenInvalidGrant", "The authorization grant is invalid.")
  const nonce =
    code.data.nonceEncrypted === null
      ? resultCreate<string | null>(null)
      : oidcValueDecrypt(code.data.nonceEncrypted, options.instanceId, options.encryptionSecret)
  if (!nonce.success) return resultErrorCreate("oidcTokenInvalidGrant", "The authorization grant is invalid.")
  const subject = oidcTokenSubjectGet(
    options.transaction,
    options.instanceId,
    code.data.userId,
    code.data.sessionId,
    options.now,
  )
  if (!subject.success) return subject
  const consumed = options.repository.authorizationCodeConsume(
    options.instanceId,
    options.client.id,
    code.data.id,
    oidcHashCreate(input.code),
    options.now,
    options.now,
  )
  if (!consumed.success) return consumed
  if (consumed.data === null) return resultErrorCreate("oidcTokenInvalidGrant", "The authorization grant is invalid.")

  const consumedPayload = v.safeParse(oidcAuthorizationCodeConsumedEventPayloadSchema, {
    authorizationCodeId: consumed.data.id,
    clientId: consumed.data.clientId,
    nonceProvided: consumed.data.nonceEncrypted !== null,
    redirectUri: consumed.data.redirectUri,
    scope: scope.data,
    sessionId: consumed.data.sessionId,
    userId: consumed.data.userId,
  })
  if (!consumedPayload.success) return resultErrorCreate("oidcTokenIssue", "The token event payload is invalid.")
  const consumedEvent = storageEventAppend(
    options.transaction,
    {
      actorId: consumed.data.userId,
      aggregateId: consumed.data.id,
      aggregateType: "oidc_authorization_code",
      aggregateVersion: 2,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: oidcEventTypes.authorizationCodeConsumed,
      instanceId: options.instanceId,
      metadata: { auditSafe: true, source: "oidc" },
      occurredAt: options.now,
      payload: consumedPayload.output,
    },
    options.runtime,
  )
  if (!consumedEvent.success) return consumedEvent
  return oidcTokenArtifactsIssue({
    ...options,
    nonce: nonce.data,
    nonceEncrypted: consumed.data.nonceEncrypted,
    scope: scope.data,
    subject: subject.data,
  })
}

function oidcTokenRefreshExchange(options: OidcTokenExchangeOptions): Result<OidcTokenTransactionResult> {
  const { input } = options
  if (input.refresh_token === undefined)
    return resultErrorCreate("oidcTokenInvalidGrant", "The refresh token is invalid.")
  const tokenHash = oidcHashCreate(input.refresh_token)
  const refresh = options.repository.refreshTokenGetByTokenHash(tokenHash)
  if (!refresh.success) return refresh
  if (
    refresh.data === null ||
    refresh.data.instanceId !== options.instanceId ||
    refresh.data.clientId !== options.client.id
  )
    return resultErrorCreate("oidcTokenInvalidGrant", "The refresh token is invalid.")
  if (refresh.data.revokedAt !== null) {
    if (refresh.data.replacedByHash === null)
      return resultErrorCreate("oidcTokenInvalidGrant", "The refresh token is invalid.")
    const refreshRevoked = options.repository.refreshTokenFamilyRevoke(
      options.instanceId,
      refresh.data.familyId,
      options.now,
    )
    if (!refreshRevoked.success) return refreshRevoked
    const accessRevoked = options.repository.accessTokenFamilyRevoke(
      options.instanceId,
      refresh.data.familyId,
      options.now,
    )
    if (!accessRevoked.success) return accessRevoked
    const payload = v.safeParse(oidcRefreshTokenReplayDetectedEventPayloadSchema, {
      clientId: refresh.data.clientId,
      familyId: refresh.data.familyId,
      userId: refresh.data.userId,
    })
    if (!payload.success) return resultErrorCreate("oidcTokenIssue", "The token event payload is invalid.")
    const event = storageEventAppend(
      options.transaction,
      {
        actorId: refresh.data.userId,
        aggregateId: refresh.data.id,
        aggregateType: "oidc_refresh_token",
        aggregateVersion: 3,
        commandIndex: 0,
        correlationId: options.correlationId,
        eventType: oidcEventTypes.refreshTokenReplayDetected,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "oidc" },
        occurredAt: options.now,
        payload: payload.output,
      },
      options.runtime,
    )
    if (!event.success) return event
    return resultCreate({ kind: "replay" })
  }
  if (refresh.data.expiresAt <= options.now)
    return resultErrorCreate("oidcTokenInvalidGrant", "The refresh token is invalid.")
  const scope = oidcTokenRefreshScopeParse(input.scope, refresh.data.scope)
  if (!scope.success) return scope
  const nonce =
    refresh.data.nonceEncrypted === null
      ? resultCreate<string | null>(null)
      : oidcValueDecrypt(refresh.data.nonceEncrypted, options.instanceId, options.encryptionSecret)
  if (!nonce.success) return resultErrorCreate("oidcTokenInvalidGrant", "The refresh token is invalid.")
  const subject = oidcTokenSubjectGet(
    options.transaction,
    options.instanceId,
    refresh.data.userId,
    refresh.data.sessionId,
    options.now,
  )
  if (!subject.success) return subject
  const nextRefresh = oidcRefreshTokenCreate(options.runtime)
  if (!nextRefresh.success) return nextRefresh
  const rotated = options.repository.refreshTokenRotate(
    options.instanceId,
    options.client.id,
    tokenHash,
    oidcHashCreate(nextRefresh.data),
    options.now,
  )
  if (!rotated.success) return rotated
  if (rotated.data === null) return resultErrorCreate("oidcTokenInvalidGrant", "The refresh token is invalid.")
  const result = oidcTokenArtifactsIssue({
    ...options,
    nonce: nonce.data,
    nonceEncrypted: refresh.data.nonceEncrypted,
    refreshFamilyId: refresh.data.familyId,
    rotatedFrom: refresh.data.id,
    scope: scope.data,
    subject: subject.data,
    refreshToken: nextRefresh.data,
  })
  return result
}

type OidcTokenArtifactsOptions = OidcTokenExchangeOptions & {
  readonly nonce: string | null
  readonly nonceEncrypted: string | null
  readonly scope: string[]
  readonly subject: OidcTokenSubject
  readonly refreshFamilyId?: string
  readonly rotatedFrom?: string
  readonly refreshToken?: string
}

function oidcTokenArtifactsIssue(options: OidcTokenArtifactsOptions): Result<OidcTokenTransactionResult> {
  const accessExpiresAt = options.now + oidcAccessTokenLifetimeMs
  const refreshExpiresAt = options.now + oidcRefreshTokenLifetimeMs
  if (!Number.isSafeInteger(accessExpiresAt) || !Number.isSafeInteger(refreshExpiresAt))
    return resultErrorCreate("oidcTokenIssue", "The token expiry is invalid.")
  const key = oidcTokenSigningKeyGet(options.repository.signingKeyList(options.instanceId), options.encryptionSecret)
  if (!key.success) return key
  const accessJti = uuidv7Create(options.runtime)
  const accessClaims = oidcTokenClaimsCreate(
    options.subject,
    options.scope,
    options.issuer,
    options.client.id,
    options.now,
    accessExpiresAt,
  )
  accessClaims.client_id = options.client.id
  accessClaims.jti = accessJti
  accessClaims.scope = options.scope.join(" ")
  const accessToken = oidcJwtSign({ alg: "RS256", kid: key.data.id, typ: "JWT" }, accessClaims, key.data.privateKey)
  if (!accessToken.success) return accessToken
  const idClaims = oidcTokenClaimsCreate(
    options.subject,
    options.scope,
    options.issuer,
    options.client.id,
    options.now,
    accessExpiresAt,
  )
  idClaims.azp = options.client.id
  if (options.nonce !== null) idClaims.nonce = options.nonce
  const idToken = oidcJwtSign({ alg: "RS256", kid: key.data.id, typ: "JWT" }, idClaims, key.data.privateKey)
  if (!idToken.success) return idToken
  const refreshToken =
    options.refreshToken === undefined ? oidcRefreshTokenCreate(options.runtime) : resultCreate(options.refreshToken)
  if (!refreshToken.success) return refreshToken
  const refreshFamilyId = options.refreshFamilyId ?? uuidv7Create(options.runtime)
  const createdAccess = options.repository.accessTokenCreate({
    clientId: options.client.id,
    createdAt: options.now,
    expiresAt: accessExpiresAt,
    id: uuidv7Create(options.runtime),
    instanceId: options.instanceId,
    refreshFamilyId,
    revokedAt: null,
    scope: JSON.stringify(options.scope),
    sessionId: options.subject.session.id,
    tokenHash: oidcHashCreate(accessToken.data),
    userId: options.subject.user.id,
  })
  if (!createdAccess.success) return createdAccess
  const createdRefresh = options.repository.refreshTokenCreate({
    clientId: options.client.id,
    createdAt: options.now,
    expiresAt: refreshExpiresAt,
    familyId: refreshFamilyId,
    id: uuidv7Create(options.runtime),
    instanceId: options.instanceId,
    nonceEncrypted: options.nonceEncrypted,
    replacedByHash: null,
    revokedAt: null,
    scope: JSON.stringify(options.scope),
    sessionId: options.subject.session.id,
    tokenHash: oidcHashCreate(refreshToken.data),
    userId: options.subject.user.id,
  })
  if (!createdRefresh.success) return createdRefresh
  if (options.rotatedFrom !== undefined) {
    const rotatedPayload = v.safeParse(oidcRefreshTokenRotatedEventPayloadSchema, {
      clientId: options.client.id,
      familyId: refreshFamilyId,
      scope: options.scope,
      sessionId: options.subject.session.id,
      userId: options.subject.user.id,
    })
    if (!rotatedPayload.success) return resultErrorCreate("oidcTokenIssue", "The token event payload is invalid.")
    const rotatedEvent = storageEventAppend(
      options.transaction,
      {
        actorId: options.subject.user.id,
        aggregateId: options.rotatedFrom,
        aggregateType: "oidc_refresh_token",
        aggregateVersion: 2,
        commandIndex: 0,
        correlationId: options.correlationId,
        eventType: oidcEventTypes.refreshTokenRotated,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "oidc" },
        occurredAt: options.now,
        payload: rotatedPayload.output,
      },
      options.runtime,
    )
    if (!rotatedEvent.success) return rotatedEvent
  }
  const accessPayload = v.safeParse(oidcAccessTokenIssuedEventPayloadSchema, {
    clientId: options.client.id,
    expiresAt: accessExpiresAt,
    idTokenIssued: true,
    refreshTokenIssued: true,
    scope: options.scope,
    sessionId: options.subject.session.id,
    userId: options.subject.user.id,
  })
  const refreshPayload = v.safeParse(oidcRefreshTokenIssuedEventPayloadSchema, {
    clientId: options.client.id,
    expiresAt: refreshExpiresAt,
    familyId: refreshFamilyId,
    scope: options.scope,
    sessionId: options.subject.session.id,
    userId: options.subject.user.id,
  })
  if (!accessPayload.success || !refreshPayload.success)
    return resultErrorCreate("oidcTokenIssue", "The token event payload is invalid.")
  const accessEvent = storageEventAppend(
    options.transaction,
    {
      actorId: options.subject.user.id,
      aggregateId: createdAccess.data.id,
      aggregateType: "oidc_access_token",
      aggregateVersion: 1,
      commandIndex: 1,
      correlationId: options.correlationId,
      eventType: oidcEventTypes.accessTokenIssued,
      instanceId: options.instanceId,
      metadata: { auditSafe: true, source: "oidc" },
      occurredAt: options.now,
      payload: accessPayload.output,
    },
    options.runtime,
  )
  if (!accessEvent.success) return accessEvent
  const refreshEvent = storageEventAppend(
    options.transaction,
    {
      actorId: options.subject.user.id,
      aggregateId: createdRefresh.data.id,
      aggregateType: "oidc_refresh_token",
      aggregateVersion: 1,
      commandIndex: 2,
      correlationId: options.correlationId,
      eventType: oidcEventTypes.refreshTokenIssued,
      instanceId: options.instanceId,
      metadata: { auditSafe: true, source: "oidc" },
      occurredAt: options.now,
      payload: refreshPayload.output,
    },
    options.runtime,
  )
  if (!refreshEvent.success) return refreshEvent
  return resultCreate({
    kind: "issued",
    response: {
      access_token: accessToken.data,
      expires_in: Math.floor((accessExpiresAt - options.now) / 1_000),
      id_token: idToken.data,
      refresh_token: refreshToken.data,
      scope: options.scope.join(" "),
      token_type: "Bearer",
    },
  })
}

function oidcTokenSigningKeyGet(
  keysResult: ReturnType<ReturnType<typeof oidcRepositoryCreate>["signingKeyList"]>,
  encryptionSecret?: Secret | string,
): Result<OidcTokenSigningKey> {
  if (!keysResult.success) return keysResult
  const key = keysResult.data.find((candidate) => candidate.status === "active" && candidate.algorithm === "RS256")
  if (key === undefined) return resultErrorCreate("oidcTokenIssue", "No active signing key is available.")
  const privateKey = oidcValueDecrypt(key.encryptedPrivateKey, key.instanceId, encryptionSecret)
  if (!privateKey.success) return resultErrorCreate("oidcTokenIssue", "The signing key is invalid.")
  try {
    const publicJwk = v.safeParse(oidcPublicJwkSchema, JSON.parse(key.publicJwk))
    if (!publicJwk.success || publicJwk.output.kid !== key.id)
      return resultErrorCreate("oidcTokenIssue", "The signing key is invalid.")
  } catch (_error) {
    return resultErrorCreate("oidcTokenIssue", "The signing key is invalid.")
  }
  return resultCreate({ id: key.id, privateKey: privateKey.data })
}

function oidcTokenSubjectGet(
  transaction: OidcTokenExchangeOptions["transaction"],
  instanceId: string,
  userId: string,
  sessionId: string,
  now: number,
): Result<OidcTokenSubject> {
  const session = transaction
    .select()
    .from(sessionTable)
    .where(
      and(eq(sessionTable.instanceId, instanceId), eq(sessionTable.id, sessionId), eq(sessionTable.userId, userId)),
    )
    .get()
  if (session === undefined || session.revokedAt !== null || session.expiresAt <= now)
    return resultErrorCreate("oidcTokenInvalidGrant", "The authenticated session is no longer valid.")
  const user = transaction
    .select()
    .from(userTable)
    .where(and(eq(userTable.instanceId, instanceId), eq(userTable.id, userId)))
    .get()
  if (user === undefined || user.state !== "active" || user.deletedAt !== null)
    return resultErrorCreate("oidcTokenInvalidGrant", "The authenticated user is no longer valid.")
  const profile = transaction.select().from(userProfileTable).where(eq(userProfileTable.userId, userId)).get() ?? null
  return resultCreate({ profile, session, user })
}

function oidcTokenClaimsCreate(
  subject: OidcTokenSubject,
  scope: readonly string[],
  issuer: string,
  clientId: string,
  now: number,
  expiresAt: number,
): Record<string, unknown> {
  const claims: Record<string, unknown> = {
    acr: subject.session.assurance,
    amr: [subject.session.authenticationMethod],
    auth_time: Math.floor(subject.session.createdAt / 1_000),
    aud: clientId,
    exp: Math.floor(expiresAt / 1_000),
    iat: Math.floor(now / 1_000),
    iss: issuer,
    sub: subject.user.id,
  }
  if (scope.includes("email")) {
    claims.email = subject.user.email
    claims.email_verified = subject.user.emailVerifiedAt !== null
  }
  if (scope.includes("profile")) {
    claims.preferred_username = subject.user.userName
    if (subject.profile?.displayName !== null && subject.profile?.displayName !== undefined)
      claims.name = subject.profile.displayName
    if (subject.profile?.firstName !== null && subject.profile?.firstName !== undefined)
      claims.given_name = subject.profile.firstName
    if (subject.profile?.lastName !== null && subject.profile?.lastName !== undefined)
      claims.family_name = subject.profile.lastName
    if (subject.profile?.nickName !== null && subject.profile?.nickName !== undefined)
      claims.nickname = subject.profile.nickName
    if (subject.profile?.preferredLanguage !== null && subject.profile?.preferredLanguage !== undefined)
      claims.locale = subject.profile.preferredLanguage
  }
  return claims
}

function oidcTokenStoredScopeParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.pipe(v.array(oidcScopeSchema), v.minLength(1)), JSON.parse(value))
    if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
      return resultErrorCreate("oidcTokenInvalidGrant", "The token scope is invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate("oidcTokenInvalidGrant", "The token scope is invalid.")
  }
}

function oidcTokenRefreshScopeParse(requested: string | undefined, stored: string): Result<string[]> {
  const original = oidcTokenStoredScopeParse(stored)
  if (!original.success) return original
  if (requested === undefined) return original
  const values = requested.split(" ")
  const parsed = v.safeParse(v.pipe(v.array(oidcScopeSchema), v.minLength(1)), values)
  if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
    return resultErrorCreate("oidcTokenInvalidScope", "The requested scope is invalid.")
  if (parsed.output.some((scope) => !original.data.includes(scope)))
    return resultErrorCreate("oidcTokenInvalidScope", "The requested scope is invalid.")
  return resultCreate(parsed.output)
}
