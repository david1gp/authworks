import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpErrorResponseSchema } from "../../../platform/http/httpErrorResponseSchema.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import type { PasskeyAuthenticationCompleteRequest } from "../public/passkeyAuthenticationCompleteRequestSchema.js"
import { passkeyAuthenticationCompleteRequestSchema } from "../public/passkeyAuthenticationCompleteRequestSchema.js"
import { passkeyAuthenticationCompleteResponseSchema } from "../public/passkeyAuthenticationCompleteResponseSchema.js"
import { passkeyAuthenticationStartResponseSchema } from "../public/passkeyAuthenticationStartResponseSchema.js"
import type { PasskeyCredentialListResponse } from "../public/passkeyCredentialListResponseSchema.js"
import { passkeyCredentialListResponseSchema } from "../public/passkeyCredentialListResponseSchema.js"
import type { PasskeyCredentialRevokeRequest } from "../public/passkeyCredentialRevokeRequestSchema.js"
import { passkeyCredentialRevokeRequestSchema } from "../public/passkeyCredentialRevokeRequestSchema.js"
import { passkeyCredentialRevokeResponseSchema } from "../public/passkeyCredentialRevokeResponseSchema.js"
import type { PasskeyRegistrationCompleteRequest } from "../public/passkeyRegistrationCompleteRequestSchema.js"
import { passkeyRegistrationCompleteRequestSchema } from "../public/passkeyRegistrationCompleteRequestSchema.js"
import { passkeyRegistrationCompleteResponseSchema } from "../public/passkeyRegistrationCompleteResponseSchema.js"
import { passkeyRegistrationStartResponseSchema } from "../public/passkeyRegistrationStartResponseSchema.js"

type PasskeyApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type PasskeyApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: PasskeyApiFetch
  readonly token?: Secret | string
}

export function passkeyApiClientCreate(options: PasskeyApiClientCreateOptions) {
  const request = async <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> => {
    const op = "passkeyApiClientRequest"
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
  const parsed = <T>(schema: v.GenericSchema<T>, input: unknown, message: string): Result<T> => {
    const value = v.safeParse(schema, input)
    return value.success ? resultCreate(value.output) : resultErrorCreate("passkeyApiClientCreate", message)
  }
  const json = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })

  return {
    passkeyRegistrationStart(instanceId: string) {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/passkeys/registration/start`,
        json({}),
        passkeyRegistrationStartResponseSchema,
      )
    },
    passkeyRegistrationComplete(instanceId: string, input: PasskeyRegistrationCompleteRequest) {
      const checked = parsed(
        passkeyRegistrationCompleteRequestSchema,
        input,
        "The passkey registration response is invalid.",
      )
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/instances/${encodeURIComponent(instanceId)}/passkeys/registration/complete`,
        json(checked.data),
        passkeyRegistrationCompleteResponseSchema,
      )
    },
    passkeyAuthenticationStart(instanceId: string) {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/passkeys/authentication/start`,
        json({}),
        passkeyAuthenticationStartResponseSchema,
      )
    },
    passkeyAuthenticationComplete(instanceId: string, input: PasskeyAuthenticationCompleteRequest) {
      const checked = parsed(
        passkeyAuthenticationCompleteRequestSchema,
        input,
        "The passkey authentication response is invalid.",
      )
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/instances/${encodeURIComponent(instanceId)}/passkeys/authentication/complete`,
        json(checked.data),
        passkeyAuthenticationCompleteResponseSchema,
      )
    },
    passkeyMfaStart(instanceId: string) {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/passkeys/mfa/start`,
        json({}),
        passkeyAuthenticationStartResponseSchema,
      )
    },
    passkeyMfaComplete(instanceId: string, input: PasskeyAuthenticationCompleteRequest) {
      const checked = parsed(
        passkeyAuthenticationCompleteRequestSchema,
        input,
        "The passkey authentication response is invalid.",
      )
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/instances/${encodeURIComponent(instanceId)}/passkeys/mfa/complete`,
        json(checked.data),
        passkeyAuthenticationCompleteResponseSchema,
      )
    },
    passkeyStepUpStart(instanceId: string) {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/passkeys/step-up/start`,
        json({}),
        passkeyAuthenticationStartResponseSchema,
      )
    },
    passkeyStepUpComplete(instanceId: string, input: PasskeyAuthenticationCompleteRequest) {
      const checked = parsed(
        passkeyAuthenticationCompleteRequestSchema,
        input,
        "The passkey authentication response is invalid.",
      )
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/instances/${encodeURIComponent(instanceId)}/passkeys/step-up/complete`,
        json(checked.data),
        passkeyAuthenticationCompleteResponseSchema,
      )
    },
    passkeyCredentialList(instanceId: string): Promise<Result<PasskeyCredentialListResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/passkeys`,
        { method: "GET" },
        passkeyCredentialListResponseSchema,
      )
    },
    passkeyCredentialRevoke(instanceId: string, input: PasskeyCredentialRevokeRequest) {
      const checked = parsed(passkeyCredentialRevokeRequestSchema, input, "The passkey credential is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/instances/${encodeURIComponent(instanceId)}/passkeys`,
        { ...json(checked.data), method: "DELETE" },
        passkeyCredentialRevokeResponseSchema,
      )
    },
  }
}
