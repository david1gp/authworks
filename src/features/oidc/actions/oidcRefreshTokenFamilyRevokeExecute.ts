import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { oidcAccessTokenRevokedEventPayloadSchema } from "../events/oidcAccessTokenRevokedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRefreshTokenFamilyRevokedEventPayloadSchema } from "../events/oidcRefreshTokenFamilyRevokedEventPayloadSchema.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"

type OidcRefreshTokenFamilyOwner = {
  readonly clientId: string
  readonly familyId: string
  readonly realmId: string
  readonly sessionId: string
  readonly userId: string
}

export function oidcRefreshTokenFamilyRevokeExecute(options: {
  readonly correlationId: string
  readonly family: OidcRefreshTokenFamilyOwner
  readonly now: number
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly transaction: StorageTransaction
}): Result<boolean> {
  const repository = oidcRepositoryCreate(options.transaction)
  const refreshRevoked = repository.refreshTokenOwnedFamilyRevoke(
    options.family.realmId,
    options.family.userId,
    options.family.familyId,
    options.now,
  )
  if (!refreshRevoked.success) return refreshRevoked
  const accessRevoked = repository.accessTokenOwnedFamilyRevoke(
    options.family.realmId,
    options.family.userId,
    options.family.familyId,
    options.now,
  )
  if (!accessRevoked.success) return accessRevoked
  if (refreshRevoked.data.length === 0 && accessRevoked.data.length === 0) return resultCreate(false)

  let commandIndex = 0
  for (const access of accessRevoked.data) {
    const payload = v.safeParse(oidcAccessTokenRevokedEventPayloadSchema, {
      clientId: access.clientId,
      sessionId: access.sessionId,
      userId: access.userId,
    })
    if (!payload.success)
      return resultErrorCodedCreate(
        "oidcRefreshTokenFamilyRevokeExecute",
        "The access-token revocation event payload is invalid.",
        "oidc.event-invalid",
      )
    const event = eventSecurityEventAppend(
      options.transaction,
      {
        actorId: options.family.userId,
        aggregateId: access.id,
        aggregateType: "oidc_access_token",
        aggregateVersion: 2,
        commandIndex,
        correlationId: options.correlationId,
        eventType: oidcEventTypes.accessTokenRevoked,
        realmId: options.family.realmId,
        metadata: { auditSafe: true, source: "oidc" },
        occurredAt: options.now,
        payload: payload.output,
        userSubjectId: access.userId,
      },
      options.runtime,
    )
    if (!event.success) return event
    commandIndex += 1
  }

  const familyPayload = v.safeParse(oidcRefreshTokenFamilyRevokedEventPayloadSchema, {
    clientId: options.family.clientId,
    familyId: options.family.familyId,
    sessionId: options.family.sessionId,
    userId: options.family.userId,
  })
  if (!familyPayload.success)
    return resultErrorCodedCreate(
      "oidcRefreshTokenFamilyRevokeExecute",
      "The refresh-token family revocation event payload is invalid.",
      "oidc.event-invalid",
    )
  const familyEvent = eventSecurityEventAppend(
    options.transaction,
    {
      actorId: options.family.userId,
      aggregateId: options.family.familyId,
      aggregateType: "oidc_refresh_token_family",
      aggregateVersion: 1,
      commandIndex,
      correlationId: options.correlationId,
      eventType: oidcEventTypes.refreshTokenFamilyRevoked,
      realmId: options.family.realmId,
      metadata: { auditSafe: true, source: "oidc" },
      occurredAt: options.now,
      payload: familyPayload.output,
      userSubjectId: options.family.userId,
    },
    options.runtime,
  )
  if (!familyEvent.success) return familyEvent
  return resultCreate(true)
}
