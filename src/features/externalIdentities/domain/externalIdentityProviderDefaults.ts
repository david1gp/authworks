import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"

export const externalIdentityProviderDefaults: Readonly<
  Record<
    ExternalIdentityProviderType,
    {
      readonly allowedScopes: readonly string[]
      readonly requiredScopes: readonly string[]
      readonly scopes: readonly string[]
      readonly usesNonce: boolean
    }
  >
> = {
  github: {
    allowedScopes: ["read:user", "user:email"],
    requiredScopes: ["read:user", "user:email"],
    scopes: ["read:user", "user:email"],
    usesNonce: false,
  },
  google: {
    allowedScopes: ["openid", "email", "profile"],
    requiredScopes: ["openid", "email"],
    scopes: ["openid", "email", "profile"],
    usesNonce: true,
  },
  microsoft: {
    allowedScopes: ["openid", "email", "profile"],
    requiredScopes: ["openid", "email"],
    scopes: ["openid", "email", "profile"],
    usesNonce: true,
  },
}
