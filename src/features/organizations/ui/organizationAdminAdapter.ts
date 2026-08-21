import type { Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { ExternalIdentityProviderCreateRequest } from "../../externalIdentities/public/externalIdentityProviderCreateRequestSchema.js"
import type { ExternalIdentityProviderListResponse } from "../../externalIdentities/public/externalIdentityProviderListResponseSchema.js"
import type { ExternalIdentityProviderResponse } from "../../externalIdentities/public/externalIdentityProviderResponseSchema.js"
import type { ExternalIdentityProviderUpdateRequest } from "../../externalIdentities/public/externalIdentityProviderUpdateRequestSchema.js"
import type { OrganizationBrandingResponse } from "../public/organizationBrandingResponseSchema.js"
import type { OrganizationBrandingSetRequest } from "../public/organizationBrandingSetRequestSchema.js"
import type { OrganizationCreateRequest } from "../public/organizationCreateRequestSchema.js"
import type { OrganizationDiscoveryResponse } from "../public/organizationDiscoveryResponseSchema.js"
import type { OrganizationDomainClaimRequest } from "../public/organizationDomainClaimRequestSchema.js"
import type { OrganizationDomainListResponse } from "../public/organizationDomainListResponseSchema.js"
import type { OrganizationDomainResponse } from "../public/organizationDomainResponseSchema.js"
import type { OrganizationInvitationCreateRequest } from "../public/organizationInvitationCreateRequestSchema.js"
import type { OrganizationInvitationCreateResponse } from "../public/organizationInvitationCreateResponseSchema.js"
import type { OrganizationInvitationListResponse } from "../public/organizationInvitationListResponseSchema.js"
import type { OrganizationLifecycleRequest } from "../public/organizationLifecycleRequestSchema.js"
import type { OrganizationListResponse } from "../public/organizationListResponseSchema.js"
import type { OrganizationLoginPolicyResponse } from "../public/organizationLoginPolicyResponseSchema.js"
import type { OrganizationLoginPolicySetRequest } from "../public/organizationLoginPolicySetRequestSchema.js"
import type { OrganizationMembershipCreateRequest } from "../public/organizationMembershipCreateRequestSchema.js"
import type { OrganizationMembershipListResponse } from "../public/organizationMembershipListResponseSchema.js"
import type { OrganizationMembershipResponse } from "../public/organizationMembershipResponseSchema.js"
import type { OrganizationMembershipUpdateRequest } from "../public/organizationMembershipUpdateRequestSchema.js"
import type { OrganizationResponse } from "../public/organizationResponseSchema.js"
import type { OrganizationRoleListResponse } from "../public/organizationRoleListResponseSchema.js"

/**
 * Every side effect an organization administration page performs. The production adapter binds these
 * to realm-scoped cookie/CSRF browser clients; the demo adapter binds them to deterministic fixtures.
 */
export type OrganizationAdminAdapter = {
  readonly brandingGet: (organizationId: string) => Promise<Result<OrganizationBrandingResponse>>
  readonly brandingSet: (
    organizationId: string,
    input: OrganizationBrandingSetRequest,
  ) => Promise<Result<OrganizationBrandingResponse>>
  readonly domainClaim: (
    organizationId: string,
    input: OrganizationDomainClaimRequest,
  ) => Promise<Result<OrganizationDomainResponse>>
  readonly domainDiscover: (domain: string) => Promise<Result<OrganizationDiscoveryResponse>>
  readonly domainList: (organizationId: string, query?: ListQuery) => Promise<Result<OrganizationDomainListResponse>>
  readonly domainRemove: (organizationId: string, domain: string) => Promise<Result<{ readonly removed: boolean }>>
  readonly domainVerify: (organizationId: string, domain: string) => Promise<Result<OrganizationDomainResponse>>
  readonly invitationCreate: (
    organizationId: string,
    input: OrganizationInvitationCreateRequest,
  ) => Promise<Result<OrganizationInvitationCreateResponse>>
  readonly invitationList: (
    organizationId: string,
    query?: ListQuery,
  ) => Promise<Result<OrganizationInvitationListResponse>>
  readonly invitationRevoke: (
    organizationId: string,
    invitationId: string,
  ) => Promise<Result<{ readonly revoked: boolean }>>
  readonly loginPolicyGet: (organizationId: string) => Promise<Result<OrganizationLoginPolicyResponse>>
  readonly loginPolicySet: (
    organizationId: string,
    input: OrganizationLoginPolicySetRequest,
  ) => Promise<Result<OrganizationLoginPolicyResponse>>
  readonly membershipCreate: (
    organizationId: string,
    input: OrganizationMembershipCreateRequest,
  ) => Promise<Result<OrganizationMembershipResponse>>
  readonly membershipList: (
    organizationId: string,
    query?: ListQuery,
  ) => Promise<Result<OrganizationMembershipListResponse>>
  readonly membershipRemove: (
    organizationId: string,
    membershipId: string,
  ) => Promise<Result<{ readonly removed: boolean }>>
  readonly membershipUpdate: (
    organizationId: string,
    membershipId: string,
    input: OrganizationMembershipUpdateRequest,
  ) => Promise<Result<OrganizationMembershipResponse>>
  readonly organizationCreate: (input: OrganizationCreateRequest) => Promise<Result<OrganizationResponse>>
  readonly organizationGet: (organizationId: string) => Promise<Result<OrganizationResponse>>
  readonly organizationLifecycleSet: (
    organizationId: string,
    input: OrganizationLifecycleRequest,
  ) => Promise<Result<OrganizationResponse>>
  readonly organizationList: (query?: ListQuery) => Promise<Result<OrganizationListResponse>>
  readonly organizationUpdate: (
    organizationId: string,
    input: { readonly name: string },
  ) => Promise<Result<OrganizationResponse>>
  readonly providerCreate: (
    input: ExternalIdentityProviderCreateRequest,
  ) => Promise<Result<ExternalIdentityProviderResponse>>
  readonly providerDisable: (providerId: string) => Promise<Result<ExternalIdentityProviderResponse>>
  readonly providerList: (
    organizationId?: string,
    query?: ListQuery,
  ) => Promise<Result<ExternalIdentityProviderListResponse>>
  readonly providerUpdate: (
    providerId: string,
    input: ExternalIdentityProviderUpdateRequest,
  ) => Promise<Result<ExternalIdentityProviderResponse>>
  readonly roleList: () => Promise<Result<OrganizationRoleListResponse>>
}
