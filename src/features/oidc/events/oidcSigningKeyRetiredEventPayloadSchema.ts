import * as v from "valibot"

export const oidcSigningKeyRetiredEventPayloadSchema = v.strictObject({ status: v.literal("retired") })

export type OidcSigningKeyRetiredEventPayload = v.InferOutput<typeof oidcSigningKeyRetiredEventPayloadSchema>
