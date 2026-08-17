import * as v from "valibot"

export const oidcClientSecretRotatedEventPayloadSchema = v.strictObject({ clientType: v.literal("confidential") })

export type OidcClientSecretRotatedEventPayload = v.InferOutput<typeof oidcClientSecretRotatedEventPayloadSchema>
