import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
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
  type OidcAuthorizationRequest,
  oidcAuthorizationRequestSchema,
} from "../public/oidcAuthorizationRequestSchema.js"
import {
  type OidcAuthorizationConsentRequest,
  oidcAuthorizationConsentRequestSchema,
} from "../public/oidcAuthorizationConsentRequestSchema.js"
import {
  type OidcAuthorizationConsentResponse,
  oidcAuthorizationConsentResponseSchema,
} from "../public/oidcAuthorizationConsentResponseSchema.js"
import { oidcAuthorizationConsentRequiredSchema } from "../public/oidcAuthorizationConsentRequiredSchema.js"
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
import { type OidcDiscovery, oidcDiscoverySchema } from "../public/oidcDiscoverySchema.js"
import { type OidcConsentListResponse, oidcConsentListResponseSchema } from "../public/oidcConsentListResponseSchema.js"
import {
  type OidcConsentRevokeRequest,
  oidcConsentRevokeRequestSchema,
} from "../public/oidcConsentRevokeRequestSchema.js"
import {
  type OidcConsentRevokeResponse,
  oidcConsentRevokeResponseSchema,
} from "../public/oidcConsentRevokeResponseSchema.js"
import { type OidcLogoutRequest, oidcLogoutRequestSchema } from "../public/oidcLogoutRequestSchema.js"
import { type OidcLogoutResponse, oidcLogoutResponseSchema } from "../public/oidcLogoutResponseSchema.js"
import { type OidcJwks, oidcJwksSchema } from "../public/oidcJwksSchema.js"
import { type OidcTokenRequest, oidcTokenRequestSchema } from "../public/oidcTokenRequestSchema.js"
import { type OidcTokenRevokeRequest, oidcTokenRevokeRequestSchema } from "../public/oidcTokenRevokeRequestSchema.js"
import { oidcTokenErrorSchema } from "../public/oidcTokenErrorSchema.js"
import { type OidcTokenResponse, oidcTokenResponseSchema } from "../public/oidcTokenResponseSchema.js"
import { type OidcUserInfo, oidcUserInfoSchema } from "../public/oidcUserInfoSchema.js"
import { oidcUserInfoErrorSchema } from "../public/oidcUserInfoErrorSchema.js"
import {
  type OidcSigningKeyLifecycleRequest,
  oidcSigningKeyLifecycleRequestSchema,
} from "../public/oidcSigningKeyLifecycleRequestSchema.js"
import {
  type OidcSigningKeyListResponse,
  oidcSigningKeyListResponseSchema,
} from "../public/oidcSigningKeyListResponseSchema.js"
import { type OidcSigningKeyResponse, oidcSigningKeyResponseSchema } from "../public/oidcSigningKeyResponseSchema.js"

type OidcApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type OidcApiClientCreateOptions = {
  readonly baseUrl: string
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
        return resultErrorCreate(
          "oidcAuthorizationConsentRequired",
          "User consent is required.",
          JSON.stringify(consent.output),
        )
      },
      op: "oidcApiClientRequest",
      path,
      schema,
      token: options.token,
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

  return {
    oidcAuthorizationCodeRedeem(
      input: OidcAuthorizationCodeRedeemRequest,
    ): Promise<Result<OidcAuthorizationCodeRedeemResponse>> {
      const parsed = v.safeParse(oidcAuthorizationCodeRedeemRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("oidcApiClientAuthorizationCodeRedeem", "The authorization code request is invalid."),
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
          resultErrorCreate("oidcApiClientAuthorizationRequestAuthorize", "The OIDC authorization request is invalid."),
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
          resultErrorCreate("oidcApiClientAuthorizationRequestConsent", "The consent request is invalid."),
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
        return Promise.resolve(resultErrorCreate("oidcApiClientTokenIssue", "The token request is invalid."))
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
          resultErrorCreate("oidcApiClientTokenRevoke", "The token revocation request is invalid."),
        )
      return tokenRevokeRequest(parsed.output)
    },

    oidcLogout(input: OidcLogoutRequest): Promise<Result<OidcLogoutResponse>> {
      const parsed = v.safeParse(oidcLogoutRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("oidcApiClientLogout", "The logout request is invalid."))
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(parsed.output)) {
        if (value !== undefined) query.set(key, value)
      }
      return request(`/oauth2/logout?${query.toString()}`, { method: "GET" }, oidcLogoutResponseSchema)
    },

    oidcConsentList(realmId: string, userId: string): Promise<Result<OidcConsentListResponse>> {
      return request(
        managementPath(realmId, `/consents/${encodeURIComponent(userId)}`),
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
        return Promise.resolve(resultErrorCreate("oidcApiClientConsentRevoke", "The consent request is invalid."))
      return request(
        managementPath(
          realmId,
          `/consents/${encodeURIComponent(userId)}/${encodeURIComponent(input.client_id)}/revoke`,
        ),
        { method: "POST" },
        oidcConsentRevokeResponseSchema,
      )
    },

    oidcClientCreate(realmId: string, input: OidcClientCreateRequest): Promise<Result<OidcClientCreateResponse>> {
      const parsed = v.safeParse(oidcClientCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("oidcApiClientClientCreate", "The OIDC client request is invalid."))
      return request(
        managementPath(realmId, "/clients"),
        { body: JSON.stringify(parsed.output), method: "POST" },
        oidcClientCreateResponseSchema,
      )
    },

    oidcClientGet(realmId: string, clientId: string): Promise<Result<OidcClientResponse>> {
      return request(
        managementPath(realmId, `/clients/${encodeURIComponent(clientId)}`),
        { method: "GET" },
        oidcClientResponseSchema,
      )
    },

    oidcClientList(realmId: string): Promise<Result<OidcClientListResponse>> {
      return request(managementPath(realmId, "/clients"), { method: "GET" }, oidcClientListResponseSchema)
    },

    oidcClientUpdate(
      realmId: string,
      clientId: string,
      input: OidcClientUpdateRequest,
    ): Promise<Result<OidcClientResponse>> {
      const parsed = v.safeParse(oidcClientUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("oidcApiClientClientUpdate", "The OIDC client update is invalid."))
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
          resultErrorCreate("oidcApiClientClientLifecycleSet", "The OIDC client lifecycle request is invalid."),
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

    oidcSigningKeyCreate(realmId: string): Promise<Result<OidcSigningKeyResponse>> {
      return request(managementPath(realmId, "/signing-keys"), { method: "POST" }, oidcSigningKeyResponseSchema)
    },

    oidcSigningKeyList(realmId: string): Promise<Result<OidcSigningKeyListResponse>> {
      return request(managementPath(realmId, "/signing-keys"), { method: "GET" }, oidcSigningKeyListResponseSchema)
    },

    oidcSigningKeyLifecycleSet(
      realmId: string,
      signingKeyId: string,
      input: OidcSigningKeyLifecycleRequest,
    ): Promise<Result<OidcSigningKeyResponse>> {
      const parsed = v.safeParse(oidcSigningKeyLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("oidcApiClientSigningKeyLifecycleSet", "The signing key lifecycle request is invalid."),
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
