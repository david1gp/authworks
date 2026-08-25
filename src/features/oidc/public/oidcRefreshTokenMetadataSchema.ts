import * as v from "valibot"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcScopeSchema } from "./oidcScopeSchema.js"

export const oidcRefreshTokenMetadataSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  clientName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  familyId: oidcResourceIdSchema,
  lastUsedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  revokedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  status: v.picklist(["active", "expired", "revoked"]),
})

export type OidcRefreshTokenMetadata = v.InferOutput<typeof oidcRefreshTokenMetadataSchema>
