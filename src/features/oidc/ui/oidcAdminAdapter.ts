import type { Result } from "#result"
import type { OidcClientCreateRequest } from "../public/oidcClientCreateRequestSchema.js"
import type { OidcClientLifecycleRequest } from "../public/oidcClientLifecycleRequestSchema.js"
import type { OidcClientListResponse } from "../public/oidcClientListResponseSchema.js"
import type { OidcClient } from "../public/oidcClientSchema.js"
import type { OidcClientUpdateRequest } from "../public/oidcClientUpdateRequestSchema.js"
import type { OidcConsentListResponse } from "../public/oidcConsentListResponseSchema.js"
import type { OidcDiscovery } from "../public/oidcDiscoverySchema.js"
import type { OidcJwks } from "../public/oidcJwksSchema.js"
import type { OidcSigningKeyListResponse } from "../public/oidcSigningKeyListResponseSchema.js"
import type { OidcSigningKey } from "../public/oidcSigningKeySchema.js"

/** A newly issued client secret. It is returned once and is never recoverable afterwards. */
export type OidcAdminClientSecretIssue = {
  readonly client: OidcClient
  readonly clientSecret?: string
}

/**
 * The single boundary separating the shared stateless OIDC administration views from
 * their production (network) and demo (fixture) data sources. Discovery and JWKS are
 * deliberately read-only: no mutating counterpart exists on this contract.
 */
export type OidcAdminAdapter = {
  readonly clientCreate: (input: OidcClientCreateRequest) => Promise<Result<OidcAdminClientSecretIssue>>
  readonly clientGet: (clientId: string) => Promise<Result<OidcClient>>
  readonly clientLifecycleSet: (clientId: string, input: OidcClientLifecycleRequest) => Promise<Result<OidcClient>>
  readonly clientList: (pageToken?: string) => Promise<Result<OidcClientListResponse>>
  readonly clientSecretRevoke: (clientId: string) => Promise<Result<OidcClient>>
  /** Issues a replacement secret. The previous secret stops working immediately. */
  readonly clientSecretRotate: (clientId: string) => Promise<Result<OidcAdminClientSecretIssue>>
  readonly clientUpdate: (clientId: string, input: OidcClientUpdateRequest) => Promise<Result<OidcClient>>
  readonly consentList: (userId: string, pageToken?: string) => Promise<Result<OidcConsentListResponse>>
  readonly consentRevoke: (userId: string, clientId: string) => Promise<Result<{ readonly revoked: boolean }>>
  /** Read-only protocol metadata derived from the realm configuration. */
  readonly discoveryGet: () => Promise<Result<OidcDiscovery>>
  /** Read-only published public keys. Private key material is never exposed. */
  readonly jwksGet: () => Promise<Result<OidcJwks>>
  readonly signingKeyCreate: () => Promise<Result<OidcSigningKey>>
  readonly signingKeyList: (pageToken?: string) => Promise<Result<OidcSigningKeyListResponse>>
  readonly signingKeyRetire: (signingKeyId: string) => Promise<Result<OidcSigningKey>>
  readonly signingKeyRotate: () => Promise<Result<OidcSigningKey>>
  /** Users the operator may inspect consents for. */
  readonly users: () => Promise<Result<readonly { readonly id: string; readonly label: string }[]>>
}
