import * as v from "valibot"
import { oidcConsentSchema } from "./oidcConsentSchema.js"

export const oidcConsentListResponseSchema = v.strictObject({
  consents: v.array(oidcConsentSchema),
})

export type OidcConsentListResponse = v.InferOutput<typeof oidcConsentListResponseSchema>
