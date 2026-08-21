import * as v from "valibot"
import { oidcPublicJwkSchema } from "./oidcPublicJwkSchema.js"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcSigningKeyStatusSchema } from "./oidcSigningKeyStatusSchema.js"

export const oidcSigningKeySchema = v.strictObject({
  algorithm: v.literal("RS256"),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: oidcResourceIdSchema,
  realmId: oidcResourceIdSchema,
  publicJwk: oidcPublicJwkSchema,
  retiredAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  status: oidcSigningKeyStatusSchema,
})

export type OidcSigningKey = v.InferOutput<typeof oidcSigningKeySchema>
