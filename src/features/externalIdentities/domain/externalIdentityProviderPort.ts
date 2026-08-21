import type { Result } from "#result"
import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"
import type { ExternalIdentityProviderIdentity } from "./externalIdentityProviderIdentity.js"

export type ExternalIdentityProviderPortConfiguration = {
  readonly clientId: string
  readonly clientSecret: string
  readonly redirectUri: string
  readonly scopes: readonly string[]
  readonly type: ExternalIdentityProviderType
}

export type ExternalIdentityProviderPortStartInput = {
  readonly nonce?: string
  readonly pkceChallenge: string
  readonly state: string
}

export type ExternalIdentityProviderPortCallbackInput = {
  readonly code: string
  readonly nonce?: string
  readonly pkceVerifier: string
}

export type ExternalIdentityProviderPort = {
  readonly authorizationUrlCreate: (
    configuration: ExternalIdentityProviderPortConfiguration,
    input: ExternalIdentityProviderPortStartInput,
  ) => Result<string>
  readonly callbackExchange: (
    configuration: ExternalIdentityProviderPortConfiguration,
    input: ExternalIdentityProviderPortCallbackInput,
  ) => Promise<Result<ExternalIdentityProviderIdentity>>
}

export type ExternalIdentityProviderPorts = Partial<Record<ExternalIdentityProviderType, ExternalIdentityProviderPort>>
