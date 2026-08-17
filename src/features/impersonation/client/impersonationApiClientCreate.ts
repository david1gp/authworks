import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
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
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "impersonationApiClientRequest",
      path,
      schema,
      token: options.token,
    })

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
