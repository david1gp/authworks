import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpErrorResponseSchema } from "../../../platform/http/httpErrorResponseSchema.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import type { MfaChallengeCompleteRequest } from "../public/mfaChallengeCompleteRequestSchema.js"
import { mfaChallengeCompleteRequestSchema } from "../public/mfaChallengeCompleteRequestSchema.js"
import type { MfaChallengeResponse } from "../public/mfaChallengeResponseSchema.js"
import { mfaChallengeResponseSchema } from "../public/mfaChallengeResponseSchema.js"
import type { MfaLoginResponse } from "../public/mfaLoginResponseSchema.js"
import { mfaLoginResponseSchema } from "../public/mfaLoginResponseSchema.js"
import type { MfaPolicyResponse } from "../public/mfaPolicyResponseSchema.js"
import { mfaPolicyResponseSchema } from "../public/mfaPolicyResponseSchema.js"
import type { MfaPolicySetRequest } from "../public/mfaPolicySetRequestSchema.js"
import { mfaPolicySetRequestSchema } from "../public/mfaPolicySetRequestSchema.js"
import type { MfaRecoveryCodesResponse } from "../public/mfaRecoveryCodesResponseSchema.js"
import { mfaRecoveryCodesResponseSchema } from "../public/mfaRecoveryCodesResponseSchema.js"
import type { MfaRecoveryCodeVerifyResponse } from "../public/mfaRecoveryCodeVerifyResponseSchema.js"
import { mfaRecoveryCodeVerifyResponseSchema } from "../public/mfaRecoveryCodeVerifyResponseSchema.js"
import type { MfaTotpEnrollmentConfirmRequest } from "../public/mfaTotpEnrollmentConfirmRequestSchema.js"
import { mfaTotpEnrollmentConfirmRequestSchema } from "../public/mfaTotpEnrollmentConfirmRequestSchema.js"
import type { MfaTotpEnrollmentConfirmResponse } from "../public/mfaTotpEnrollmentConfirmResponseSchema.js"
import { mfaTotpEnrollmentConfirmResponseSchema } from "../public/mfaTotpEnrollmentConfirmResponseSchema.js"
import type { MfaTotpEnrollmentRemoveResponse } from "../public/mfaTotpEnrollmentRemoveResponseSchema.js"
import { mfaTotpEnrollmentRemoveResponseSchema } from "../public/mfaTotpEnrollmentRemoveResponseSchema.js"
import type { MfaTotpEnrollmentStartRequest } from "../public/mfaTotpEnrollmentStartRequestSchema.js"
import { mfaTotpEnrollmentStartRequestSchema } from "../public/mfaTotpEnrollmentStartRequestSchema.js"
import type { MfaTotpEnrollmentStartResponse } from "../public/mfaTotpEnrollmentStartResponseSchema.js"
import { mfaTotpEnrollmentStartResponseSchema } from "../public/mfaTotpEnrollmentStartResponseSchema.js"
import type { MfaTotpVerifyResponse } from "../public/mfaTotpVerifyResponseSchema.js"
import { mfaTotpVerifyResponseSchema } from "../public/mfaTotpVerifyResponseSchema.js"

type MfaApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type MfaApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: MfaApiFetch
  readonly token?: Secret | string
  readonly systemToken?: Secret | string
}

export function mfaApiClientCreate(options: MfaApiClientCreateOptions) {
  const request = async <T>(
    path: string,
    init: RequestInit,
    schema: v.GenericSchema<T>,
    token = options.token,
  ): Promise<Result<T>> => {
    const op = "mfaApiClientRequest"
    const headers = new Headers(init.headers)
    headers.set("accept", "application/json")
    if (init.body !== undefined) headers.set("content-type", "application/json")
    if (token !== undefined)
      headers.set("authorization", `Bearer ${token instanceof Secret ? token.valueGet() : token}`)
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
    return value.success ? resultCreate(value.output) : resultErrorCreate("mfaApiClientCreate", message)
  }
  const json = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })

  return {
    mfaPolicyGet(instanceId: string): Promise<Result<MfaPolicyResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/mfa-policy`,
        { method: "GET" },
        mfaPolicyResponseSchema,
        options.systemToken,
      )
    },
    mfaPolicySet(instanceId: string, input: MfaPolicySetRequest): Promise<Result<MfaPolicyResponse>> {
      const checked = parsed(mfaPolicySetRequestSchema, input, "The MFA policy is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/mfa-policy`,
        { ...json(checked.data), method: "PATCH" },
        mfaPolicyResponseSchema,
        options.systemToken,
      )
    },
    mfaTotpEnrollmentStart(
      instanceId: string,
      input: MfaTotpEnrollmentStartRequest = {},
    ): Promise<Result<MfaTotpEnrollmentStartResponse>> {
      const checked = parsed(mfaTotpEnrollmentStartRequestSchema, input, "The TOTP enrollment request is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/instances/${encodeURIComponent(instanceId)}/mfa/totp/enroll`,
        json(checked.data),
        mfaTotpEnrollmentStartResponseSchema,
      )
    },
    mfaTotpEnrollmentConfirm(
      instanceId: string,
      input: MfaTotpEnrollmentConfirmRequest,
    ): Promise<Result<MfaTotpEnrollmentConfirmResponse>> {
      const checked = parsed(mfaTotpEnrollmentConfirmRequestSchema, input, "The TOTP confirmation request is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/instances/${encodeURIComponent(instanceId)}/mfa/totp/confirm`,
        json(checked.data),
        mfaTotpEnrollmentConfirmResponseSchema,
      )
    },
    mfaTotpEnrollmentRemove(instanceId: string): Promise<Result<MfaTotpEnrollmentRemoveResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/mfa/totp`,
        { method: "DELETE" },
        mfaTotpEnrollmentRemoveResponseSchema,
      )
    },
    mfaTotpVerify(instanceId: string, code: string): Promise<Result<MfaTotpVerifyResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/mfa/totp/verify`,
        json({ code }),
        mfaTotpVerifyResponseSchema,
      )
    },
    mfaRecoveryCodesGenerate(instanceId: string): Promise<Result<MfaRecoveryCodesResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/mfa/recovery-codes`,
        json({}),
        mfaRecoveryCodesResponseSchema,
      )
    },
    mfaRecoveryCodeVerify(instanceId: string, code: string): Promise<Result<MfaRecoveryCodeVerifyResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/mfa/recovery-codes/verify`,
        json({ code }),
        mfaRecoveryCodeVerifyResponseSchema,
      )
    },
    mfaStepUpStart(instanceId: string): Promise<Result<MfaChallengeResponse>> {
      return request(
        `/instances/${encodeURIComponent(instanceId)}/mfa/step-up/start`,
        json({}),
        mfaChallengeResponseSchema,
      )
    },
    mfaStepUpComplete(instanceId: string, input: MfaChallengeCompleteRequest): Promise<Result<MfaLoginResponse>> {
      const checked = parsed(mfaChallengeCompleteRequestSchema, input, "The MFA code is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/instances/${encodeURIComponent(instanceId)}/mfa/step-up/complete`,
        json(checked.data),
        mfaLoginResponseSchema,
      )
    },
    mfaChallengeComplete(instanceId: string, input: MfaChallengeCompleteRequest): Promise<Result<MfaLoginResponse>> {
      const checked = parsed(mfaChallengeCompleteRequestSchema, input, "The MFA code is invalid.")
      if (!checked.success) return Promise.resolve(checked)
      return request(
        `/instances/${encodeURIComponent(instanceId)}/mfa/challenge/complete`,
        json(checked.data),
        mfaLoginResponseSchema,
      )
    },
  }
}
