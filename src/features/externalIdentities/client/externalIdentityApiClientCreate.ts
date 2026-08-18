import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import type { ExternalIdentityCallbackResponse } from "../public/externalIdentityCallbackResponseSchema.js"
import { externalIdentityCallbackResponseSchema } from "../public/externalIdentityCallbackResponseSchema.js"
import type { ExternalIdentityLinkCompleteRequest } from "../public/externalIdentityLinkCompleteRequestSchema.js"
import { externalIdentityLinkCompleteRequestSchema } from "../public/externalIdentityLinkCompleteRequestSchema.js"
import type { ExternalIdentityLinkCompleteResponse } from "../public/externalIdentityLinkCompleteResponseSchema.js"
import { externalIdentityLinkCompleteResponseSchema } from "../public/externalIdentityLinkCompleteResponseSchema.js"
import type { ExternalIdentityListResponse } from "../public/externalIdentityListResponseSchema.js"
import { externalIdentityListResponseSchema } from "../public/externalIdentityListResponseSchema.js"
import type { ExternalIdentityProviderCreateRequest } from "../public/externalIdentityProviderCreateRequestSchema.js"
import { externalIdentityProviderCreateRequestSchema } from "../public/externalIdentityProviderCreateRequestSchema.js"
import type { ExternalIdentityProviderListResponse } from "../public/externalIdentityProviderListResponseSchema.js"
import { externalIdentityProviderListResponseSchema } from "../public/externalIdentityProviderListResponseSchema.js"
import type { ExternalIdentityProviderResponse } from "../public/externalIdentityProviderResponseSchema.js"
import { externalIdentityProviderResponseSchema } from "../public/externalIdentityProviderResponseSchema.js"
import type { ExternalIdentityProviderUpdateRequest } from "../public/externalIdentityProviderUpdateRequestSchema.js"
import { externalIdentityProviderUpdateRequestSchema } from "../public/externalIdentityProviderUpdateRequestSchema.js"
import type { ExternalIdentityStartRequest } from "../public/externalIdentityStartRequestSchema.js"
import { externalIdentityStartRequestSchema } from "../public/externalIdentityStartRequestSchema.js"
import type { ExternalIdentityStartResponse } from "../public/externalIdentityStartResponseSchema.js"
import { externalIdentityStartResponseSchema } from "../public/externalIdentityStartResponseSchema.js"
import type { ExternalIdentityUnlinkResponse } from "../public/externalIdentityUnlinkResponseSchema.js"
import { externalIdentityUnlinkResponseSchema } from "../public/externalIdentityUnlinkResponseSchema.js"

type ExternalIdentityApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type ExternalIdentityApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: ExternalIdentityApiFetch
  readonly token?: Secret | string
}

export function externalIdentityApiClientCreate(options: ExternalIdentityApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "externalIdentityApiClientRequest",
      path,
      schema,
      token: options.token,
    })

  const parsedRequest = <T>(schema: v.GenericSchema<T>, input: unknown, message: string) => {
    const parsed = v.safeParse(schema, input)
    if (!parsed.success) return resultErrorCreate("externalIdentityApiClientCreate", message)
    return resultCreate(parsed.output)
  }

  return {
    externalIdentityCallback(
      realmId: string,
      providerId: string,
      code: string,
      state: string,
    ): Promise<Result<ExternalIdentityCallbackResponse>> {
      const query = new URLSearchParams({ code, state })
      return request(
        `/realms/${encodeURIComponent(realmId)}/external-identity/${encodeURIComponent(providerId)}/callback?${query}`,
        { method: "GET" },
        externalIdentityCallbackResponseSchema,
      )
    },
    externalIdentityLinkComplete(
      realmId: string,
      userId: string,
      providerId: string,
      input: ExternalIdentityLinkCompleteRequest,
    ): Promise<Result<ExternalIdentityLinkCompleteResponse>> {
      const parsed = parsedRequest(
        externalIdentityLinkCompleteRequestSchema,
        input,
        "Explicit link confirmation is required.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/external-identities/${encodeURIComponent(providerId)}/link/complete`,
        { body: JSON.stringify(parsed.data), method: "POST" },
        externalIdentityLinkCompleteResponseSchema,
      )
    },
    externalIdentityLinkStart(
      realmId: string,
      userId: string,
      providerId: string,
      input: ExternalIdentityStartRequest = {},
    ): Promise<Result<ExternalIdentityStartResponse>> {
      const parsed = parsedRequest(
        externalIdentityStartRequestSchema,
        input,
        "The external identity link request is invalid.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/external-identities/${encodeURIComponent(providerId)}/link/start`,
        { body: JSON.stringify(parsed.data), method: "POST" },
        externalIdentityStartResponseSchema,
      )
    },
    externalIdentityList(realmId: string, userId: string): Promise<Result<ExternalIdentityListResponse>> {
      return request(
        `/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/external-identities`,
        { method: "GET" },
        externalIdentityListResponseSchema,
      )
    },
    externalIdentityProviderCreate(
      realmId: string,
      input: ExternalIdentityProviderCreateRequest,
    ): Promise<Result<ExternalIdentityProviderResponse>> {
      const parsed = parsedRequest(
        externalIdentityProviderCreateRequestSchema,
        input,
        "The provider request is invalid.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/external-identity-providers`,
        { body: JSON.stringify(parsed.data), method: "POST" },
        externalIdentityProviderResponseSchema,
      )
    },
    externalIdentityProviderDisable(
      realmId: string,
      providerId: string,
    ): Promise<Result<ExternalIdentityProviderResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/external-identity-providers/${encodeURIComponent(providerId)}/disable`,
        { method: "POST" },
        externalIdentityProviderResponseSchema,
      )
    },
    externalIdentityProviderList(
      realmId: string,
      organizationId?: string,
    ): Promise<Result<ExternalIdentityProviderListResponse>> {
      const query = organizationId === undefined ? "" : `?organizationId=${encodeURIComponent(organizationId)}`
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/external-identity-providers${query}`,
        { method: "GET" },
        externalIdentityProviderListResponseSchema,
      )
    },
    externalIdentityProviderUpdate(
      realmId: string,
      providerId: string,
      input: ExternalIdentityProviderUpdateRequest,
    ): Promise<Result<ExternalIdentityProviderResponse>> {
      const parsed = parsedRequest(
        externalIdentityProviderUpdateRequestSchema,
        input,
        "The provider update is invalid.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/external-identity-providers/${encodeURIComponent(providerId)}`,
        { body: JSON.stringify(parsed.data), method: "PATCH" },
        externalIdentityProviderResponseSchema,
      )
    },
    externalIdentityProviderPublicList(
      realmId: string,
      organizationId?: string,
    ): Promise<Result<ExternalIdentityProviderListResponse>> {
      const query = organizationId === undefined ? "" : `?organizationId=${encodeURIComponent(organizationId)}`
      return request(
        `/realms/${encodeURIComponent(realmId)}/external-identity-providers${query}`,
        { method: "GET" },
        externalIdentityProviderListResponseSchema,
      )
    },
    externalIdentityStart(
      realmId: string,
      providerId: string,
      input: ExternalIdentityStartRequest = {},
    ): Promise<Result<ExternalIdentityStartResponse>> {
      const parsed = parsedRequest(
        externalIdentityStartRequestSchema,
        input,
        "The external identity start request is invalid.",
      )
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/external-identity/${encodeURIComponent(providerId)}/start`,
        { body: JSON.stringify(parsed.data), method: "POST" },
        externalIdentityStartResponseSchema,
      )
    },
    externalIdentityUnlink(
      realmId: string,
      userId: string,
      providerId: string,
      externalSubject: string,
    ): Promise<Result<ExternalIdentityUnlinkResponse>> {
      return request(
        `/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/external-identities/${encodeURIComponent(providerId)}/${encodeURIComponent(externalSubject)}`,
        { method: "DELETE" },
        externalIdentityUnlinkResponseSchema,
      )
    },
  }
}
