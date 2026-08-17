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
import { sessionAuthenticate } from "../../sessions/actions/sessionAuthenticate.js"
import { oidcAuthorizationCodeCreate } from "../domain/oidcAuthorizationCodeCreate.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcIssuerCreate } from "../domain/oidcIssuerCreate.js"
import { oidcRedirectUriMatches } from "../domain/oidcRedirectUriMatches.js"
import { oidcScopeSchema } from "../domain/oidcScopeSchema.js"
import { oidcValueEncrypt } from "../domain/oidcValueEncrypt.js"
import { oidcAuthorizationCodeIssuedEventPayloadSchema } from "../events/oidcAuthorizationCodeIssuedEventPayloadSchema.js"
import { oidcAuthorizationRequestValidatedEventPayloadSchema } from "../events/oidcAuthorizationRequestValidatedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcAuthorizationRequest } from "../public/oidcAuthorizationRequestSchema.js"
import { oidcAuthorizationRequestSchema } from "../public/oidcAuthorizationRequestSchema.js"
import type { OidcAuthorizationResponse } from "../public/oidcAuthorizationResponseSchema.js"

const oidcAuthorizationRequestLifetimeMs = 5 * 60 * 1_000
const oidcAuthorizationCodeLifetimeMs = 60 * 1_000

type OidcAuthorizationRequestAuthorizeOptions = {
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly input: OidcAuthorizationRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionToken: string
  readonly correlationId?: string
}

export function oidcAuthorizationRequestAuthorize(
  options: OidcAuthorizationRequestAuthorizeOptions,
): Result<OidcAuthorizationResponse> {
  const op = "oidcAuthorizationRequestAuthorize"
  const parsed = v.safeParse(oidcAuthorizationRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The OIDC authorization request is invalid.")
  if (options.instanceId.length === 0) return resultErrorCreate(op, "The OIDC authorization request is invalid.")

  const runtime = options.runtime ?? options.database.runtime
  const authenticated = sessionAuthenticate({
    database: options.database,
    instanceId: options.instanceId,
    runtime,
    token: options.sessionToken,
  })
  if (!authenticated.success) return resultErrorCreate(op, "Session authorization is required.")
  if (authenticated.data.session.assurance === "none")
    return resultErrorCreate(op, "Session authorization is required.")

  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The OIDC authorization timestamp is invalid.")
  const instance = instanceGet({
    context: instanceSystemContextCreate(),
    database: options.database,
    instanceId: options.instanceId,
  })
  if (!instance.success) return instance
  if (instance.data.instance.status !== "active") return resultErrorCreate(op, "The instance is not active.")
  const issuer = oidcIssuerCreate(instance.data.instance.domain)

  const authorizationCode = oidcAuthorizationCodeCreate(runtime)
  if (!authorizationCode.success) return authorizationCode
  const authorizationRequestId = uuidv7Create(runtime)
  const authorizationCodeId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const state = oidcValueEncrypt(parsed.output.state, options.instanceId, options.encryptionSecret)
  if (!state.success) return state
  const nonce =
    parsed.output.nonce === undefined
      ? resultCreate<string | null>(null)
      : oidcValueEncrypt(parsed.output.nonce, options.instanceId, options.encryptionSecret)
  if (!nonce.success) return nonce
  const requestExpiresAt = now + oidcAuthorizationRequestLifetimeMs
  const codeExpiresAt = now + oidcAuthorizationCodeLifetimeMs
  if (!Number.isSafeInteger(requestExpiresAt) || !Number.isSafeInteger(codeExpiresAt))
    return resultErrorCreate(op, "The OIDC authorization expiry is invalid.")

  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const client = repository.clientGet(options.instanceId, parsed.output.client_id)
    if (!client.success) return client
    if (client.data === null || client.data.status !== "active")
      return resultErrorCreate(op, "The OIDC client was not found.")

    const redirectUris = oidcStringArrayParse(client.data.redirectUris)
    if (!redirectUris.success) return resultErrorCreate(op, "The OIDC client configuration is invalid.")
    const redirect = oidcRedirectUriMatches(parsed.output.redirect_uri, redirectUris.data)
    if (!redirect.success) return resultErrorCreate(op, "The redirect URI is not registered.")

    const allowedScopes = oidcStringArrayParse(client.data.allowedScopes)
    if (!allowedScopes.success) return resultErrorCreate(op, "The OIDC client configuration is invalid.")
    const scope = oidcAuthorizationScopeParse(parsed.output.scope, allowedScopes.data)
    if (!scope.success) return scope

    const request = repository.authorizationRequestCreate({
      approvedAt: now,
      clientId: parsed.output.client_id,
      codeChallenge: parsed.output.code_challenge,
      codeChallengeMethod: parsed.output.code_challenge_method,
      createdAt: now,
      expiresAt: requestExpiresAt,
      id: authorizationRequestId,
      instanceId: options.instanceId,
      issuer,
      nonceEncrypted: nonce.data,
      prompt: parsed.output.prompt ?? null,
      redirectUri: parsed.output.redirect_uri,
      rejectedAt: null,
      scope: JSON.stringify(scope.data),
      sessionId: authenticated.data.session.id,
      stateEncrypted: state.data,
      userId: authenticated.data.actor.actorId,
    })
    if (!request.success) return request

    const requestPayload = v.safeParse(oidcAuthorizationRequestValidatedEventPayloadSchema, {
      clientId: parsed.output.client_id,
      codeChallengeMethod: parsed.output.code_challenge_method,
      nonceProvided: parsed.output.nonce !== undefined,
      redirectUri: parsed.output.redirect_uri,
      scope: scope.data,
      sessionId: authenticated.data.session.id,
      stateProvided: true,
      userId: authenticated.data.actor.actorId,
    })
    if (!requestPayload.success) return resultErrorCreate(op, "The authorization request event payload is invalid.")
    const requestEvent = storageEventAppend(
      transaction,
      {
        actorId: authenticated.data.actor.actorId,
        aggregateId: authorizationRequestId,
        aggregateType: "oidc_authorization_request",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: oidcEventTypes.authorizationRequestValidated,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "oidc" },
        occurredAt: now,
        payload: requestPayload.output,
      },
      runtime,
    )
    if (!requestEvent.success) return requestEvent

    const code = repository.authorizationCodeCreate({
      clientId: parsed.output.client_id,
      codeChallenge: parsed.output.code_challenge,
      codeChallengeMethod: parsed.output.code_challenge_method,
      createdAt: now,
      expiresAt: codeExpiresAt,
      id: authorizationCodeId,
      instanceId: options.instanceId,
      issuer,
      nonceEncrypted: nonce.data,
      redirectUri: parsed.output.redirect_uri,
      scope: JSON.stringify(scope.data),
      sessionId: authenticated.data.session.id,
      tokenHash: oidcHashCreate(authorizationCode.data),
      userId: authenticated.data.actor.actorId,
      usedAt: null,
    })
    if (!code.success) return code

    const codePayload = v.safeParse(oidcAuthorizationCodeIssuedEventPayloadSchema, {
      authorizationRequestId,
      clientId: parsed.output.client_id,
      expiresAt: codeExpiresAt,
      nonceProvided: parsed.output.nonce !== undefined,
      redirectUri: parsed.output.redirect_uri,
      scope: scope.data,
      sessionId: authenticated.data.session.id,
      userId: authenticated.data.actor.actorId,
    })
    if (!codePayload.success) return resultErrorCreate(op, "The authorization code event payload is invalid.")
    const codeEvent = storageEventAppend(
      transaction,
      {
        actorId: authenticated.data.actor.actorId,
        aggregateId: authorizationCodeId,
        aggregateType: "oidc_authorization_code",
        aggregateVersion: 1,
        commandIndex: 1,
        correlationId,
        eventType: oidcEventTypes.authorizationCodeIssued,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "oidc" },
        occurredAt: now,
        payload: codePayload.output,
      },
      runtime,
    )
    if (!codeEvent.success) return codeEvent
    return resultCreate({
      code: authorizationCode.data,
      expires_at: codeExpiresAt,
      redirect_uri: parsed.output.redirect_uri,
      state: parsed.output.state,
    })
  })
}

function oidcAuthorizationScopeParse(scope: string, allowedScopes: readonly string[]): Result<string[]> {
  const op = "oidcAuthorizationScopeParse"
  const values = scope.split(" ")
  if (values.length === 0 || values.some((value) => value.length === 0))
    return resultErrorCreate(op, "The OIDC scope is invalid.")
  const parsed = v.safeParse(v.array(oidcScopeSchema), values)
  if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
    return resultErrorCreate(op, "The OIDC scope is invalid.")
  if (!parsed.output.includes("openid")) return resultErrorCreate(op, "The openid scope is required.")
  if (parsed.output.some((value) => !allowedScopes.includes(value)))
    return resultErrorCreate(op, "The requested scope is not allowed.")
  return resultCreate(parsed.output)
}

function oidcStringArrayParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))), JSON.parse(value))
    if (!parsed.success) return resultErrorCreate("oidcStringArrayParse", "The OIDC client configuration is invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate("oidcStringArrayParse", "The OIDC client configuration is invalid.")
  }
}
