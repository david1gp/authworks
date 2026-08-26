import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"

export type ExternalIdentityProviderIdentity = {
  readonly displayName?: string
  readonly email?: string
  readonly emailVerified: boolean
  readonly externalSubject: string
  readonly issuer?: string
  readonly nonce?: string
  readonly picture?: string
  readonly providerType: ExternalIdentityProviderType
  readonly username?: string
}
