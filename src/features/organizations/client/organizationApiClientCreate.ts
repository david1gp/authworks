import * as v from "valibot"
import { type Result, type ResultErr } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { HttpGetOptions } from "../../../platform/http/HttpGetOptions.js"
import type { HttpGetResult } from "../../../platform/http/HttpGetResult.js"
import { httpApiClientGetRequest } from "../../../platform/http/httpApiClientGetRequest.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { patchInputParse } from "../../../platform/http/patchInputParse.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import {
  type OrganizationBrandingResponse,
  organizationBrandingResponseSchema,
} from "../public/organizationBrandingResponseSchema.js"
import type { OrganizationBrandingSetRequest } from "../public/organizationBrandingSetRequestSchema.js"
import { organizationBrandingSetRequestSchema } from "../public/organizationBrandingSetRequestSchema.js"
import {
  type OrganizationCreateRequest,
  organizationCreateRequestSchema,
} from "../public/organizationCreateRequestSchema.js"
import {
  type OrganizationDiscoveryResponse,
  organizationDiscoveryResponseSchema,
} from "../public/organizationDiscoveryResponseSchema.js"
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
  type OrganizationInvitationMeAcceptRequest,
  organizationInvitationMeAcceptRequestSchema,
} from "../public/organizationInvitationMeAcceptRequestSchema.js"
import {
  type OrganizationInvitationMeAcceptResponse,
  organizationInvitationMeAcceptResponseSchema,
} from "../public/organizationInvitationMeAcceptResponseSchema.js"
import {
  type OrganizationInvitationMeDeclineRequest,
  organizationInvitationMeDeclineRequestSchema,
} from "../public/organizationInvitationMeDeclineRequestSchema.js"
import {
  type OrganizationInvitationMeDeclineResponse,
  organizationInvitationMeDeclineResponseSchema,
} from "../public/organizationInvitationMeDeclineResponseSchema.js"
import {
  type OrganizationInvitationMeInspectRequest,
  organizationInvitationMeInspectRequestSchema,
} from "../public/organizationInvitationMeInspectRequestSchema.js"
import {
  type OrganizationInvitationMeInspectResponse,
  organizationInvitationMeInspectResponseSchema,
} from "../public/organizationInvitationMeInspectResponseSchema.js"
import {
  type OrganizationInvitationMeListResponse,
  organizationInvitationMeListResponseSchema,
} from "../public/organizationInvitationMeListResponseSchema.js"
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
  type OrganizationLoginPolicyResponse,
  organizationLoginPolicyResponseSchema,
} from "../public/organizationLoginPolicyResponseSchema.js"
import type { OrganizationLoginPolicySetRequest } from "../public/organizationLoginPolicySetRequestSchema.js"
import { organizationLoginPolicySetRequestSchema } from "../public/organizationLoginPolicySetRequestSchema.js"
import {
  type OrganizationMeListResponse,
  organizationMeListResponseSchema,
} from "../public/organizationMeListResponseSchema.js"
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
import {
  type OrganizationMeSwitchRequest,
  organizationMeSwitchRequestSchema,
} from "../public/organizationMeSwitchRequestSchema.js"
import {
  type OrganizationMeSwitchResponse,
  organizationMeSwitchResponseSchema,
} from "../public/organizationMeSwitchResponseSchema.js"
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

type OrganizationApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type OrganizationMembershipListInvalidResponseErrorGet = (body: unknown) => ResultErr | undefined

type OrganizationApiClientCreateOptions = {
  readonly baseUrl: string
  readonly csrfToken?: string
  readonly fetch?: OrganizationApiFetch
  readonly organizationMembershipListInvalidResponseErrorGet?: OrganizationMembershipListInvalidResponseErrorGet
  readonly token?: Secret | string
}

export function organizationApiClientCreate(options: OrganizationApiClientCreateOptions) {
  const request = <T>(
    path: string,
    init: RequestInit,
    schema: v.GenericSchema<T>,
    invalidResponseErrorGet?: OrganizationMembershipListInvalidResponseErrorGet,
  ): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      invalidResponseErrorGet,
      op: "organizationApiClientRequest",
      path,
      schema,
      token: options.token,
    })
  const getRequest = <T>(
    path: string,
    schema: v.GenericSchema<T>,
    getOptions?: HttpGetOptions,
  ): Promise<HttpGetResult<T>> =>
    httpApiClientGetRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      ifModifiedSince: getOptions?.ifModifiedSince,
      init: { method: "GET" },
      op: "organizationApiClientRequest",
      path,
      schema,
      token: options.token,
    })

  const jsonRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })
  const patchRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "PATCH" })
  const browserRequestInit = (init: RequestInit): RequestInit => {
    const headers = new Headers(init.headers)
    if (options.csrfToken !== undefined) headers.set("x-csrf-token", options.csrfToken)
    return { ...init, credentials: "same-origin", headers }
  }
  const browserRequest = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    request(path, browserRequestInit(init), schema)
  const browserGetRequest = <T>(
    path: string,
    schema: v.GenericSchema<T>,
    getOptions?: HttpGetOptions,
  ): Promise<HttpGetResult<T>> =>
    httpApiClientGetRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      ifModifiedSince: getOptions?.ifModifiedSince,
      init: browserRequestInit({ method: "GET" }),
      op: "organizationApiClientBrowserRequest",
      path,
      schema,
      token: options.token,
    })
  const browserOrganizationPath = (realmId: string, suffix = "") =>
    `/realms/${encodeURIComponent(realmId)}/organizations${suffix}`

  return {
    organizationTenantCreate(realmId: string, input: OrganizationCreateRequest): Promise<Result<OrganizationResponse>> {
      const parsed = v.safeParse(organizationCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientTenantCreate",
            "The organization request is invalid.",
            "organizations.invalid",
          ),
        )
      return browserRequest(browserOrganizationPath(realmId), jsonRequest(parsed.output), organizationResponseSchema)
    },
    organizationTenantGet(
      realmId: string,
      organizationId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<OrganizationResponse>> {
      return browserGetRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}`,
        organizationResponseSchema,
        getOptions,
      )
    },
    organizationTenantList(realmId: string, query?: ListQuery): Promise<Result<OrganizationListResponse>> {
      return browserRequest(
        organizationListPath(browserOrganizationPath(realmId), query),
        { method: "GET" },
        organizationListResponseSchema,
      )
    },
    organizationTenantUpdate(
      realmId: string,
      organizationId: string,
      input: OrganizationUpdateRequest,
    ): Promise<Result<OrganizationResponse>> {
      const parsed = patchInputParse(
        "organizationApiClientTenantUpdate",
        organizationUpdateRequestSchema,
        input,
        "organizations.empty-patch",
        "organizations.invalid",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}`,
        patchRequest(parsed.data),
        organizationResponseSchema,
      )
    },
    organizationTenantLifecycleSet(
      realmId: string,
      organizationId: string,
      input: OrganizationLifecycleRequest,
    ): Promise<Result<OrganizationResponse>> {
      const parsed = v.safeParse(organizationLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientTenantLifecycleSet",
            "The organization lifecycle request is invalid.",
            "organizations.invalid",
          ),
        )
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/lifecycle`,
        jsonRequest(parsed.output),
        organizationResponseSchema,
      )
    },
    organizationTenantRoleList(realmId: string, query?: ListQuery): Promise<Result<OrganizationRoleListResponse>> {
      return browserRequest(
        organizationListPath(`/realms/${encodeURIComponent(realmId)}/organization-roles`, query),
        { method: "GET" },
        organizationRoleListResponseSchema,
      )
    },
    organizationTenantBrandingGet(
      realmId: string,
      organizationId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<OrganizationBrandingResponse>> {
      return browserGetRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/branding`,
        organizationBrandingResponseSchema,
        getOptions,
      )
    },
    organizationTenantBrandingSet(
      realmId: string,
      organizationId: string,
      input: OrganizationBrandingSetRequest,
    ): Promise<Result<OrganizationBrandingResponse>> {
      const parsed = v.safeParse(organizationBrandingSetRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientTenantBrandingSet",
            "The branding is invalid.",
            "organizations.invalid",
          ),
        )
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/branding`,
        { ...jsonRequest(parsed.output), method: "PUT" },
        organizationBrandingResponseSchema,
      )
    },
    organizationTenantLoginPolicyGet(
      realmId: string,
      organizationId: string,
    ): Promise<Result<OrganizationLoginPolicyResponse>> {
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/login-policy`,
        { method: "GET" },
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationTenantLoginPolicySet(
      realmId: string,
      organizationId: string,
      input: OrganizationLoginPolicySetRequest,
    ): Promise<Result<OrganizationLoginPolicyResponse>> {
      const parsed = v.safeParse(organizationLoginPolicySetRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientTenantLoginPolicySet",
            "The login policy is invalid.",
            "organizations.invalid",
          ),
        )
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/login-policy`,
        patchRequest(parsed.output),
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationTenantRealmLoginPolicyGet(realmId: string): Promise<Result<OrganizationLoginPolicyResponse>> {
      return browserRequest(
        `/realms/${encodeURIComponent(realmId)}/login-policy`,
        { method: "GET" },
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationTenantRealmLoginPolicySet(
      realmId: string,
      input: OrganizationLoginPolicySetRequest,
    ): Promise<Result<OrganizationLoginPolicyResponse>> {
      const parsed = v.safeParse(organizationLoginPolicySetRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientTenantRealmLoginPolicySet",
            "The login policy is invalid.",
            "organizations.invalid",
          ),
        )
      return browserRequest(
        `/realms/${encodeURIComponent(realmId)}/login-policy`,
        patchRequest(parsed.output),
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationTenantDomainList(
      realmId: string,
      organizationId: string,
      query?: ListQuery,
    ): Promise<Result<OrganizationDomainListResponse>> {
      return browserRequest(
        organizationListPath(
          `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/domains`,
          query,
        ),
        { method: "GET" },
        organizationDomainListResponseSchema,
      )
    },
    organizationTenantDomainClaim(
      realmId: string,
      organizationId: string,
      input: OrganizationDomainClaimRequest,
    ): Promise<Result<OrganizationDomainResponse>> {
      const parsed = v.safeParse(organizationDomainClaimRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientTenantDomainClaim",
            "The domain claim is invalid.",
            "organizations.invalid",
          ),
        )
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/domains`,
        jsonRequest(parsed.output),
        organizationDomainResponseSchema,
      )
    },
    organizationTenantDomainVerify(
      realmId: string,
      organizationId: string,
      domain: string,
    ): Promise<Result<OrganizationDomainResponse>> {
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/domains/${encodeURIComponent(domain)}/verify`,
        jsonRequest({}),
        organizationDomainResponseSchema,
      )
    },
    organizationTenantDomainRemove(
      realmId: string,
      organizationId: string,
      domain: string,
    ): Promise<Result<OrganizationDomainRemoveResponse>> {
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/domains/${encodeURIComponent(domain)}`,
        { method: "DELETE" },
        organizationDomainRemoveResponseSchema,
      )
    },
    organizationTenantDomainDiscover(domain: string): Promise<Result<OrganizationDiscoveryResponse>> {
      return browserRequest(
        `/organization-discovery?domain=${encodeURIComponent(domain)}`,
        { method: "GET" },
        organizationDiscoveryResponseSchema,
      )
    },
    organizationTenantMembershipCreate(
      realmId: string,
      organizationId: string,
      input: OrganizationMembershipCreateRequest,
    ): Promise<Result<OrganizationMembershipResponse>> {
      const parsed = v.safeParse(organizationMembershipCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientTenantMembershipCreate",
            "The membership request is invalid.",
            "organizations.invalid",
          ),
        )
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/memberships`,
        jsonRequest(parsed.output),
        organizationMembershipResponseSchema,
      )
    },
    organizationTenantMembershipList(
      realmId: string,
      organizationId: string,
      query?: ListQuery,
    ): Promise<Result<OrganizationMembershipListResponse>> {
      return browserRequest(
        organizationListPath(
          `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/memberships`,
          query,
        ),
        { method: "GET" },
        organizationMembershipListResponseSchema,
      )
    },
    organizationTenantMembershipUpdate(
      realmId: string,
      organizationId: string,
      membershipId: string,
      input: OrganizationMembershipUpdateRequest,
    ): Promise<Result<OrganizationMembershipResponse>> {
      const parsed = v.safeParse(organizationMembershipUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientTenantMembershipUpdate",
            "The membership update is invalid.",
            "organizations.invalid",
          ),
        )
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(membershipId)}`,
        patchRequest(parsed.output),
        organizationMembershipResponseSchema,
      )
    },
    organizationTenantMembershipRemove(
      realmId: string,
      organizationId: string,
      membershipId: string,
    ): Promise<Result<OrganizationMembershipRemoveResponse>> {
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(membershipId)}`,
        { method: "DELETE" },
        organizationMembershipRemoveResponseSchema,
      )
    },
    organizationTenantInvitationCreate(
      realmId: string,
      organizationId: string,
      input: OrganizationInvitationCreateRequest,
    ): Promise<Result<OrganizationInvitationCreateResponse>> {
      const parsed = v.safeParse(organizationInvitationCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientTenantInvitationCreate",
            "The invitation request is invalid.",
            "organizations.invalid",
          ),
        )
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/invitations`,
        jsonRequest(parsed.output),
        organizationInvitationCreateResponseSchema,
      )
    },
    organizationTenantInvitationList(
      realmId: string,
      organizationId: string,
      query?: ListQuery,
    ): Promise<Result<OrganizationInvitationListResponse>> {
      return browserRequest(
        organizationListPath(
          `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/invitations`,
          query,
        ),
        { method: "GET" },
        organizationInvitationListResponseSchema,
      )
    },
    organizationTenantInvitationRevoke(
      realmId: string,
      organizationId: string,
      invitationId: string,
    ): Promise<Result<OrganizationInvitationRevokeResponse>> {
      return browserRequest(
        `${browserOrganizationPath(realmId)}/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
        jsonRequest({}),
        organizationInvitationRevokeResponseSchema,
      )
    },
    organizationCreate(realmId: string, input: OrganizationCreateRequest): Promise<Result<OrganizationResponse>> {
      const parsed = v.safeParse(organizationCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientCreate",
            "The organization request is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations`,
        jsonRequest(parsed.output),
        organizationResponseSchema,
      )
    },
    organizationGet(
      realmId: string,
      organizationId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<OrganizationResponse>> {
      return getRequest(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}`,
        organizationResponseSchema,
        getOptions,
      )
    },
    organizationList(realmId: string, query?: ListQuery): Promise<Result<OrganizationListResponse>> {
      return request(
        organizationListPathCreate(`/system/realms/${encodeURIComponent(realmId)}/organizations`, query),
        { method: "GET" },
        organizationListResponseSchema,
      )
    },
    organizationMeList(realmId: string, query?: ListQuery): Promise<Result<OrganizationMeListResponse>> {
      return request(
        organizationListPathCreate(`/realms/${encodeURIComponent(realmId)}/me/organizations`, query),
        { method: "GET" },
        organizationMeListResponseSchema,
      )
    },
    organizationUpdate(
      realmId: string,
      organizationId: string,
      input: OrganizationUpdateRequest,
    ): Promise<Result<OrganizationResponse>> {
      const parsed = patchInputParse(
        "organizationApiClientUpdate",
        organizationUpdateRequestSchema,
        input,
        "organizations.empty-patch",
        "organizations.invalid",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}`,
        patchRequest(parsed.data),
        organizationResponseSchema,
      )
    },
    organizationBrandingGet(
      realmId: string,
      organizationId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<OrganizationBrandingResponse>> {
      return getRequest(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/branding`,
        organizationBrandingResponseSchema,
        getOptions,
      )
    },
    organizationBrandingSet(
      realmId: string,
      organizationId: string,
      input: OrganizationBrandingSetRequest,
    ): Promise<Result<OrganizationBrandingResponse>> {
      const parsed = v.safeParse(organizationBrandingSetRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientBrandingSet",
            "The branding is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/branding`,
        { ...jsonRequest(parsed.output), method: "PUT" },
        organizationBrandingResponseSchema,
      )
    },
    organizationDomainClaim(
      realmId: string,
      organizationId: string,
      input: OrganizationDomainClaimRequest,
    ): Promise<Result<OrganizationDomainResponse>> {
      const parsed = v.safeParse(organizationDomainClaimRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientDomainClaim",
            "The domain claim is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/domains`,
        jsonRequest(parsed.output),
        organizationDomainResponseSchema,
      )
    },
    organizationDomainList(
      realmId: string,
      organizationId: string,
      query?: ListQuery,
    ): Promise<Result<OrganizationDomainListResponse>> {
      return request(
        organizationListPathCreate(
          `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/domains`,
          query,
        ),
        { method: "GET" },
        organizationDomainListResponseSchema,
      )
    },
    organizationDomainVerify(
      realmId: string,
      organizationId: string,
      domain: string,
    ): Promise<Result<OrganizationDomainResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/domains/${encodeURIComponent(domain)}/verify`,
        jsonRequest({}),
        organizationDomainResponseSchema,
      )
    },
    organizationDomainRemove(
      realmId: string,
      organizationId: string,
      domain: string,
    ): Promise<Result<OrganizationDomainRemoveResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/domains/${encodeURIComponent(domain)}`,
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
    organizationRealmLoginPolicyGet(realmId: string): Promise<Result<OrganizationLoginPolicyResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/login-policy`,
        { method: "GET" },
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationRealmLoginPolicySet(
      realmId: string,
      input: OrganizationLoginPolicySetRequest,
    ): Promise<Result<OrganizationLoginPolicyResponse>> {
      const parsed = v.safeParse(organizationLoginPolicySetRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientRealmLoginPolicySet",
            "The login policy is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/login-policy`,
        patchRequest(parsed.output),
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationLoginPolicyGet(
      realmId: string,
      organizationId: string,
    ): Promise<Result<OrganizationLoginPolicyResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/login-policy`,
        { method: "GET" },
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationLoginPolicySet(
      realmId: string,
      organizationId: string,
      input: OrganizationLoginPolicySetRequest,
    ): Promise<Result<OrganizationLoginPolicyResponse>> {
      const parsed = v.safeParse(organizationLoginPolicySetRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientLoginPolicySet",
            "The login policy is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/login-policy`,
        patchRequest(parsed.output),
        organizationLoginPolicyResponseSchema,
      )
    },
    organizationLifecycleSet(
      realmId: string,
      organizationId: string,
      input: OrganizationLifecycleRequest,
    ): Promise<Result<OrganizationResponse>> {
      const parsed = v.safeParse(organizationLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientLifecycleSet",
            "The organization lifecycle request is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/lifecycle`,
        jsonRequest(parsed.output),
        organizationResponseSchema,
      )
    },
    organizationRoleList(query?: ListQuery): Promise<Result<OrganizationRoleListResponse>> {
      return request(
        organizationListPathCreate("/system/organization-roles", query),
        { method: "GET" },
        organizationRoleListResponseSchema,
      )
    },
    organizationMembershipCreate(
      realmId: string,
      organizationId: string,
      input: OrganizationMembershipCreateRequest,
    ): Promise<Result<OrganizationMembershipResponse>> {
      const parsed = v.safeParse(organizationMembershipCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientMembershipCreate",
            "The membership request is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/memberships`,
        jsonRequest(parsed.output),
        organizationMembershipResponseSchema,
      )
    },
    organizationMembershipList(
      realmId: string,
      organizationId: string,
      query?: ListQuery,
    ): Promise<Result<OrganizationMembershipListResponse>> {
      return request(
        organizationListPathCreate(
          `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/memberships`,
          query,
        ),
        { method: "GET" },
        organizationMembershipListResponseSchema,
        options.organizationMembershipListInvalidResponseErrorGet,
      )
    },
    organizationMembershipUpdate(
      realmId: string,
      organizationId: string,
      membershipId: string,
      input: OrganizationMembershipUpdateRequest,
    ): Promise<Result<OrganizationMembershipResponse>> {
      const parsed = v.safeParse(organizationMembershipUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientMembershipUpdate",
            "The membership update is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(membershipId)}`,
        patchRequest(parsed.output),
        organizationMembershipResponseSchema,
      )
    },
    organizationMembershipRemove(
      realmId: string,
      organizationId: string,
      membershipId: string,
    ): Promise<Result<OrganizationMembershipRemoveResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(membershipId)}`,
        { method: "DELETE" },
        organizationMembershipRemoveResponseSchema,
      )
    },
    organizationInvitationCreate(
      realmId: string,
      organizationId: string,
      input: OrganizationInvitationCreateRequest,
    ): Promise<Result<OrganizationInvitationCreateResponse>> {
      const parsed = v.safeParse(organizationInvitationCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientInvitationCreate",
            "The invitation request is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/invitations`,
        jsonRequest(parsed.output),
        organizationInvitationCreateResponseSchema,
      )
    },
    organizationInvitationList(
      realmId: string,
      organizationId: string,
      query?: ListQuery,
    ): Promise<Result<OrganizationInvitationListResponse>> {
      return request(
        organizationListPathCreate(
          `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/invitations`,
          query,
        ),
        { method: "GET" },
        organizationInvitationListResponseSchema,
      )
    },
    organizationInvitationRevoke(
      realmId: string,
      organizationId: string,
      invitationId: string,
    ): Promise<Result<OrganizationInvitationRevokeResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
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
    organizationInvitationMeList(
      realmId: string,
      query?: ListQuery,
    ): Promise<Result<OrganizationInvitationMeListResponse>> {
      return request(
        organizationListPathCreate(`/realms/${encodeURIComponent(realmId)}/me/invitations`, query),
        { method: "GET" },
        organizationInvitationMeListResponseSchema,
      )
    },
    organizationInvitationMeInspect(
      realmId: string,
      input: OrganizationInvitationMeInspectRequest,
    ): Promise<Result<OrganizationInvitationMeInspectResponse>> {
      const parsed = v.safeParse(organizationInvitationMeInspectRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientInvitationMeInspect",
            "The organization invitation token is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/realms/${encodeURIComponent(realmId)}/me/invitations/inspect`,
        jsonRequest(parsed.output),
        organizationInvitationMeInspectResponseSchema,
      )
    },
    organizationInvitationMeAccept(
      realmId: string,
      input: OrganizationInvitationMeAcceptRequest,
    ): Promise<Result<OrganizationInvitationMeAcceptResponse>> {
      const parsed = v.safeParse(organizationInvitationMeAcceptRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientInvitationMeAccept",
            "The organization invitation acceptance is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/realms/${encodeURIComponent(realmId)}/me/invitations/accept`,
        jsonRequest(parsed.output),
        organizationInvitationMeAcceptResponseSchema,
      )
    },
    organizationInvitationMeDecline(
      realmId: string,
      input: OrganizationInvitationMeDeclineRequest,
    ): Promise<Result<OrganizationInvitationMeDeclineResponse>> {
      const parsed = v.safeParse(organizationInvitationMeDeclineRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientInvitationMeDecline",
            "The organization invitation decline is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/realms/${encodeURIComponent(realmId)}/me/invitations/decline`,
        jsonRequest(parsed.output),
        organizationInvitationMeDeclineResponseSchema,
      )
    },
    organizationSwitch(realmId: string, input: OrganizationSwitchRequest): Promise<Result<OrganizationSwitchResponse>> {
      const parsed = v.safeParse(organizationSwitchRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientSwitch",
            "The switch request is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/organizations/switch`,
        jsonRequest(parsed.output),
        organizationSwitchResponseSchema,
      )
    },
    organizationMeSwitch(
      realmId: string,
      input: OrganizationMeSwitchRequest,
    ): Promise<Result<OrganizationMeSwitchResponse>> {
      const parsed = v.safeParse(organizationMeSwitchRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "organizationApiClientMeSwitch",
            "The organization switch request is invalid.",
            "organizations.invalid",
          ),
        )
      return request(
        `/realms/${encodeURIComponent(realmId)}/me/organizations/switch`,
        jsonRequest(parsed.output),
        organizationMeSwitchResponseSchema,
      )
    },
  }
}

function organizationListPathCreate(path: string, query: ListQuery | undefined): string {
  if (query === undefined) return path
  const params = new URLSearchParams()
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize))
  if (query.pageToken !== undefined) params.set("pageToken", query.pageToken)
  if (query.sortBy !== undefined) params.set("sortBy", query.sortBy)
  if (query.sortDirection !== undefined) params.set("sortDirection", query.sortDirection)
  const serialized = params.toString()
  return serialized.length === 0 ? path : `${path}?${serialized}`
}

function organizationListPath(path: string, query: ListQuery | undefined): string {
  return organizationListPathCreate(path, query)
}
