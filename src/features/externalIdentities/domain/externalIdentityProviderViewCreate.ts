import * as v from "valibot"
import type { ExternalIdentityProvider } from "../public/externalIdentityProviderSchema.js"
import { externalIdentityProviderTypeSchema } from "../public/externalIdentityProviderTypeSchema.js"
import type { ExternalIdentityProviderRow } from "../persistence/externalIdentityProviderTable.js"

export function externalIdentityProviderViewCreate(row: ExternalIdentityProviderRow): ExternalIdentityProvider {
  let scopes: unknown
  try {
    scopes = JSON.parse(row.scopes)
  } catch (_error) {
    scopes = []
  }
  const parsedScopes = v.safeParse(v.array(v.pipe(v.string(), v.minLength(1))), scopes)
  const parsedType = v.safeParse(externalIdentityProviderTypeSchema, row.type)
  return {
    allowAccountCreation: row.allowAccountCreation,
    clientId: row.clientId,
    createdAt: row.createdAt,
    displayName: row.displayName,
    enabled: row.enabled,
    id: row.id,
    instanceId: row.instanceId,
    ...(row.organizationId === null ? {} : { organizationId: row.organizationId }),
    redirectUri: row.redirectUri,
    scopes: parsedScopes.success ? parsedScopes.output : [],
    type: parsedType.success ? parsedType.output : "google",
    updatedAt: row.updatedAt,
    version: row.version,
  }
}
