import * as v from "valibot"
import { oidcClientIdSchema } from "./oidcClientIdSchema.js"

const oidcRevokeTokenValueSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(4096))
const oidcRevokeClientSecretSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(512))

export const oidcTokenRevokeRequestSchema = v.strictObject({
  client_id: v.optional(oidcClientIdSchema),
  client_secret: v.optional(oidcRevokeClientSecretSchema),
  token: oidcRevokeTokenValueSchema,
  token_type_hint: v.optional(v.picklist(["access_token", "refresh_token"])),
})

export type OidcTokenRevokeRequest = v.InferOutput<typeof oidcTokenRevokeRequestSchema>
