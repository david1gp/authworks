import * as v from "valibot"

export const oidcRefreshTokenRevokeResponseSchema = v.strictObject({ revoked: v.boolean() })

export type OidcRefreshTokenRevokeResponse = v.InferOutput<typeof oidcRefreshTokenRevokeResponseSchema>
