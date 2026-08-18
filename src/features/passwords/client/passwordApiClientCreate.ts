import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { type PasswordChangeRequest, passwordChangeRequestSchema } from "../public/passwordChangeRequestSchema.js"
import { passwordChangeResponseSchema, type PasswordChangeResponse } from "../public/passwordChangeResponseSchema.js"
import {
  type PasswordEmailVerificationRequest,
  passwordEmailVerificationRequestSchema,
} from "../public/passwordEmailVerificationRequestSchema.js"
import {
  passwordEmailVerificationResponseSchema,
  type PasswordEmailVerificationResponse,
} from "../public/passwordEmailVerificationResponseSchema.js"
import { type PasswordLoginRequest, passwordLoginRequestSchema } from "../public/passwordLoginRequestSchema.js"
import { passwordLoginResponseSchema, type PasswordLoginResponse } from "../public/passwordLoginResponseSchema.js"
import { passwordPolicyResponseSchema, type PasswordPolicyResponse } from "../public/passwordPolicyResponseSchema.js"
import {
  type PasswordPolicySetRequest,
  passwordPolicySetRequestSchema,
} from "../public/passwordPolicySetRequestSchema.js"
import {
  passwordRecoveryCompleteResponseSchema,
  type PasswordRecoveryCompleteResponse,
} from "../public/passwordRecoveryCompleteResponseSchema.js"
import {
  type PasswordRecoveryCompleteRequest,
  passwordRecoveryCompleteRequestSchema,
} from "../public/passwordRecoveryCompleteRequestSchema.js"
import { type PasswordRecoveryRequest, passwordRecoveryRequestSchema } from "../public/passwordRecoveryRequestSchema.js"
import {
  passwordRecoveryResponseSchema,
  type PasswordRecoveryResponse,
} from "../public/passwordRecoveryResponseSchema.js"
import {
  type PasswordRegistrationRequest,
  passwordRegistrationRequestSchema,
} from "../public/passwordRegistrationRequestSchema.js"
import {
  passwordRegistrationResponseSchema,
  type PasswordRegistrationResponse,
} from "../public/passwordRegistrationResponseSchema.js"

type PasswordApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type PasswordApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: PasswordApiFetch
  readonly token?: Secret | string
}

export function passwordApiClientCreate(options: PasswordApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "passwordApiClientRequest",
      path,
      schema,
      token: options.token,
    })

  const jsonRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })
  const patchRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "PATCH" })
  const parsedRequest = <T>(schema: v.GenericSchema<T>, input: unknown, errorMessage: string) => {
    const parsed = v.safeParse(schema, input)
    if (!parsed.success) return resultErrorCreate("passwordApiClientCreate", errorMessage, "passwords.invalid")
    return resultCreate(parsed.output)
  }

  return {
    passwordRegister(
      realmId: string,
      input: PasswordRegistrationRequest,
    ): Promise<Result<PasswordRegistrationResponse>> {
      const parsed = parsedRequest(passwordRegistrationRequestSchema, input, "The registration request is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/password/register`,
        jsonRequest(parsed.data),
        passwordRegistrationResponseSchema,
      )
    },
    passwordLogin(realmId: string, input: PasswordLoginRequest): Promise<Result<PasswordLoginResponse>> {
      const parsed = parsedRequest(passwordLoginRequestSchema, input, "The credentials are invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/password/login`,
        jsonRequest(parsed.data),
        passwordLoginResponseSchema,
      )
    },
    passwordEmailVerify(
      realmId: string,
      input: PasswordEmailVerificationRequest,
    ): Promise<Result<PasswordEmailVerificationResponse>> {
      const parsed = parsedRequest(passwordEmailVerificationRequestSchema, input, "The verification token is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/password/verify-email`,
        jsonRequest(parsed.data),
        passwordEmailVerificationResponseSchema,
      )
    },
    passwordRecoveryRequest(
      realmId: string,
      input: PasswordRecoveryRequest,
    ): Promise<Result<PasswordRecoveryResponse>> {
      const parsed = parsedRequest(passwordRecoveryRequestSchema, input, "The recovery request is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/password/recovery/request`,
        jsonRequest(parsed.data),
        passwordRecoveryResponseSchema,
      )
    },
    passwordRecoveryComplete(
      realmId: string,
      input: PasswordRecoveryCompleteRequest,
    ): Promise<Result<PasswordRecoveryCompleteResponse>> {
      const parsed = parsedRequest(passwordRecoveryCompleteRequestSchema, input, "The recovery token is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/password/recovery/complete`,
        jsonRequest(parsed.data),
        passwordRecoveryCompleteResponseSchema,
      )
    },
    passwordChange(
      realmId: string,
      userId: string,
      input: PasswordChangeRequest,
    ): Promise<Result<PasswordChangeResponse>> {
      const parsed = parsedRequest(passwordChangeRequestSchema, input, "The password change request is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/password`,
        jsonRequest(parsed.data),
        passwordChangeResponseSchema,
      )
    },
    passwordPolicyGet(realmId: string): Promise<Result<PasswordPolicyResponse>> {
      return request(
        `/realms/${encodeURIComponent(realmId)}/password-policy`,
        { method: "GET" },
        passwordPolicyResponseSchema,
      )
    },
    passwordPolicySet(realmId: string, input: PasswordPolicySetRequest): Promise<Result<PasswordPolicyResponse>> {
      const parsed = parsedRequest(passwordPolicySetRequestSchema, input, "The password policy is invalid.")
      if (!parsed.success) return Promise.resolve(parsed)
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/password-policy`,
        patchRequest(parsed.data),
        passwordPolicyResponseSchema,
      )
    },
  }
}
