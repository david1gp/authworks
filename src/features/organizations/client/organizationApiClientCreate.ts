import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import {
  type OrganizationCreateRequest,
  organizationCreateRequestSchema,
} from "../public/organizationCreateRequestSchema.js"
import {
  type OrganizationBrandingResponse,
  organizationBrandingResponseSchema,
} from "../public/organizationBrandingResponseSchema.js"
import type { OrganizationBrandingSetRequest } from "../public/organizationBrandingSetRequestSchema.js"
import { organizationBrandingSetRequestSchema } from "../public/organizationBrandingSetRequestSchema.js"
import {
  type OrganizationDomainClaimRequest,
  organizationDomainClaimRequestSchema,
} from "../public/organizationDomainClaimRequestSchema.js"
import {
  type OrganizationDomainListResponse,
  organizationDomainListResponseSchema,
} from "../public/organizationDomainListResponseSchema.js"
import {
  type OrganizationDomainRemoveResponse,
  organizationDomainRemoveResponseSchema,
} from "../public/organizationDomainRemoveResponseSchema.js"
import {
  type OrganizationDomainResponse,
  organizationDomainResponseSchema,
} from "../public/organizationDomainResponseSchema.js"
import {
  type OrganizationDiscoveryResponse,
  organizationDiscoveryResponseSchema,
} from "../public/organizationDiscoveryResponseSchema.js"
import { type OrganizationInvitationAcceptRequest } from "../public/organizationInvitationAcceptRequestSchema.js"
import {
  type OrganizationInvitationCreateRequest,
  organizationInvitationCreateRequestSchema,
} from "../public/organizationInvitationCreateRequestSchema.js"
import {
  type OrganizationInvitationCreateResponse,
  organizationInvitationCreateResponseSchema,
} from "../public/organizationInvitationCreateResponseSchema.js"
import {
  type OrganizationInvitationDeclineResponse,
  organizationInvitationDeclineResponseSchema,
} from "../public/organizationInvitationDeclineResponseSchema.js"
import {
  type OrganizationInvitationListResponse,
  organizationInvitationListResponseSchema,
} from "../public/organizationInvitationListResponseSchema.js"
import {
  type OrganizationInvitationRevokeResponse,
  organizationInvitationRevokeResponseSchema,
} from "../public/organizationInvitationRevokeResponseSchema.js"
import {
  type OrganizationLifecycleRequest,
  organizationLifecycleRequestSchema,
} from "../public/organizationLifecycleRequestSchema.js"
import {
  type OrganizationListResponse,
  organizationListResponseSchema,
} from "../public/organizationListResponseSchema.js"
import {
  type OrganizationMembershipCreateRequest,
  organizationMembershipCreateRequestSchema,
} from "../public/organizationMembershipCreateRequestSchema.js"
import {
  type OrganizationMembershipListResponse,
  organizationMembershipListResponseSchema,
} from "../public/organizationMembershipListResponseSchema.js"
import {
  type OrganizationMembershipRemoveResponse,
  organizationMembershipRemoveResponseSchema,
} from "../public/organizationMembershipRemoveResponseSchema.js"
import {
  type OrganizationMembershipResponse,
  organizationMembershipResponseSchema,
} from "../public/organizationMembershipResponseSchema.js"
import {
  type OrganizationMembershipUpdateRequest,
  organizationMembershipUpdateRequestSchema,
} from "../public/organizationMembershipUpdateRequestSchema.js"
import { type OrganizationResponse, organizationResponseSchema } from "../public/organizationResponseSchema.js"
import {
  type OrganizationRoleListResponse,
  organizationRoleListResponseSchema,
} from "../public/organizationRoleListResponseSchema.js"
import {
  type OrganizationSwitchRequest,
  organizationSwitchRequestSchema,
} from "../public/organizationSwitchRequestSchema.js"
import {
  type OrganizationSwitchResponse,
  organizationSwitchResponseSchema,
} from "../public/organizationSwitchResponseSchema.js"
import {
  type OrganizationUpdateRequest,
  organizationUpdateRequestSchema,
} from "../public/organizationUpdateRequestSchema.js"
import {
  type OrganizationLoginPolicyResponse,
  organizationLoginPolicyResponseSchema,
} from "../public/organizationLoginPolicyResponseSchema.js"
import type { OrganizationLoginPolicySetRequest } from "../public/organizationLoginPolicySetRequestSchema.js"
import { organizationLoginPolicySetRequestSchema } from "../public/organizationLoginPolicySetRequestSchema.js"

type OrganizationApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type OrganizationApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: OrganizationApiFetch
  readonly token?: Secret | string
}

export function organizationApiClientCreate(options: OrganizationApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "organizationApiClientRequest",
      path,
      schema,
      token: options.token,
    })

  const jsonRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })
  const patchRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "PATCH" })

  return {
    organizationCreate(instanceId: string, input: OrganizationCreateRequest): Promise<Result<OrganizationResponse>> {
      const parsed = v.safeParse(organizationCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("organizationApiClientCreate", "The organization request is invalid."))
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations`,
        jsonRequest(parsed.output),
        organizationResponseSchema,
      )
    },
    organizationGet(instanceId: string, organizationId: string): Promise<Result<OrganizationResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}`,
        { method: "GET" },
        organizationResponseSchema,
      )
    },
    organizationList(instanceId: string): Promise<Result<OrganizationListResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations`,
        { method: "GET" },
        organizationListResponseSchema,
      )
    },
    organizationUpdate(
      instanceId: string,
      organizationId: string,
      input: OrganizationUpdateRequest,
    ): Promise<Result<OrganizationResponse>> {
      const parsed = v.safeParse(organizationUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("organizationApiClientUpdate", "The organization update is invalid."))
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}`,
        patchRequest(parsed.output),
        organizationResponseSchema,
      )
    },
    organizationBrandingGet(instanceId: string, organizationId: string): Promise<Result<OrganizationBrandingResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/branding`,
        { method: "GET" },
        organizationBrandingResponseSchema,
      )
    },
    organizationBrandingSet(
      instanceId: string,
      organizationId: string,
      input: OrganizationBrandingSetRequest,
    ): Promise<Result<OrganizationBrandingResponse>> {
      const parsed = v.safeParse(organizationBrandingSetRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("organizationApiClientBrandingSet", "The branding is invalid."))
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/branding`,
        { ...jsonRequest(parsed.output), method: "PUT" },
        organizationBrandingResponseSchema,
      )
    },
    organizationDomainClaim(
      instanceId: string,
      organizationId: string,
      input: OrganizationDomainClaimRequest,
    ): Promise<Result<OrganizationDomainResponse>> {
      const parsed = v.safeParse(organizationDomainClaimRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("organizationApiClientDomainClaim", "The domain claim is invalid."))
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/domains`,
        jsonRequest(parsed.output),
        organizationDomainResponseSchema,
      )
    },
    organizationDomainList(
      instanceId: string,
      organizationId: string,
    ): Promise<Result<OrganizationDomainListResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/domains`,
        { method: "GET" },
        organizationDomainListResponseSchema,
      )
    },
    organizationDomainVerify(
      instanceId: string,
      organizationId: string,
      domain: string,
    ): Promise<Result<OrganizationDomainResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/domains/${encodeURIComponent(domain)}/verify`,
        jsonRequest({}),
        organizationDomainResponseSchema,
      )
    },
    organizationDomainRemove(
      instanceId: string,
      organizationId: string,
      domain: string,
    ): Promise<Result<OrganizationDomainRemoveResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/domains/${encodeURIComponent(domain)}`,
        { method: "DELETE" },
        organizationDomainRemoveResponseSchema,
      )
    },
    organizationDomainDiscover(domain: string): Promise<Result<OrganizationDiscoveryResponse>> {
      return request(
        `/organization-discovery?domain=${encodeURIComponent(domain)}`,
        { method: "GET" },
        organizationDiscoveryResponseSchema,
      )
    },
    organizationInstanceLoginPolicyGet(instanceId: string): Promise<Result<OrganizationLoginPolicyResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/login-policy`,
        { method: "GET" },
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationInstanceLoginPolicySet(
      instanceId: string,
      input: OrganizationLoginPolicySetRequest,
    ): Promise<Result<OrganizationLoginPolicyResponse>> {
      const parsed = v.safeParse(organizationLoginPolicySetRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("organizationApiClientInstanceLoginPolicySet", "The login policy is invalid."),
        )
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/login-policy`,
        patchRequest(parsed.output),
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationLoginPolicyGet(
      instanceId: string,
      organizationId: string,
    ): Promise<Result<OrganizationLoginPolicyResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/login-policy`,
        { method: "GET" },
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationLoginPolicySet(
      instanceId: string,
      organizationId: string,
      input: OrganizationLoginPolicySetRequest,
    ): Promise<Result<OrganizationLoginPolicyResponse>> {
      const parsed = v.safeParse(organizationLoginPolicySetRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("organizationApiClientLoginPolicySet", "The login policy is invalid."))
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/login-policy`,
        patchRequest(parsed.output),
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationLifecycleSet(
      instanceId: string,
      organizationId: string,
      input: OrganizationLifecycleRequest,
    ): Promise<Result<OrganizationResponse>> {
      const parsed = v.safeParse(organizationLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("organizationApiClientLifecycleSet", "The organization lifecycle request is invalid."),
        )
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/lifecycle`,
        jsonRequest(parsed.output),
        organizationResponseSchema,
      )
    },
    organizationRoleList(): Promise<Result<OrganizationRoleListResponse>> {
      return request("/system/organization-roles", { method: "GET" }, organizationRoleListResponseSchema)
    },
    organizationMembershipCreate(
      instanceId: string,
      organizationId: string,
      input: OrganizationMembershipCreateRequest,
    ): Promise<Result<OrganizationMembershipResponse>> {
      const parsed = v.safeParse(organizationMembershipCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("organizationApiClientMembershipCreate", "The membership request is invalid."),
        )
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/memberships`,
        jsonRequest(parsed.output),
        organizationMembershipResponseSchema,
      )
    },
    organizationMembershipList(
      instanceId: string,
      organizationId: string,
    ): Promise<Result<OrganizationMembershipListResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/memberships`,
        { method: "GET" },
        organizationMembershipListResponseSchema,
      )
    },
    organizationMembershipUpdate(
      instanceId: string,
      organizationId: string,
      membershipId: string,
      input: OrganizationMembershipUpdateRequest,
    ): Promise<Result<OrganizationMembershipResponse>> {
      const parsed = v.safeParse(organizationMembershipUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("organizationApiClientMembershipUpdate", "The membership update is invalid."),
        )
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(membershipId)}`,
        patchRequest(parsed.output),
        organizationMembershipResponseSchema,
      )
    },
    organizationMembershipRemove(
      instanceId: string,
      organizationId: string,
      membershipId: string,
    ): Promise<Result<OrganizationMembershipRemoveResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(membershipId)}`,
        { method: "DELETE" },
        organizationMembershipRemoveResponseSchema,
      )
    },
    organizationInvitationCreate(
      instanceId: string,
      organizationId: string,
      input: OrganizationInvitationCreateRequest,
    ): Promise<Result<OrganizationInvitationCreateResponse>> {
      const parsed = v.safeParse(organizationInvitationCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("organizationApiClientInvitationCreate", "The invitation request is invalid."),
        )
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/invitations`,
        jsonRequest(parsed.output),
        organizationInvitationCreateResponseSchema,
      )
    },
    organizationInvitationList(
      instanceId: string,
      organizationId: string,
    ): Promise<Result<OrganizationInvitationListResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/invitations`,
        { method: "GET" },
        organizationInvitationListResponseSchema,
      )
    },
    organizationInvitationRevoke(
      instanceId: string,
      organizationId: string,
      invitationId: string,
    ): Promise<Result<OrganizationInvitationRevokeResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
        jsonRequest({}),
        organizationInvitationRevokeResponseSchema,
      )
    },
    organizationInvitationAccept(
      input: OrganizationInvitationAcceptRequest,
    ): Promise<Result<OrganizationMembershipResponse>> {
      return request("/organizations/invitations/accept", jsonRequest(input), organizationMembershipResponseSchema)
    },
    organizationInvitationDecline(
      input: OrganizationInvitationAcceptRequest,
    ): Promise<Result<OrganizationInvitationDeclineResponse>> {
      return request(
        "/organizations/invitations/decline",
        jsonRequest(input),
        organizationInvitationDeclineResponseSchema,
      )
    },
    organizationSwitch(
      instanceId: string,
      input: OrganizationSwitchRequest,
    ): Promise<Result<OrganizationSwitchResponse>> {
      const parsed = v.safeParse(organizationSwitchRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("organizationApiClientSwitch", "The switch request is invalid."))
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/organizations/switch`,
        jsonRequest(parsed.output),
        organizationSwitchResponseSchema,
      )
    },
  }
}
