import * as v from "valibot"

export const oidcSigningKeyLifecycleRequestSchema = v.strictObject({ status: v.literal("retired") })

export type OidcSigningKeyLifecycleRequest = v.InferOutput<typeof oidcSigningKeyLifecycleRequestSchema>
