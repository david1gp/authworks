import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpErrorResponseSchema } from "../../../platform/http/httpErrorResponseSchema.js"
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
  const request = async <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> => {
    const op = "oidcApiClientRequest"
    const headers = new Headers(init.headers)
    headers.set("accept", "application/json")
    if (init.body !== undefined) headers.set("content-type", "application/json")
    if (options.token !== undefined)
      headers.set(
        "authorization",
        `Bearer ${options.token instanceof Secret ? options.token.valueGet() : options.token}`,
      )
    try {
      const response = await (options.fetch ?? fetch)(new URL(path, options.baseUrl), { ...init, headers })
      const body = await response.json().catch(() => undefined)
      if (!response.ok) {
        const parsedError = v.safeParse(httpErrorResponseSchema, body)
        if (!parsedError.success) return resultErrorCreate(op, `The server returned HTTP ${response.status}.`)
        return resultErrorCreate(op, `${parsedError.output.error.code}: ${parsedError.output.error.message}`)
      }
      const parsed = v.safeParse(schema, body)
      if (!parsed.success) return resultErrorCreate(op, "The server returned an invalid response.")
      return resultCreate(parsed.output)
    } catch (_error) {
      return resultErrorCreate(op, "The server could not be reached.")
    }
  }

  const tokenRequest = async (input: OidcTokenRequest): Promise<Result<OidcTokenResponse>> => {
    const op = "oidcApiClientTokenIssue"
    const body = new URLSearchParams()
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) body.set(key, value)
    }
    try {
      const response = await (options.fetch ?? fetch)(new URL("/oauth2/token", options.baseUrl), {
        body,
        headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      })
      const responseBody = await response.json().catch(() => undefined)
      if (!response.ok) {
        const parsedError = v.safeParse(oidcTokenErrorSchema, responseBody)
        if (!parsedError.success) return resultErrorCreate(op, `The server returned HTTP ${response.status}.`)
        return resultErrorCreate(op, parsedError.output.error_description ?? parsedError.output.error)
      }
      const parsed = v.safeParse(oidcTokenResponseSchema, responseBody)
      if (!parsed.success) return resultErrorCreate(op, "The server returned an invalid token response.")
      return resultCreate(parsed.output)
    } catch (_error) {
      return resultErrorCreate(op, "The server could not be reached.")
    }
  }

  const userInfoRequest = async (method: "GET" | "POST"): Promise<Result<OidcUserInfo>> => {
    const op = method === "GET" ? "oidcApiClientUserInfoGet" : "oidcApiClientUserInfoPost"
    const headers = new Headers({ accept: "application/json" })
    if (options.token !== undefined)
      headers.set(
        "authorization",
        `Bearer ${options.token instanceof Secret ? options.token.valueGet() : options.token}`,
      )
    try {
      const response = await (options.fetch ?? fetch)(new URL("/oauth2/userinfo", options.baseUrl), { headers, method })
      const body = await response.json().catch(() => undefined)
      if (!response.ok) {
        const parsedError = v.safeParse(oidcUserInfoErrorSchema, body)
        if (!parsedError.success) return resultErrorCreate(op, `The server returned HTTP ${response.status}.`)
        return resultErrorCreate(op, parsedError.output.error_description ?? parsedError.output.error)
      }
      const parsed = v.safeParse(oidcUserInfoSchema, body)
      if (!parsed.success) return resultErrorCreate(op, "The server returned an invalid UserInfo response.")
      return resultCreate(parsed.output)
    } catch (_error) {
      return resultErrorCreate(op, "The server could not be reached.")
    }
  }

  const tokenRevokeRequest = async (input: OidcTokenRevokeRequest): Promise<Result<void>> => {
    const op = "oidcApiClientTokenRevoke"
    const body = new URLSearchParams()
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) body.set(key, value)
    }
    try {
      const response = await (options.fetch ?? fetch)(new URL("/oauth2/revoke", options.baseUrl), {
        body,
        headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      })
      const responseBody = await response.json().catch(() => undefined)
      if (!response.ok) {
        const parsedError = v.safeParse(oidcTokenErrorSchema, responseBody)
        if (!parsedError.success) return resultErrorCreate(op, `The server returned HTTP ${response.status}.`)
        return resultErrorCreate(op, parsedError.output.error_description ?? parsedError.output.error)
      }
      return resultCreate(undefined)
    } catch (_error) {
      return resultErrorCreate(op, "The server could not be reached.")
    }
  }

  const managementPath = (instanceId: string, suffix = "") =>
    `/system/instances/${encodeURIComponent(instanceId)}/oidc${suffix}`

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

    oidcClientCreate(instanceId: string, input: OidcClientCreateRequest): Promise<Result<OidcClientCreateResponse>> {
      const parsed = v.safeParse(oidcClientCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("oidcApiClientClientCreate", "The OIDC client request is invalid."))
      return request(
        managementPath(instanceId, "/clients"),
        { body: JSON.stringify(parsed.output), method: "POST" },
        oidcClientCreateResponseSchema,
      )
    },

    oidcClientGet(instanceId: string, clientId: string): Promise<Result<OidcClientResponse>> {
      return request(
        managementPath(instanceId, `/clients/${encodeURIComponent(clientId)}`),
        { method: "GET" },
        oidcClientResponseSchema,
      )
    },

    oidcClientList(instanceId: string): Promise<Result<OidcClientListResponse>> {
      return request(managementPath(instanceId, "/clients"), { method: "GET" }, oidcClientListResponseSchema)
    },

    oidcClientUpdate(
      instanceId: string,
      clientId: string,
      input: OidcClientUpdateRequest,
    ): Promise<Result<OidcClientResponse>> {
      const parsed = v.safeParse(oidcClientUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("oidcApiClientClientUpdate", "The OIDC client update is invalid."))
      return request(
        managementPath(instanceId, `/clients/${encodeURIComponent(clientId)}`),
        { body: JSON.stringify(parsed.output), method: "PATCH" },
        oidcClientResponseSchema,
      )
    },

    oidcClientLifecycleSet(
      instanceId: string,
      clientId: string,
      input: OidcClientLifecycleRequest,
    ): Promise<Result<OidcClientResponse>> {
      const parsed = v.safeParse(oidcClientLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("oidcApiClientClientLifecycleSet", "The OIDC client lifecycle request is invalid."),
        )
      return request(
        managementPath(instanceId, `/clients/${encodeURIComponent(clientId)}/lifecycle`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        oidcClientResponseSchema,
      )
    },

    oidcClientSecretRotate(instanceId: string, clientId: string): Promise<Result<OidcClientSecretRotateResponse>> {
      return request(
        managementPath(instanceId, `/clients/${encodeURIComponent(clientId)}/secret/rotate`),
        { method: "POST" },
        oidcClientSecretRotateResponseSchema,
      )
    },

    oidcSigningKeyCreate(instanceId: string): Promise<Result<OidcSigningKeyResponse>> {
      return request(managementPath(instanceId, "/signing-keys"), { method: "POST" }, oidcSigningKeyResponseSchema)
    },

    oidcSigningKeyList(instanceId: string): Promise<Result<OidcSigningKeyListResponse>> {
      return request(managementPath(instanceId, "/signing-keys"), { method: "GET" }, oidcSigningKeyListResponseSchema)
    },

    oidcSigningKeyLifecycleSet(
      instanceId: string,
      signingKeyId: string,
      input: OidcSigningKeyLifecycleRequest,
    ): Promise<Result<OidcSigningKeyResponse>> {
      const parsed = v.safeParse(oidcSigningKeyLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("oidcApiClientSigningKeyLifecycleSet", "The signing key lifecycle request is invalid."),
        )
      return request(
        managementPath(instanceId, `/signing-keys/${encodeURIComponent(signingKeyId)}/lifecycle`),
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
