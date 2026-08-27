import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcScopeSchema } from "./oidcScopeSchema.js"

export const oidcConsentSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  realmId: oidcResourceIdSchema,
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  userId: userResourceIdSchema,
})

export type OidcConsent = v.InferOutput<typeof oidcConsentSchema>
