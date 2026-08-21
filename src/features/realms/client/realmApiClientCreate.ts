import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { HttpGetOptions } from "../../../platform/http/HttpGetOptions.js"
import type { HttpGetResult } from "../../../platform/http/HttpGetResult.js"
import { httpApiClientGetRequest } from "../../../platform/http/httpApiClientGetRequest.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listQueryToSearchParams } from "../../../platform/http/listQueryToSearchParams.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { sessionBrowserRequest } from "../../sessions/client/sessionBrowserRequest.js"
import {
  type RealmBootstrapAdminResponse,
  realmBootstrapAdminResponseSchema,
} from "../public/realmBootstrapAdminResponseSchema.js"
import type { RealmCreateRequest } from "../public/realmCreateRequestSchema.js"
import { type RealmListResponse, realmListResponseSchema } from "../public/realmListResponseSchema.js"
import { type RealmResponse, realmResponseSchema } from "../public/realmResponseSchema.js"
import { type RealmUpdateRequest, realmUpdateRequestSchema } from "../public/realmUpdateRequestSchema.js"

type RealmApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type RealmApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: RealmApiFetch
  readonly token?: Secret | string
}

export function realmApiClientCreate(options: RealmApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "realmApiClientRequest",
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
      op: "realmApiClientRequest",
      path,
      schema,
      token: options.token,
    })

  return {
    realmBootstrapAdminCreate(realmId: string): Promise<Result<RealmBootstrapAdminResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/bootstrap-admin`,
        { method: "POST" },
        realmBootstrapAdminResponseSchema,
      )
    },
    realmCreate(input: RealmCreateRequest): Promise<Result<RealmResponse>> {
      return request("/system/realms", { body: JSON.stringify(input), method: "POST" }, realmResponseSchema)
    },
    realmGet(realmId: string, getOptions?: HttpGetOptions): Promise<HttpGetResult<RealmResponse>> {
      return getRequest(`/system/realms/${encodeURIComponent(realmId)}`, realmResponseSchema, getOptions)
    },
    realmList(query?: ListQuery): Promise<Result<RealmListResponse>> {
      return request(`/system/realms${listQueryToSearchParams(query)}`, { method: "GET" }, realmListResponseSchema)
    },
    realmTenantGet(realmId: string): Promise<Result<RealmResponse>> {
      return request(
        `/realms/${encodeURIComponent(realmId)}`,
        { credentials: "include", method: "GET" },
        realmResponseSchema,
      )
    },
    realmTenantUpdate(realmId: string, input: RealmUpdateRequest): Promise<Result<RealmResponse>> {
      const parsed = v.safeParse(realmUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("realmApiClientTenantUpdate", "The realm update is invalid.", "realms.invalid"),
        )
      return sessionBrowserRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: { body: JSON.stringify(parsed.output), method: "PATCH" },
        op: "realmTenantUpdate",
        path: `/realms/${encodeURIComponent(realmId)}`,
        realmId,
        schema: realmResponseSchema,
      })
    },
    realmUpdate(realmId: string, input: RealmUpdateRequest): Promise<Result<RealmResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}`,
        { body: JSON.stringify(input), method: "PATCH" },
        realmResponseSchema,
      )
    },
  }
}
