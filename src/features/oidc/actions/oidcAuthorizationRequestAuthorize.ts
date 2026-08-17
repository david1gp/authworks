import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
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
import { oidcConsentGrantedEventPayloadSchema } from "../events/oidcConsentGrantedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcAuthorizationRequest } from "../public/oidcAuthorizationRequestSchema.js"
import { oidcAuthorizationRequestSchema } from "../public/oidcAuthorizationRequestSchema.js"
import type { OidcAuthorizationResponse } from "../public/oidcAuthorizationResponseSchema.js"
import type { OidcAuthorizationConsentRequired } from "../public/oidcAuthorizationConsentRequiredSchema.js"

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

type OidcAuthorizationTransactionResult =
  | { readonly kind: "consent"; readonly response: OidcAuthorizationConsentRequired }
  | { readonly kind: "issued"; readonly response: OidcAuthorizationResponse }

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
  if (
    oidcAuthorizationRequiresMultiFactor(parsed.output.acr_values) &&
    authenticated.data.session.assurance !== "multi_factor"
  )
    return resultErrorCreate("oidcAuthorizationInsufficientAssurance", "Multi-factor session assurance is required.")

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
  const authorizationRequestId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const state = oidcValueEncrypt(parsed.output.state, options.instanceId, options.encryptionSecret)
  if (!state.success) return state
  const nonce =
    parsed.output.nonce === undefined
      ? resultCreate<string | null>(null)
      : oidcValueEncrypt(parsed.output.nonce, options.instanceId, options.encryptionSecret)
  if (!nonce.success) return nonce
  const requestExpiresAt = now + oidcAuthorizationRequestLifetimeMs
  if (!Number.isSafeInteger(requestExpiresAt)) return resultErrorCreate(op, "The OIDC authorization expiry is invalid.")

  const completed = storageTransactionRun<OidcAuthorizationTransactionResult>(options.database, (transaction) => {
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
    const consent = repository.consentGet(options.instanceId, authenticated.data.actor.actorId, parsed.output.client_id)
    if (!consent.success) return consent
    const grantedScope = consent.data === null ? resultCreate<string[]>([]) : oidcStoredScopeParse(consent.data.scope)
    if (!grantedScope.success) return resultErrorCreate(op, "The stored OIDC consent is invalid.")
    const consentSatisfied = oidcScopeIncludes(grantedScope.data, scope.data)
    const consentRequired = client.data.requireConsent === 1 && client.data.trusted !== 1 && !consentSatisfied
    if (consentRequired && parsed.output.prompt === "none")
      return resultErrorCreate("oidcAuthorizationInteractionRequired", "User interaction is required.")

    const request = repository.authorizationRequestCreate({
      approvedAt: consentRequired ? null : now,
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

    if (consentRequired) {
      return resultCreate({
        kind: "consent",
        response: {
          client_id: parsed.output.client_id,
          consent_required: true,
          redirect_uri: parsed.output.redirect_uri,
          request_id: authorizationRequestId,
          scope: scope.data,
          state: parsed.output.state,
        },
      })
    }

    const granted = oidcConsentScopeCreate(grantedScope.data, scope.data)
    if (!oidcScopeIncludes(grantedScope.data, granted)) {
      const saved = repository.consentUpsert({
        clientId: parsed.output.client_id,
        createdAt: consent.data?.createdAt ?? now,
        instanceId: options.instanceId,
        revokedAt: null,
        scope: JSON.stringify(granted),
        updatedAt: now,
        userId: authenticated.data.actor.actorId,
      })
      if (!saved.success) return saved
      const consentPayload = v.safeParse(oidcConsentGrantedEventPayloadSchema, {
        clientId: parsed.output.client_id,
        scope: granted,
        sessionId: authenticated.data.session.id,
        userId: authenticated.data.actor.actorId,
      })
      if (!consentPayload.success) return resultErrorCreate(op, "The consent event payload is invalid.")
      const consentVersion = repository.consentEventVersionGet(
        options.instanceId,
        authenticated.data.actor.actorId,
        parsed.output.client_id,
      )
      if (!consentVersion.success) return consentVersion
      const consentEvent = storageEventAppend(
        transaction,
        {
          actorId: authenticated.data.actor.actorId,
          aggregateId: `${authenticated.data.actor.actorId}:${parsed.output.client_id}`,
          aggregateType: "oidc_consent",
          aggregateVersion: consentVersion.data + 1,
          commandIndex: 1,
          correlationId,
          eventType: oidcEventTypes.consentGranted,
          instanceId: options.instanceId,
          metadata: { auditSafe: true, source: "oidc" },
          occurredAt: now,
          payload: consentPayload.output,
        },
        runtime,
      )
      if (!consentEvent.success) return consentEvent
    }

    return oidcAuthorizationCodeIssue({
      authorizationRequestId,
      clientId: parsed.output.client_id,
      codeChallenge: parsed.output.code_challenge,
      codeChallengeMethod: parsed.output.code_challenge_method,
      correlationId,
      expiresAt: now + oidcAuthorizationCodeLifetimeMs,
      instanceId: options.instanceId,
      issuer,
      nonceEncrypted: nonce.data,
      now,
      redirectUri: parsed.output.redirect_uri,
      runtime,
      scope: scope.data,
      sessionId: authenticated.data.session.id,
      state: parsed.output.state,
      transaction,
      userId: authenticated.data.actor.actorId,
    })
  })
  if (!completed.success) return completed
  if (completed.data.kind === "consent")
    return resultErrorCreate(
      "oidcAuthorizationConsentRequired",
      "User consent is required.",
      JSON.stringify(completed.data.response),
    )
  return resultCreate(completed.data.response)
}

function oidcAuthorizationRequiresMultiFactor(value: string | undefined): boolean {
  return value?.split(" ").includes("multi_factor") ?? false
}

type OidcAuthorizationCodeIssueOptions = {
  readonly authorizationRequestId: string
  readonly clientId: string
  readonly codeChallenge: string
  readonly codeChallengeMethod: "S256"
  readonly correlationId: string
  readonly expiresAt: number
  readonly instanceId: string
  readonly issuer: string
  readonly nonceEncrypted: string | null
  readonly now: number
  readonly redirectUri: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly scope: string[]
  readonly sessionId: string
  readonly state: string
  readonly transaction: StorageTransaction
  readonly userId: string
}

function oidcAuthorizationCodeIssue(
  options: OidcAuthorizationCodeIssueOptions,
): Result<OidcAuthorizationTransactionResult> {
  if (!Number.isSafeInteger(options.expiresAt) || options.expiresAt <= options.now)
    return resultErrorCreate("oidcAuthorizationRequestAuthorize", "The authorization code expiry is invalid.")
  const authorizationCode = oidcAuthorizationCodeCreate(options.runtime)
  if (!authorizationCode.success) return authorizationCode
  const repository = oidcRepositoryCreate(options.transaction)
  const code = repository.authorizationCodeCreate({
    clientId: options.clientId,
    codeChallenge: options.codeChallenge,
    codeChallengeMethod: options.codeChallengeMethod,
    createdAt: options.now,
    expiresAt: options.expiresAt,
    id: uuidv7Create(options.runtime),
    instanceId: options.instanceId,
    issuer: options.issuer,
    nonceEncrypted: options.nonceEncrypted,
    redirectUri: options.redirectUri,
    scope: JSON.stringify(options.scope),
    sessionId: options.sessionId,
    tokenHash: oidcHashCreate(authorizationCode.data),
    userId: options.userId,
    usedAt: null,
  })
  if (!code.success) return code
  const payload = v.safeParse(oidcAuthorizationCodeIssuedEventPayloadSchema, {
    authorizationRequestId: options.authorizationRequestId,
    clientId: options.clientId,
    expiresAt: options.expiresAt,
    nonceProvided: options.nonceEncrypted !== null,
    redirectUri: options.redirectUri,
    scope: options.scope,
    sessionId: options.sessionId,
    userId: options.userId,
  })
  if (!payload.success)
    return resultErrorCreate("oidcAuthorizationRequestAuthorize", "The authorization code event payload is invalid.")
  const event = storageEventAppend(
    options.transaction,
    {
      actorId: options.userId,
      aggregateId: code.data.id,
      aggregateType: "oidc_authorization_code",
      aggregateVersion: 1,
      commandIndex: 2,
      correlationId: options.correlationId,
      eventType: oidcEventTypes.authorizationCodeIssued,
      instanceId: options.instanceId,
      metadata: { auditSafe: true, source: "oidc" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({
    kind: "issued",
    response: {
      code: authorizationCode.data,
      expires_at: options.expiresAt,
      redirect_uri: options.redirectUri,
      state: options.state,
    },
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

function oidcStoredScopeParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.pipe(v.array(oidcScopeSchema), v.minLength(1)), JSON.parse(value))
    if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
      return resultErrorCreate("oidcStoredScopeParse", "The stored OIDC consent is invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate("oidcStoredScopeParse", "The stored OIDC consent is invalid.")
  }
}

function oidcScopeIncludes(granted: readonly string[], requested: readonly string[]): boolean {
  return requested.every((scope) => granted.includes(scope))
}

function oidcConsentScopeCreate(existing: readonly string[], requested: readonly string[]): string[] {
  return [...new Set([...existing, ...requested])]
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
