import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import type { PasskeyAuthenticationCompleteRequest } from "../public/passkeyAuthenticationCompleteRequestSchema.js"
import { passkeyAuthenticationCompleteRequestSchema } from "../public/passkeyAuthenticationCompleteRequestSchema.js"
import { passkeyAuthenticationCompleteResponseSchema } from "../public/passkeyAuthenticationCompleteResponseSchema.js"
import { passkeyAuthenticationStartResponseSchema } from "../public/passkeyAuthenticationStartResponseSchema.js"
import type { PasskeyAuthenticationStartRequest } from "../public/passkeyAuthenticationStartRequestSchema.js"
import { passkeyAuthenticationStartRequestSchema } from "../public/passkeyAuthenticationStartRequestSchema.js"
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
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "passkeyApiClientRequest",
      path,
      schema,
      token: options.token,
    })
  const parsed = <T>(schema: v.GenericSchema<T>, input: unknown, message: string): Result<T> => {
    const value = v.safeParse(schema, input)
    return value.success ? resultCreate(value.output) : resultErrorCreate("passkeyApiClientCreate", message)
  }
  const json = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })

  return {
    passkeyRegistrationStart(realmId: string) {
      return request(
        `/realms/${encodeURIComponent(realmId)}/passkeys/registration/start`,
        json({}),
        passkeyRegistrationStartResponseSchema,
      )
    },
    passkeyRegistrationComplete(realmId: string, input: PasskeyRegistrationCompleteRequest) {
      const checked = parsed(
        passkeyRegistrationCompleteRequestSchema,
        input,
        "The passkey registration response is invalid.",
      )
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/realms/${encodeURIComponent(realmId)}/passkeys/registration/complete`,
        json(checked.data),
        passkeyRegistrationCompleteResponseSchema,
      )
    },
    passkeyAuthenticationStart(realmId: string, input: PasskeyAuthenticationStartRequest = {}) {
      const checked = parsed(
        passkeyAuthenticationStartRequestSchema,
        input,
        "The passkey authentication request is invalid.",
      )
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/realms/${encodeURIComponent(realmId)}/passkeys/authentication/start`,
        json(checked.data),
        passkeyAuthenticationStartResponseSchema,
      )
    },
    passkeyAuthenticationComplete(realmId: string, input: PasskeyAuthenticationCompleteRequest) {
      const checked = parsed(
        passkeyAuthenticationCompleteRequestSchema,
        input,
        "The passkey authentication response is invalid.",
      )
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/realms/${encodeURIComponent(realmId)}/passkeys/authentication/complete`,
        json(checked.data),
        passkeyAuthenticationCompleteResponseSchema,
      )
    },
    passkeyMfaStart(realmId: string) {
      return request(
        `/realms/${encodeURIComponent(realmId)}/passkeys/mfa/start`,
        json({}),
        passkeyAuthenticationStartResponseSchema,
      )
    },
    passkeyMfaComplete(realmId: string, input: PasskeyAuthenticationCompleteRequest) {
      const checked = parsed(
        passkeyAuthenticationCompleteRequestSchema,
        input,
        "The passkey authentication response is invalid.",
      )
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/realms/${encodeURIComponent(realmId)}/passkeys/mfa/complete`,
        json(checked.data),
        passkeyAuthenticationCompleteResponseSchema,
      )
    },
    passkeyStepUpStart(realmId: string) {
      return request(
        `/realms/${encodeURIComponent(realmId)}/passkeys/step-up/start`,
        json({}),
        passkeyAuthenticationStartResponseSchema,
      )
    },
    passkeyStepUpComplete(realmId: string, input: PasskeyAuthenticationCompleteRequest) {
      const checked = parsed(
        passkeyAuthenticationCompleteRequestSchema,
        input,
        "The passkey authentication response is invalid.",
      )
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/realms/${encodeURIComponent(realmId)}/passkeys/step-up/complete`,
        json(checked.data),
        passkeyAuthenticationCompleteResponseSchema,
      )
    },
    passkeyCredentialList(realmId: string): Promise<Result<PasskeyCredentialListResponse>> {
      return request(
        `/realms/${encodeURIComponent(realmId)}/passkeys`,
        { method: "GET" },
        passkeyCredentialListResponseSchema,
      )
    },
    passkeyCredentialRevoke(realmId: string, input: PasskeyCredentialRevokeRequest) {
      const checked = parsed(passkeyCredentialRevokeRequestSchema, input, "The passkey credential is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/realms/${encodeURIComponent(realmId)}/passkeys`,
        { ...json(checked.data), method: "DELETE" },
        passkeyCredentialRevokeResponseSchema,
      )
    },
  }
}
