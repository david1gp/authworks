import * as v from "valibot"
import { externalIdentityProviderTypeSchema } from "./externalIdentityProviderTypeSchema.js"

export const externalIdentityProviderCreateRequestSchema = v.pipe(
  v.strictObject({
    allowAccountCreation: v.optional(v.boolean(), false),
    appleKeyId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(32))),
    appleTeamId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(32))),
    clientId: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
    clientSecret: v.pipe(v.string(), v.minLength(1), v.maxLength(4096)),
    displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    issuer: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
    organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
    redirectUri: v.pipe(v.string(), v.url(), v.maxLength(2048)),
    scopes: v.optional(v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(128))), v.maxLength(32))),
    type: externalIdentityProviderTypeSchema,
  }),
  v.check(
    (input) => (input.type === "oidc" ? input.issuer !== undefined : input.issuer === undefined),
    "The OIDC issuer is required for generic providers and forbidden otherwise.",
  ),
  v.check(
    (input) =>
      input.type === "apple"
        ? input.appleTeamId !== undefined && input.appleKeyId !== undefined
        : input.appleTeamId === undefined && input.appleKeyId === undefined,
    "Apple providers require a team ID and key ID; other providers forbid them.",
  ),
)

export type ExternalIdentityProviderCreateRequest = v.InferOutput<typeof externalIdentityProviderCreateRequestSchema>
