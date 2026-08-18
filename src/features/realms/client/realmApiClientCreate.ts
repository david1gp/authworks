import * as v from "valibot"
import { type Result } from "#result"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import {
  type RealmBootstrapAdminResponse,
  realmBootstrapAdminResponseSchema,
} from "../public/realmBootstrapAdminResponseSchema.js"
import type { RealmCreateRequest } from "../public/realmCreateRequestSchema.js"
import { type RealmListResponse, realmListResponseSchema } from "../public/realmListResponseSchema.js"
import { type RealmResponse, realmResponseSchema } from "../public/realmResponseSchema.js"
import type { RealmUpdateRequest } from "../public/realmUpdateRequestSchema.js"

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
    realmGet(realmId: string): Promise<Result<RealmResponse>> {
      return request(`/system/realms/${encodeURIComponent(realmId)}`, { method: "GET" }, realmResponseSchema)
    },
    realmList(): Promise<Result<RealmListResponse>> {
      return request("/system/realms", { method: "GET" }, realmListResponseSchema)
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
