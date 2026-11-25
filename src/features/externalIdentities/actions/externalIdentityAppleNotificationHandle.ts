import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import { providerJwtClaimsVerify } from "../domain/externalIdentityProviderPortCreate.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityAppleNotificationResponse } from "../public/externalIdentityAppleNotificationResponseSchema.js"
import { externalIdentityProviderGet } from "./externalIdentityProviderGet.js"

type ExternalIdentityAppleNotificationHandleOptions = {
  readonly database: StorageDatabase
  readonly fetch?: typeof fetch
  readonly payload: string
  readonly providerId: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now">
  readonly timeoutMs?: number
}

const appleNotificationIssuer = "https://appleid.apple.com"
const appleNotificationJwksEndpoint = "https://appleid.apple.com/auth/keys"
// The Contentoren group primary App ID is accepted as an S2S audience next to the
// provider's own Services ID, since Apple signs for either one.
const appleNotificationGroupAudience = "de.contentoren.signin"

/**
 * Handles an Apple server-to-server notification for an Apple-type external identity
 * provider. The signed `payload` JWT is verified against Apple's JWKS (issuer
 * `https://appleid.apple.com`, audience = provider client id or the Contentoren group
 * App ID). `email-disabled`/`email-enabled` set/clear the user's relay flag;
 * `consent-revoked`/`account-delete` remove only the external identity row, never the
 * user. Valid payloads with an unknown subject succeed as no-ops; anything else is
 * invalid.
 */
export async function externalIdentityAppleNotificationHandle(
  options: ExternalIdentityAppleNotificationHandleOptions,
): Promise<Result<ExternalIdentityAppleNotificationResponse>> {
  const op = "externalIdentityAppleNotificationHandle"
  const invalid = (errorMessage: string) => resultErrorCreate(op, errorMessage, "external-identities.invalid")
  const provider = externalIdentityProviderGet({
    database: options.database,
    includeDisabled: true,
    providerId: options.providerId,
    realmId: options.realmId,
  })
  if (!provider.success || provider.data.provider.type !== "apple")
    return invalid("The Apple notification provider is invalid.")
  const claims = await providerJwtClaimsVerify(
    options.fetch ?? fetch,
    options.timeoutMs ?? 10_000,
    appleNotificationJwksEndpoint,
    options.payload,
    { allowMissingExpiration: true },
  )
  if (!claims.success) return invalid(claims.errorMessage)
  if (claims.data.iss !== appleNotificationIssuer) return invalid("The Apple notification issuer is invalid.")
  if (!appleNotificationAudienceIsValid(claims.data.aud, provider.data.provider.clientId))
    return invalid("The Apple notification audience is invalid.")
  let events = claims.data.events
  if (typeof events === "string") {
    try {
      events = JSON.parse(events) as unknown
    } catch (_error) {
      return invalid("The Apple notification events are invalid.")
    }
  }
  if (typeof events !== "object" || events === null || Array.isArray(events))
    return invalid("The Apple notification events are invalid.")
  const eventType = (events as Record<string, unknown>).type
  const subject = (events as Record<string, unknown>).sub
  if (typeof eventType !== "string" || eventType.length === 0 || typeof subject !== "string" || subject.length === 0)
    return invalid("The Apple notification event is invalid.")
  const repository = externalIdentityRepositoryCreate(options.database.db)
  const identity = repository.externalIdentityGetByProviderSubject(options.realmId, options.providerId, subject)
  if (!identity.success) return identity
  if (identity.data === null) return resultCreate({ received: true as const })
  switch (eventType) {
    case "email-disabled":
    case "email-enabled": {
      const runtime = options.runtime ?? options.database.runtime
      const now = runtime.now()
      if (!Number.isSafeInteger(now) || now < 0)
        return resultErrorCreate(
          op,
          "The Apple notification timestamp is invalid.",
          "external-identities.invalid-timestamp",
        )
      const users = userRepositoryCreate(options.database.db)
      const current = users.userGet(options.realmId, identity.data.userId)
      if (!current.success) return current
      if (current.data === null) return resultCreate({ received: true as const })
      const updated = users.userUpdate(options.realmId, identity.data.userId, {
        appleRelayEmailDisabledAt: eventType === "email-disabled" ? now : null,
        updatedAt: now,
        version: current.data.version + 1,
      })
      if (!updated.success) return updated
      return resultCreate({ received: true as const })
    }
    case "account-delete":
    case "consent-revoked": {
      const removed = repository.externalIdentityDelete(
        options.realmId,
        identity.data.userId,
        options.providerId,
        subject,
      )
      if (!removed.success) return removed
      return resultCreate({ received: true as const })
    }
    default:
      return resultCreate({ received: true as const })
  }
}

function appleNotificationAudienceIsValid(audience: unknown, clientId: string): boolean {
  const audiences =
    typeof audience === "string"
      ? [audience]
      : Array.isArray(audience)
        ? audience.filter((candidate): candidate is string => typeof candidate === "string")
        : []
  return audiences.includes(clientId) || audiences.includes(appleNotificationGroupAudience)
}
