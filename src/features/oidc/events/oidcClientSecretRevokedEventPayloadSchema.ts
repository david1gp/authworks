import * as v from "valibot"

export const oidcClientSecretRevokedEventPayloadSchema = v.strictObject({ clientType: v.literal("confidential") })

export type OidcClientSecretRevokedEventPayload = v.InferOutput<typeof oidcClientSecretRevokedEventPayloadSchema>
