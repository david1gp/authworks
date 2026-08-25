import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { HttpGetOptions } from "../../../platform/http/HttpGetOptions.js"
import type { HttpGetResult } from "../../../platform/http/HttpGetResult.js"
import { httpApiClientGetRequest } from "../../../platform/http/httpApiClientGetRequest.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import {
  type OidcAuthorizationCodeRedeemRequest,
  oidcAuthorizationCodeRedeemRequestSchema,
} from "../public/oidcAuthorizationCodeRedeemRequestSchema.js"
import {
  type OidcAuthorizationCodeRedeemResponse,
  oidcAuthorizationCodeRedeemResponseSchema,
} from "../public/oidcAuthorizationCodeRedeemResponseSchema.js"
import {
  type OidcAuthorizationConsentRequest,
  oidcAuthorizationConsentRequestSchema,
} from "../public/oidcAuthorizationConsentRequestSchema.js"
import { oidcAuthorizationConsentRequiredSchema } from "../public/oidcAuthorizationConsentRequiredSchema.js"
import {
  type OidcAuthorizationConsentResponse,
  oidcAuthorizationConsentResponseSchema,
} from "../public/oidcAuthorizationConsentResponseSchema.js"
import {
  type OidcAuthorizationRequest,
  oidcAuthorizationRequestSchema,
} from "../public/oidcAuthorizationRequestSchema.js"
import {
  type OidcAuthorizationResponse,
  oidcAuthorizationResponseSchema,
} from "../public/oidcAuthorizationResponseSchema.js"
import { type OidcClientCreateRequest, oidcClientCreateRequestSchema } from "../public/oidcClientCreateRequestSchema.js"
import {
  type OidcClientCreateResponse,
  oidcClientCreateResponseSchema,
} from "../public/oidcClientCreateResponseSchema.js"
import {
  type OidcClientLifecycleRequest,
  oidcClientLifecycleRequestSchema,
} from "../public/oidcClientLifecycleRequestSchema.js"
import { type OidcClientListResponse, oidcClientListResponseSchema } from "../public/oidcClientListResponseSchema.js"
import { type OidcClientResponse, oidcClientResponseSchema } from "../public/oidcClientResponseSchema.js"
import {
  type OidcClientSecretRotateResponse,
  oidcClientSecretRotateResponseSchema,
} from "../public/oidcClientSecretRotateResponseSchema.js"
import { type OidcClientUpdateRequest, oidcClientUpdateRequestSchema } from "../public/oidcClientUpdateRequestSchema.js"
import { type OidcConsentListResponse, oidcConsentListResponseSchema } from "../public/oidcConsentListResponseSchema.js"
import {
  type OidcConsentRevokeRequest,
  oidcConsentRevokeRequestSchema,
} from "../public/oidcConsentRevokeRequestSchema.js"
import {
  type OidcConsentRevokeResponse,
  oidcConsentRevokeResponseSchema,
} from "../public/oidcConsentRevokeResponseSchema.js"
import { type OidcDiscovery, oidcDiscoverySchema } from "../public/oidcDiscoverySchema.js"
import { type OidcJwks, oidcJwksSchema } from "../public/oidcJwksSchema.js"
import { type OidcLogoutRequest, oidcLogoutRequestSchema } from "../public/oidcLogoutRequestSchema.js"
import { type OidcLogoutResponse, oidcLogoutResponseSchema } from "../public/oidcLogoutResponseSchema.js"
import {
  type OidcSigningKeyLifecycleRequest,
  oidcSigningKeyLifecycleRequestSchema,
} from "../public/oidcSigningKeyLifecycleRequestSchema.js"
import {
  type OidcSigningKeyListResponse,
  oidcSigningKeyListResponseSchema,
} from "../public/oidcSigningKeyListResponseSchema.js"
import { type OidcSigningKeyResponse, oidcSigningKeyResponseSchema } from "../public/oidcSigningKeyResponseSchema.js"
import { oidcTokenErrorSchema } from "../public/oidcTokenErrorSchema.js"
import { type OidcTokenRequest, oidcTokenRequestSchema } from "../public/oidcTokenRequestSchema.js"
import { type OidcTokenResponse, oidcTokenResponseSchema } from "../public/oidcTokenResponseSchema.js"
import { type OidcTokenRevokeRequest, oidcTokenRevokeRequestSchema } from "../public/oidcTokenRevokeRequestSchema.js"
import { oidcUserInfoErrorSchema } from "../public/oidcUserInfoErrorSchema.js"
import { type OidcUserInfo, oidcUserInfoSchema } from "../public/oidcUserInfoSchema.js"

type OidcApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type OidcApiClientCreateOptions = {
  readonly baseUrl: string
  readonly csrfToken?: string
  readonly fetch?: OidcApiFetch
  readonly token?: Secret | string
}

export function oidcApiClientCreate(options: OidcApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      invalidResponseErrorGet: (body) => {
        const consent = v.safeParse(oidcAuthorizationConsentRequiredSchema, body)
        if (!consent.success) return undefined
        const error = resultErrorCodedCreate(
          "oidcAuthorizationConsentRequired",
          "User consent is required.",
          "oidc.authorization-consent-required",
        )
        error.errorData = JSON.stringify(consent.output)
        return error
      },
      op: "oidcApiClientRequest",
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
      invalidResponseErrorGet: (body) => {
        const consent = v.safeParse(oidcAuthorizationConsentRequiredSchema, body)
        if (!consent.success) return undefined
        const error = resultErrorCodedCreate(
          "oidcAuthorizationConsentRequired",
          "User consent is required.",
          "oidc.authorization-consent-required",
        )
        error.errorData = JSON.stringify(consent.output)
        return error
      },
      op: "oidcApiClientRequest",
      path,
      schema,
      token: options.token,
    })
  const browserRequestInit = (init: RequestInit): RequestInit => {
    const headers = new Headers(init.headers)
    if (options.csrfToken !== undefined) headers.set("x-csrf-token", options.csrfToken)
    return { ...init, credentials: "same-origin", headers }
  }
  const browserRequest = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: browserRequestInit(init),
      invalidResponseErrorGet: (body) => {
        const consent = v.safeParse(oidcAuthorizationConsentRequiredSchema, body)
        if (!consent.success) return undefined
        const error = resultErrorCodedCreate(
          "oidcAuthorizationConsentRequired",
          "User consent is required.",
          "oidc.authorization-consent-required",
        )
        error.errorData = JSON.stringify(consent.output)
        return error
      },
      op: "oidcApiClientBrowserRequest",
      path,
      schema,
    })
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
      op: "oidcApiClientBrowserRequest",
      path,
      schema,
    })

  const tokenRequest = (input: OidcTokenRequest): Promise<Result<OidcTokenResponse>> => {
    const body = new URLSearchParams()
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) body.set(key, value)
    }
    return httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { body, method: "POST" },
      invalidResponseMessage: "The server returned an invalid token response.",
      op: "oidcApiClientTokenIssue",
      path: "/oauth2/token",
      responseErrorMessageGet: (responseBody) => {
        const parsedError = v.safeParse(oidcTokenErrorSchema, responseBody)
        return parsedError.success ? (parsedError.output.error_description ?? parsedError.output.error) : undefined
      },
      schema: oidcTokenResponseSchema,
    })
  }

  const userInfoRequest = (method: "GET" | "POST"): Promise<Result<OidcUserInfo>> => {
    const op = method === "GET" ? "oidcApiClientUserInfoGet" : "oidcApiClientUserInfoPost"
    return httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { method },
      invalidResponseMessage: "The server returned an invalid UserInfo response.",
      op,
      path: "/oauth2/userinfo",
      responseErrorMessageGet: (body) => {
        const parsedError = v.safeParse(oidcUserInfoErrorSchema, body)
        return parsedError.success ? (parsedError.output.error_description ?? parsedError.output.error) : undefined
      },
      schema: oidcUserInfoSchema,
      token: options.token,
    })
  }

  const tokenRevokeRequest = (input: OidcTokenRevokeRequest): Promise<Result<void>> => {
    const body = new URLSearchParams()
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) body.set(key, value)
    }
    return httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { body, method: "POST" },
      op: "oidcApiClientTokenRevoke",
      path: "/oauth2/revoke",
      responseErrorMessageGet: (responseBody) => {
        const parsedError = v.safeParse(oidcTokenErrorSchema, responseBody)
        return parsedError.success ? (parsedError.output.error_description ?? parsedError.output.error) : undefined
      },
      schema: v.undefined(),
    })
  }

  const managementPath = (realmId: string, suffix = "") => `/system/realms/${encodeURIComponent(realmId)}/oidc${suffix}`
  const browserManagementPath = (realmId: string, suffix = "") => `/realms/${encodeURIComponent(realmId)}/oidc${suffix}`

  return {
    oidcAuthorizationCodeRedeem(
      input: OidcAuthorizationCodeRedeemRequest,
    ): Promise<Result<OidcAuthorizationCodeRedeemResponse>> {
      const parsed = v.safeParse(oidcAuthorizationCodeRedeemRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientAuthorizationCodeRedeem",
            "The authorization code request is invalid.",
            "oidc.invalid",
          ),
        )
      return request(
        "/oauth2/authorization-code/redeem",
        { body: JSON.stringify(parsed.output), method: "POST" },
        oidcAuthorizationCodeRedeemResponseSchema,
      )
    },

    oidcAuthorizationRequestAuthorize(input: OidcAuthorizationRequest): Promise<Result<OidcAuthorizationResponse>> {
      const parsed = v.safeParse(oidcAuthorizationRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientAuthorizationRequestAuthorize",
            "The OIDC authorization request is invalid.",
            "oidc.invalid-request",
          ),
        )
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(parsed.output)) {
        if (value !== undefined) query.set(key, value)
      }
      return request(`/oauth2/authorize?${query.toString()}`, { method: "GET" }, oidcAuthorizationResponseSchema)
    },

    oidcAuthorizationRequestConsent(
      input: OidcAuthorizationConsentRequest,
    ): Promise<Result<OidcAuthorizationConsentResponse>> {
      const parsed = v.safeParse(oidcAuthorizationConsentRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientAuthorizationRequestConsent",
            "The consent request is invalid.",
            "oidc.invalid-request",
          ),
        )
      return request(
        "/oauth2/consent",
        { body: JSON.stringify(parsed.output), method: "POST" },
        oidcAuthorizationConsentResponseSchema,
      )
    },

    oidcTokenIssue(input: OidcTokenRequest): Promise<Result<OidcTokenResponse>> {
      const parsed = v.safeParse(oidcTokenRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate("oidcApiClientTokenIssue", "The token request is invalid.", "oidc.invalid-request"),
        )
      return tokenRequest(parsed.output)
    },

    oidcUserInfoGet(): Promise<Result<OidcUserInfo>> {
      return userInfoRequest("GET")
    },

    oidcUserInfoPost(): Promise<Result<OidcUserInfo>> {
      return userInfoRequest("POST")
    },

    oidcTokenRevoke(input: OidcTokenRevokeRequest): Promise<Result<void>> {
      const parsed = v.safeParse(oidcTokenRevokeRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientTokenRevoke",
            "The token revocation request is invalid.",
            "oidc.invalid-request",
          ),
        )
      return tokenRevokeRequest(parsed.output)
    },

    oidcLogout(input: OidcLogoutRequest): Promise<Result<OidcLogoutResponse | undefined>> {
      const parsed = v.safeParse(oidcLogoutRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate("oidcApiClientLogout", "The logout request is invalid.", "oidc.invalid-request"),
        )
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(parsed.output)) {
        if (value !== undefined) query.set(key, value)
      }
      return request(
        `/oauth2/logout?${query.toString()}`,
        { method: "GET" },
        v.union([oidcLogoutResponseSchema, v.undefined()]),
      )
    },

    oidcConsentList(realmId: string, userId: string, query?: ListQuery): Promise<Result<OidcConsentListResponse>> {
      return request(
        oidcListPath(managementPath(realmId, `/consents/${encodeURIComponent(userId)}`), query),
        { method: "GET" },
        oidcConsentListResponseSchema,
      )
    },

    oidcConsentMeList(realmId: string, query?: ListQuery): Promise<Result<OidcConsentListResponse>> {
      return request(
        oidcListPath(`/realms/${encodeURIComponent(realmId)}/me/consents`, query),
        { method: "GET" },
        oidcConsentListResponseSchema,
      )
    },

    oidcConsentRevoke(
      realmId: string,
      userId: string,
      input: OidcConsentRevokeRequest,
    ): Promise<Result<OidcConsentRevokeResponse>> {
      const parsed = v.safeParse(oidcConsentRevokeRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientConsentRevoke",
            "The consent request is invalid.",
            "oidc.invalid-request",
          ),
        )
      return request(
        managementPath(
          realmId,
          `/consents/${encodeURIComponent(userId)}/${encodeURIComponent(parsed.output.client_id)}/revoke`,
        ),
        { method: "POST" },
        oidcConsentRevokeResponseSchema,
      )
    },

    oidcConsentMeRevoke(realmId: string, input: OidcConsentRevokeRequest): Promise<Result<OidcConsentRevokeResponse>> {
      const parsed = v.safeParse(oidcConsentRevokeRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientConsentMeRevoke",
            "The consent request is invalid.",
            "oidc.invalid-request",
          ),
        )
      return request(
        `/realms/${encodeURIComponent(realmId)}/me/consents/${encodeURIComponent(parsed.output.client_id)}/revoke`,
        { method: "POST" },
        oidcConsentRevokeResponseSchema,
      )
    },

    oidcConsentTenantList(
      realmId: string,
      userId: string,
      query?: ListQuery,
    ): Promise<Result<OidcConsentListResponse>> {
      return browserRequest(
        oidcListPath(browserManagementPath(realmId, `/consents/${encodeURIComponent(userId)}`), query),
        { method: "GET" },
        oidcConsentListResponseSchema,
      )
    },

    oidcConsentTenantRevoke(
      realmId: string,
      userId: string,
      input: OidcConsentRevokeRequest,
    ): Promise<Result<OidcConsentRevokeResponse>> {
      const parsed = v.safeParse(oidcConsentRevokeRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientConsentTenantRevoke",
            "The consent request is invalid.",
            "oidc.invalid-request",
          ),
        )
      return browserRequest(
        browserManagementPath(
          realmId,
          `/consents/${encodeURIComponent(userId)}/${encodeURIComponent(parsed.output.client_id)}/revoke`,
        ),
        { method: "POST" },
        oidcConsentRevokeResponseSchema,
      )
    },

    oidcClientTenantCreate(realmId: string, input: OidcClientCreateRequest): Promise<Result<OidcClientCreateResponse>> {
      const parsed = v.safeParse(oidcClientCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientTenantClientCreate",
            "The OIDC client request is invalid.",
            "oidc.invalid",
          ),
        )
      return browserRequest(
        browserManagementPath(realmId, "/clients"),
        { body: JSON.stringify(parsed.output), method: "POST" },
        oidcClientCreateResponseSchema,
      )
    },

    oidcClientTenantGet(
      realmId: string,
      clientId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<OidcClientResponse>> {
      return browserGetRequest(
        browserManagementPath(realmId, `/clients/${encodeURIComponent(clientId)}`),
        oidcClientResponseSchema,
        getOptions,
      )
    },

    oidcClientTenantList(realmId: string, query?: ListQuery): Promise<Result<OidcClientListResponse>> {
      return browserRequest(
        oidcListPath(browserManagementPath(realmId, "/clients"), query),
        { method: "GET" },
        oidcClientListResponseSchema,
      )
    },

    oidcClientTenantUpdate(
      realmId: string,
      clientId: string,
      input: OidcClientUpdateRequest,
    ): Promise<Result<OidcClientResponse>> {
      const parsed = v.safeParse(oidcClientUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientTenantClientUpdate",
            "The OIDC client update is invalid.",
            "oidc.invalid",
          ),
        )
      return browserRequest(
        browserManagementPath(realmId, `/clients/${encodeURIComponent(clientId)}`),
        { body: JSON.stringify(parsed.output), method: "PATCH" },
        oidcClientResponseSchema,
      )
    },

    oidcClientTenantLifecycleSet(
      realmId: string,
      clientId: string,
      input: OidcClientLifecycleRequest,
    ): Promise<Result<OidcClientResponse>> {
      const parsed = v.safeParse(oidcClientLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientTenantClientLifecycleSet",
            "The OIDC client lifecycle request is invalid.",
            "oidc.invalid",
          ),
        )
      return browserRequest(
        browserManagementPath(realmId, `/clients/${encodeURIComponent(clientId)}/lifecycle`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        oidcClientResponseSchema,
      )
    },

    oidcClientTenantSecretRotate(realmId: string, clientId: string): Promise<Result<OidcClientSecretRotateResponse>> {
      return browserRequest(
        browserManagementPath(realmId, `/clients/${encodeURIComponent(clientId)}/secret/rotate`),
        { method: "POST" },
        oidcClientSecretRotateResponseSchema,
      )
    },

    oidcClientTenantSecretRevoke(realmId: string, clientId: string): Promise<Result<OidcClientResponse>> {
      return browserRequest(
        browserManagementPath(realmId, `/clients/${encodeURIComponent(clientId)}/secret/revoke`),
        { method: "POST" },
        oidcClientResponseSchema,
      )
    },

    oidcSigningKeyTenantCreate(realmId: string): Promise<Result<OidcSigningKeyResponse>> {
      return browserRequest(
        browserManagementPath(realmId, "/signing-keys"),
        { method: "POST" },
        oidcSigningKeyResponseSchema,
      )
    },

    oidcSigningKeyTenantList(realmId: string, query?: ListQuery): Promise<Result<OidcSigningKeyListResponse>> {
      return browserRequest(
        oidcListPath(browserManagementPath(realmId, "/signing-keys"), query),
        { method: "GET" },
        oidcSigningKeyListResponseSchema,
      )
    },

    oidcSigningKeyTenantRotate(realmId: string): Promise<Result<OidcSigningKeyResponse>> {
      return browserRequest(
        browserManagementPath(realmId, "/signing-keys/rotate"),
        { method: "POST" },
        oidcSigningKeyResponseSchema,
      )
    },

    oidcSigningKeyTenantLifecycleSet(
      realmId: string,
      signingKeyId: string,
      input: OidcSigningKeyLifecycleRequest,
    ): Promise<Result<OidcSigningKeyResponse>> {
      const parsed = v.safeParse(oidcSigningKeyLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientTenantSigningKeyLifecycleSet",
            "The signing key lifecycle request is invalid.",
            "oidc.invalid",
          ),
        )
      return browserRequest(
        browserManagementPath(realmId, `/signing-keys/${encodeURIComponent(signingKeyId)}/lifecycle`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        oidcSigningKeyResponseSchema,
      )
    },

    oidcClientCreate(realmId: string, input: OidcClientCreateRequest): Promise<Result<OidcClientCreateResponse>> {
      const parsed = v.safeParse(oidcClientCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate("oidcApiClientClientCreate", "The OIDC client request is invalid.", "oidc.invalid"),
        )
      return request(
        managementPath(realmId, "/clients"),
        { body: JSON.stringify(parsed.output), method: "POST" },
        oidcClientCreateResponseSchema,
      )
    },

    oidcClientGet(
      realmId: string,
      clientId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<OidcClientResponse>> {
      return getRequest(
        managementPath(realmId, `/clients/${encodeURIComponent(clientId)}`),
        oidcClientResponseSchema,
        getOptions,
      )
    },

    oidcClientList(realmId: string, query?: ListQuery): Promise<Result<OidcClientListResponse>> {
      return request(
        oidcListPath(managementPath(realmId, "/clients"), query),
        { method: "GET" },
        oidcClientListResponseSchema,
      )
    },

    oidcClientUpdate(
      realmId: string,
      clientId: string,
      input: OidcClientUpdateRequest,
    ): Promise<Result<OidcClientResponse>> {
      const parsed = v.safeParse(oidcClientUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate("oidcApiClientClientUpdate", "The OIDC client update is invalid.", "oidc.invalid"),
        )
      return request(
        managementPath(realmId, `/clients/${encodeURIComponent(clientId)}`),
        { body: JSON.stringify(parsed.output), method: "PATCH" },
        oidcClientResponseSchema,
      )
    },

    oidcClientLifecycleSet(
      realmId: string,
      clientId: string,
      input: OidcClientLifecycleRequest,
    ): Promise<Result<OidcClientResponse>> {
      const parsed = v.safeParse(oidcClientLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientClientLifecycleSet",
            "The OIDC client lifecycle request is invalid.",
            "oidc.invalid",
          ),
        )
      return request(
        managementPath(realmId, `/clients/${encodeURIComponent(clientId)}/lifecycle`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        oidcClientResponseSchema,
      )
    },

    oidcClientSecretRotate(realmId: string, clientId: string): Promise<Result<OidcClientSecretRotateResponse>> {
      return request(
        managementPath(realmId, `/clients/${encodeURIComponent(clientId)}/secret/rotate`),
        { method: "POST" },
        oidcClientSecretRotateResponseSchema,
      )
    },

    oidcClientSecretRevoke(realmId: string, clientId: string): Promise<Result<OidcClientResponse>> {
      return request(
        managementPath(realmId, `/clients/${encodeURIComponent(clientId)}/secret/revoke`),
        { method: "POST" },
        oidcClientResponseSchema,
      )
    },

    oidcSigningKeyCreate(realmId: string): Promise<Result<OidcSigningKeyResponse>> {
      return request(managementPath(realmId, "/signing-keys"), { method: "POST" }, oidcSigningKeyResponseSchema)
    },

    oidcSigningKeyRotate(realmId: string): Promise<Result<OidcSigningKeyResponse>> {
      return request(managementPath(realmId, "/signing-keys/rotate"), { method: "POST" }, oidcSigningKeyResponseSchema)
    },

    oidcSigningKeyList(realmId: string, query?: ListQuery): Promise<Result<OidcSigningKeyListResponse>> {
      return request(
        oidcListPath(managementPath(realmId, "/signing-keys"), query),
        { method: "GET" },
        oidcSigningKeyListResponseSchema,
      )
    },

    oidcSigningKeyLifecycleSet(
      realmId: string,
      signingKeyId: string,
      input: OidcSigningKeyLifecycleRequest,
    ): Promise<Result<OidcSigningKeyResponse>> {
      const parsed = v.safeParse(oidcSigningKeyLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate(
            "oidcApiClientSigningKeyLifecycleSet",
            "The signing key lifecycle request is invalid.",
            "oidc.invalid",
          ),
        )
      return request(
        managementPath(realmId, `/signing-keys/${encodeURIComponent(signingKeyId)}/lifecycle`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        oidcSigningKeyResponseSchema,
      )
    },

    oidcDiscoveryGet(): Promise<Result<OidcDiscovery>> {
      return request("/.well-known/openid-configuration", { method: "GET" }, oidcDiscoverySchema)
    },

    oidcJwksGet(): Promise<Result<OidcJwks>> {
      return request("/.well-known/jwks.json", { method: "GET" }, oidcJwksSchema)
    },
  }
}

function oidcListPath(path: string, query: ListQuery | undefined): string {
  if (query === undefined) return path
  const params = new URLSearchParams()
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize))
  if (query.pageToken !== undefined) params.set("pageToken", query.pageToken)
  if (query.sortBy !== undefined) params.set("sortBy", query.sortBy)
  if (query.sortDirection !== undefined) params.set("sortDirection", query.sortDirection)
  const encoded = params.toString()
  return encoded.length === 0 ? path : `${path}?${encoded}`
}
