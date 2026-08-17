import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpErrorResponseSchema } from "../../../platform/http/httpErrorResponseSchema.js"
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
  const request = async <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> => {
    const op = "instanceApiClientRequest"
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
