import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { sessionAuthenticate } from "../../sessions/actions/sessionAuthenticate.js"
import { oidcAuthorizationCodeCreate } from "../domain/oidcAuthorizationCodeCreate.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcValueDecrypt } from "../domain/oidcValueEncrypt.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcAuthorizationCodeIssuedEventPayloadSchema } from "../events/oidcAuthorizationCodeIssuedEventPayloadSchema.js"
import { oidcConsentDeniedEventPayloadSchema } from "../events/oidcConsentDeniedEventPayloadSchema.js"
import { oidcConsentGrantedEventPayloadSchema } from "../events/oidcConsentGrantedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcAuthorizationConsentRequest } from "../public/oidcAuthorizationConsentRequestSchema.js"
import { oidcAuthorizationConsentRequestSchema } from "../public/oidcAuthorizationConsentRequestSchema.js"
import type { OidcAuthorizationConsentResponse } from "../public/oidcAuthorizationConsentResponseSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"

const oidcAuthorizationCodeLifetimeMs = 60 * 1_000

type OidcAuthorizationRequestConsentOptions = {
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly input: OidcAuthorizationConsentRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionToken: string
  readonly correlationId?: string
}

export function oidcAuthorizationRequestConsent(
  options: OidcAuthorizationRequestConsentOptions,
): Result<OidcAuthorizationConsentResponse> {
  const op = "oidcAuthorizationRequestConsent"
  const parsed = v.safeParse(oidcAuthorizationConsentRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The OIDC consent request is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const authenticated = sessionAuthenticate({
    database: options.database,
    realmId: options.realmId,
    runtime,
    token: options.sessionToken,
  })
  if (!authenticated.success) return resultErrorCreate(op, "Session authorization is required.")
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The OIDC consent timestamp is invalid.", undefined, "oidc.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const request = repository.authorizationRequestGet(options.realmId, parsed.output.request_id)
    if (!request.success) return request
    if (
      request.data === null ||
      request.data.userId !== authenticated.data.actor.actorId ||
      request.data.sessionId !== authenticated.data.session.id ||
      request.data.approvedAt !== null ||
      request.data.rejectedAt !== null ||
      request.data.expiresAt <= now
    )
      return resultErrorCreate(op, "The OIDC consent request is invalid.")
    const client = repository.clientGet(options.realmId, request.data.clientId)
    if (!client.success) return client
    if (client.data === null || client.data.status !== "active")
      return resultErrorCreate(op, "The OIDC consent request is invalid.")
    const scope = oidcScopeParse(request.data.scope)
    if (!scope.success) return resultErrorCreate(op, "The OIDC consent request is invalid.")
    const state =
      request.data.stateEncrypted === null
        ? resultCreate("")
        : oidcValueDecrypt(request.data.stateEncrypted, options.realmId, options.encryptionSecret)
    if (!state.success || state.data.length === 0) return resultErrorCreate(op, "The OIDC consent request is invalid.")

    if (parsed.output.decision === "deny") {
      const rejected = repository.authorizationRequestReject(options.realmId, request.data.id, now)
      if (!rejected.success) return rejected
      if (rejected.data === null) return resultErrorCreate(op, "The OIDC consent request is invalid.")
      const payload = v.safeParse(oidcConsentDeniedEventPayloadSchema, {
        clientId: request.data.clientId,
        sessionId: request.data.sessionId,
        userId: request.data.userId,
      })
      if (!payload.success) return resultErrorCreate(op, "The consent event payload is invalid.")
      const event = storageEventAppend(
        transaction,
        {
          actorId: request.data.userId,
          aggregateId: request.data.id,
          aggregateType: "oidc_authorization_request",
          aggregateVersion: 2,
          commandIndex: 1,
          correlationId,
          eventType: oidcEventTypes.consentDenied,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "oidc" },
          occurredAt: now,
          payload: payload.output,
        },
        runtime,
      )
      if (!event.success) return event
      return resultCreate<OidcAuthorizationConsentResponse>({
        approved: false,
        error: "access_denied",
        redirect_uri: request.data.redirectUri,
        state: state.data,
      })
    }

    const existing = repository.consentGet(options.realmId, request.data.userId, request.data.clientId)
    if (!existing.success) return existing
    const existingScope: Result<string[]> =
      existing.data === null ? resultCreate([]) : oidcScopeParse(existing.data.scope)
    if (!existingScope.success) return resultErrorCreate(op, "The stored OIDC consent is invalid.")
    const granted = [...new Set([...existingScope.data, ...scope.data])]
    const saved = repository.consentUpsert({
      clientId: request.data.clientId,
      createdAt: existing.data?.createdAt ?? now,
      realmId: options.realmId,
      revokedAt: null,
      scope: JSON.stringify(granted),
      updatedAt: now,
      userId: request.data.userId,
    })
    if (!saved.success) return saved
    const consentPayload = v.safeParse(oidcConsentGrantedEventPayloadSchema, {
      clientId: request.data.clientId,
      scope: granted,
      sessionId: request.data.sessionId,
      userId: request.data.userId,
    })
    if (!consentPayload.success) return resultErrorCreate(op, "The consent event payload is invalid.")
    const consentVersion = repository.consentEventVersionGet(
      options.realmId,
      request.data.userId,
      request.data.clientId,
    )
    if (!consentVersion.success) return consentVersion
    const consentEvent = storageEventAppend(
      transaction,
      {
        actorId: request.data.userId,
        aggregateId: `${request.data.userId}:${request.data.clientId}`,
        aggregateType: "oidc_consent",
        aggregateVersion: consentVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: oidcEventTypes.consentGranted,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "oidc" },
        occurredAt: now,
        payload: consentPayload.output,
      },
      runtime,
    )
    if (!consentEvent.success) return consentEvent
    const approved = repository.authorizationRequestApprove(options.realmId, request.data.id, now)
    if (!approved.success) return approved
    if (approved.data === null) return resultErrorCreate(op, "The OIDC consent request is invalid.")
    const code = oidcAuthorizationCodeCreate(runtime)
    if (!code.success) return code
    const expiresAt = now + oidcAuthorizationCodeLifetimeMs
    if (!Number.isSafeInteger(expiresAt)) return resultErrorCreate(op, "The authorization code expiry is invalid.")
    const created = repository.authorizationCodeCreate({
      clientId: request.data.clientId,
      codeChallenge: request.data.codeChallenge,
      codeChallengeMethod: request.data.codeChallengeMethod,
      createdAt: now,
      expiresAt,
      id: uuidv7Create(runtime),
      realmId: options.realmId,
      issuer: request.data.issuer,
      nonceEncrypted: request.data.nonceEncrypted,
      redirectUri: request.data.redirectUri,
      scope: JSON.stringify(scope.data),
      sessionId: request.data.sessionId,
      tokenHash: oidcHashCreate(code.data),
      userId: request.data.userId,
      usedAt: null,
    })
    if (!created.success) return created
    const codePayload = v.safeParse(oidcAuthorizationCodeIssuedEventPayloadSchema, {
      authorizationRequestId: request.data.id,
      clientId: request.data.clientId,
      expiresAt,
      nonceProvided: request.data.nonceEncrypted !== null,
      redirectUri: request.data.redirectUri,
      scope: scope.data,
      sessionId: request.data.sessionId,
      userId: request.data.userId,
    })
    if (!codePayload.success) return resultErrorCreate(op, "The authorization code event payload is invalid.")
    const codeEvent = storageEventAppend(
      transaction,
      {
        actorId: request.data.userId,
        aggregateId: created.data.id,
        aggregateType: "oidc_authorization_code",
        aggregateVersion: 1,
        commandIndex: 2,
        correlationId,
        eventType: oidcEventTypes.authorizationCodeIssued,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "oidc" },
        occurredAt: now,
        payload: codePayload.output,
      },
      runtime,
    )
    if (!codeEvent.success) return codeEvent
    return resultCreate({
      approved: true,
      code: code.data,
      expires_at: expiresAt,
      redirect_uri: request.data.redirectUri,
      state: state.data,
    })
  })
}

function oidcScopeParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.pipe(v.array(oidcScopeSchema), v.minLength(1)), JSON.parse(value))
    if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
      return resultErrorCreate("oidcScopeParse", "The OIDC consent scope is invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate("oidcScopeParse", "The OIDC consent scope is invalid.")
  }
}
