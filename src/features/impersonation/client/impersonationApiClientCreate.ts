import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpErrorResponseSchema } from "../../../platform/http/httpErrorResponseSchema.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import type { ImpersonationEndResponse } from "../public/impersonationEndResponseSchema.js"
import { impersonationEndResponseSchema } from "../public/impersonationEndResponseSchema.js"
import type { ImpersonationStartRequest } from "../public/impersonationStartRequestSchema.js"
import { impersonationStartRequestSchema } from "../public/impersonationStartRequestSchema.js"
import type { ImpersonationStartResponse } from "../public/impersonationStartResponseSchema.js"
import { impersonationStartResponseSchema } from "../public/impersonationStartResponseSchema.js"

type ImpersonationApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type ImpersonationApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: ImpersonationApiFetch
  readonly token?: Secret | string
}

export function impersonationApiClientCreate(options: ImpersonationApiClientCreateOptions) {
  const request = async <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> => {
    const op = "impersonationApiClientRequest"
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
    impersonationEnd(instanceId: string, sessionId: string): Promise<Result<ImpersonationEndResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/impersonations/${encodeURIComponent(sessionId)}/end`,
        { method: "POST" },
        impersonationEndResponseSchema,
      )
    },
    impersonationStart(
      instanceId: string,
      input: ImpersonationStartRequest,
    ): Promise<Result<ImpersonationStartResponse>> {
      const parsed = v.safeParse(impersonationStartRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("impersonationApiClientStart", "The request is invalid."))
      return request(
        `/instances/${encodeURIComponent(instanceId)}/impersonations`,
        { body: JSON.stringify(parsed.output), method: "POST" },
        impersonationStartResponseSchema,
      )
    },
  }
}
