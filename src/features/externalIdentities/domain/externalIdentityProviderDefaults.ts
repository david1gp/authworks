import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"

export const externalIdentityProviderDefaults: Readonly<
  Record<ExternalIdentityProviderType, { readonly scopes: readonly string[]; readonly usesNonce: boolean }>
> = {
  github: { scopes: ["read:user", "user:email"], usesNonce: false },
  google: { scopes: ["openid", "email", "profile"], usesNonce: true },
  microsoft: { scopes: ["openid", "email", "profile"], usesNonce: true },
}
