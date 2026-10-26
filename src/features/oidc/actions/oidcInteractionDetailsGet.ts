import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { sessionAuthenticate } from "../../sessions/actions/sessionAuthenticate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcInteractionDetails } from "../public/oidcInteractionDetailsSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"
import { oidcAuthorizationInteractionResolve } from "./oidcAuthorizationInteractionResolve.js"

type OidcInteractionDetailsGetOptions = {
  readonly binding?: string
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly handle: string
  readonly publicOrigin: string
  readonly realmId: string
  readonly sessionToken: string
}

/**
 * Resolves a browser interaction handle into the display details the production
 * consent view needs. Missing sessions report unauthorized so the view can offer
 * sign-in; missing, invalid, expired, or consumed handles report an invalid
 * interaction so the view shows the expired-request panel instead.
 */
export function oidcInteractionDetailsGet(options: OidcInteractionDetailsGetOptions): Result<OidcInteractionDetails> {
  const op = "oidcInteractionDetailsGet"
  const authenticated = sessionAuthenticate({
    database: options.database,
    realmId: options.realmId,
    token: options.sessionToken,
  })
  if (!authenticated.success)
    return resultErrorCodedCreate(op, "Session authorization is required.", "oidc.unauthorized")
  const interaction = oidcAuthorizationInteractionResolve({
    binding: options.binding,
    database: options.database,
    encryptionSecret: options.encryptionSecret,
    handle: options.handle,
    publicOrigin: options.publicOrigin,
    realmId: options.realmId,
  })
  if (!interaction.success) return interaction
  if (
    authenticated.data.session.realmId !== options.realmId ||
    (interaction.data.interaction.sessionId !== null &&
      interaction.data.interaction.sessionId !== authenticated.data.session.id) ||
    (interaction.data.interaction.userId !== null &&
      interaction.data.interaction.userId !== authenticated.data.actor.actorId)
  )
    return resultErrorCreate(op, "The OIDC interaction is invalid.")
  const client = oidcRepositoryCreate(options.database.db).clientGet(options.realmId, interaction.data.input.client_id)
  if (!client.success) return client
  if (client.data === null || client.data.status !== "active")
    return resultErrorCreate(op, "The OIDC interaction is invalid.")
  const scopes = v.safeParse(
    v.pipe(v.array(oidcScopeSchema), v.minLength(1), v.maxLength(100)),
    interaction.data.input.scope.split(/\s+/).filter((scope) => scope.length > 0),
  )
  if (!scopes.success) return resultErrorCreate(op, "The OIDC interaction is invalid.")
  return resultCreate({
    client_id: client.data.id,
    client_name: client.data.name,
    realm_id: options.realmId,
    redirect_uri: interaction.data.input.redirect_uri,
    scopes: scopes.output,
  })
}
