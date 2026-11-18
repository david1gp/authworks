import * as v from "valibot"
import {
  type ExternalIdentityProviderCreateRequest,
  externalIdentityProviderCreateRequestSchema,
} from "../../externalIdentities/public/externalIdentityProviderCreateRequestSchema.js"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"

export type OrganizationAdminProviderCreateInput = {
  readonly allowAccountCreation: boolean
  readonly appleKeyId: string
  readonly appleTeamId: string
  readonly clientId: string
  readonly clientSecret: string
  readonly displayName: string
  readonly issuer: string
  readonly redirectUri: string
  readonly scopesText: string
  readonly type: ExternalIdentityProviderType
}

/** Builds the provider create request from raw form input. Returns undefined when the input is invalid. */
export function organizationAdminProviderCreateRequestBuild(
  input: OrganizationAdminProviderCreateInput,
): ExternalIdentityProviderCreateRequest | undefined {
  const scopes = input.scopesText
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)
  const issuer = input.issuer.trim()
  const appleTeamId = input.appleTeamId.trim()
  const appleKeyId = input.appleKeyId.trim()
  const parsed = v.safeParse(externalIdentityProviderCreateRequestSchema, {
    allowAccountCreation: input.allowAccountCreation,
    ...(appleKeyId.length === 0 ? {} : { appleKeyId }),
    ...(appleTeamId.length === 0 ? {} : { appleTeamId }),
    clientId: input.clientId.trim(),
    clientSecret: input.clientSecret,
    displayName: input.displayName.trim(),
    ...(issuer.length === 0 ? {} : { issuer }),
    redirectUri: input.redirectUri.trim(),
    ...(scopes.length === 0 ? {} : { scopes }),
    type: input.type,
  })
  return parsed.success ? parsed.output : undefined
}
