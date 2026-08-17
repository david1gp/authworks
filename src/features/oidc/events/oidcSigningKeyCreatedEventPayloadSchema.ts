import * as v from "valibot"

export const oidcSigningKeyCreatedEventPayloadSchema = v.strictObject({ algorithm: v.literal("RS256") })

export type OidcSigningKeyCreatedEventPayload = v.InferOutput<typeof oidcSigningKeyCreatedEventPayloadSchema>
