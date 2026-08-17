import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import type { SessionCredentialResponse } from "../public/sessionCredentialResponseSchema.js"
import { sessionCredentialResponseSchema } from "../public/sessionCredentialResponseSchema.js"
import type { SessionListResponse } from "../public/sessionListResponseSchema.js"
import { sessionListResponseSchema } from "../public/sessionListResponseSchema.js"
import type { SessionRevokeAllRequest } from "../public/sessionRevokeAllRequestSchema.js"
import { sessionRevokeAllRequestSchema } from "../public/sessionRevokeAllRequestSchema.js"
import type { SessionResponse } from "../public/sessionResponseSchema.js"
import { sessionResponseSchema } from "../public/sessionResponseSchema.js"
import type { SessionRevocationResponse } from "../public/sessionRevocationResponseSchema.js"
import { sessionRevocationResponseSchema } from "../public/sessionRevocationResponseSchema.js"

type SessionApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type SessionApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: SessionApiFetch
  readonly token?: Secret | string
}

export function sessionApiClientCreate(options: SessionApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "sessionApiClientRequest",
      path,
      schema,
      token: options.token,
    })

  return {
    sessionCurrent(instanceId: string): Promise<Result<SessionResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/sessions/current`,
        { method: "GET" },
        sessionResponseSchema,
      )
    },
    sessionList(instanceId: string): Promise<Result<SessionListResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/sessions`,
        { method: "GET" },
        sessionListResponseSchema,
      )
    },
    sessionRecentList(instanceId: string): Promise<Result<SessionListResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/sessions/recent`,
        { method: "GET" },
        sessionListResponseSchema,
      )
    },
    sessionRotate(instanceId: string): Promise<Result<SessionCredentialResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/sessions/rotate`,
        { method: "POST" },
        sessionCredentialResponseSchema,
      )
    },
    sessionRevoke(instanceId: string, sessionId: string): Promise<Result<SessionRevocationResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/sessions/${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
        sessionRevocationResponseSchema,
      )
    },
    sessionRevokeAll(
      instanceId: string,
      input: SessionRevokeAllRequest = {},
    ): Promise<Result<SessionRevocationResponse>> {
      const parsed = v.safeParse(sessionRevokeAllRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("sessionApiClientRevokeAll", "The request is invalid."))
      return request(
        `/instances/${encodeURIComponent(instanceId)}/sessions`,
        { body: JSON.stringify(parsed.output), method: "DELETE" },
        sessionRevocationResponseSchema,
      )
    },
  }
}
