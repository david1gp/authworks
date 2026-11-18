import * as v from "valibot"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import {
  type ExternalIdentityProviderUpdateRequest,
  externalIdentityProviderUpdateRequestSchema,
} from "../../externalIdentities/public/externalIdentityProviderUpdateRequestSchema.js"

export type OrganizationAdminProviderEditDraft = {
  readonly appleKeyId: string
  readonly appleTeamId: string
  readonly clientId: string
  readonly displayName: string
  readonly issuer: string
  readonly redirectUri: string
  readonly scopesText: string
}

/** Snapshots editable provider fields into a fresh edit draft. The client secret is never snapshotted. */
export function organizationAdminProviderEditDraftCreate(
  provider: ExternalIdentityProvider,
): OrganizationAdminProviderEditDraft {
  return {
    appleKeyId: provider.appleKeyId ?? "",
    appleTeamId: provider.appleTeamId ?? "",
    clientId: provider.clientId,
    displayName: provider.displayName,
    issuer: provider.issuer ?? "",
    redirectUri: provider.redirectUri,
    scopesText: provider.scopes.join(", "),
  }
}

function organizationAdminProviderScopesTextParse(scopesText: string): string[] {
  return scopesText
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)
}

/**
 * Builds the provider update request from an edit draft. Returns undefined when the draft is
 * invalid: blank display name, client ID, or redirect URI, a blank issuer on generic OIDC
 * rows, or a blank team/key ID on Apple rows.
 */
export function organizationAdminProviderEditRequestBuild(
  provider: ExternalIdentityProvider,
  edit: OrganizationAdminProviderEditDraft,
): ExternalIdentityProviderUpdateRequest | undefined {
  const clientId = edit.clientId.trim()
  const displayName = edit.displayName.trim()
  const redirectUri = edit.redirectUri.trim()
  const issuer = edit.issuer.trim()
  const appleTeamId = edit.appleTeamId.trim()
  const appleKeyId = edit.appleKeyId.trim()
  if (clientId.length === 0 || displayName.length === 0 || redirectUri.length === 0) return undefined
  if (provider.type === "oidc" && issuer.length === 0) return undefined
  if (provider.type === "apple" && (appleTeamId.length === 0 || appleKeyId.length === 0)) return undefined
  const scopes = organizationAdminProviderScopesTextParse(edit.scopesText)
  const parsed = v.safeParse(externalIdentityProviderUpdateRequestSchema, {
    ...(provider.type === "apple" ? { appleKeyId, appleTeamId } : {}),
    clientId,
    displayName,
    ...(provider.type === "oidc" ? { issuer } : {}),
    redirectUri,
    ...(scopes.length === 0 ? {} : { scopes }),
  })
  return parsed.success ? parsed.output : undefined
}
