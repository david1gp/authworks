import * as v from "valibot"
import { type Result } from "#result"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import {
  type InstanceBootstrapAdminResponse,
  instanceBootstrapAdminResponseSchema,
} from "../public/instanceBootstrapAdminResponseSchema.js"
import type { InstanceCreateRequest } from "../public/instanceCreateRequestSchema.js"
import { type InstanceListResponse, instanceListResponseSchema } from "../public/instanceListResponseSchema.js"
import { type InstanceResponse, instanceResponseSchema } from "../public/instanceResponseSchema.js"
import type { InstanceUpdateRequest } from "../public/instanceUpdateRequestSchema.js"

type InstanceApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type InstanceApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: InstanceApiFetch
  readonly token?: Secret | string
}

export function instanceApiClientCreate(options: InstanceApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "instanceApiClientRequest",
      path,
      schema,
      token: options.token,
    })

  return {
    instanceBootstrapAdminCreate(instanceId: string): Promise<Result<InstanceBootstrapAdminResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/bootstrap-admin`,
        { method: "POST" },
        instanceBootstrapAdminResponseSchema,
      )
    },
    instanceCreate(input: InstanceCreateRequest): Promise<Result<InstanceResponse>> {
      return request("/system/instances", { body: JSON.stringify(input), method: "POST" }, instanceResponseSchema)
    },
    instanceGet(instanceId: string): Promise<Result<InstanceResponse>> {
      return request(`/system/instances/${encodeURIComponent(instanceId)}`, { method: "GET" }, instanceResponseSchema)
    },
    instanceList(): Promise<Result<InstanceListResponse>> {
      return request("/system/instances", { method: "GET" }, instanceListResponseSchema)
    },
    instanceUpdate(instanceId: string, input: InstanceUpdateRequest): Promise<Result<InstanceResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}`,
        { body: JSON.stringify(input), method: "PATCH" },
        instanceResponseSchema,
      )
    },
  }
}
