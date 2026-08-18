import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../domain/oidcScopeSchema.js"

export const oidcConsentSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  realmId: oidcResourceIdSchema,
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  userId: oidcResourceIdSchema,
})

export type OidcConsent = v.InferOutput<typeof oidcConsentSchema>
