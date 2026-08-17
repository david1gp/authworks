import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpErrorResponseSchema } from "../../../platform/http/httpErrorResponseSchema.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { type UserCreateRequest, userCreateRequestSchema } from "../public/userCreateRequestSchema.js"
import { type UserLifecycleRequest, userLifecycleRequestSchema } from "../public/userLifecycleRequestSchema.js"
import { type UserListResponse, userListResponseSchema } from "../public/userListResponseSchema.js"
import {
  type UserProfileUpdateRequest,
  userProfileUpdateRequestSchema,
} from "../public/userProfileUpdateRequestSchema.js"
import { type UserResponse, userResponseSchema } from "../public/userResponseSchema.js"
import { type UserVerificationRequest, userVerificationRequestSchema } from "../public/userVerificationRequestSchema.js"

type UserApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type UserApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: UserApiFetch
  readonly token?: Secret | string
}

export function userApiClientCreate(options: UserApiClientCreateOptions) {
  const request = async <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> => {
    const op = "userApiClientRequest"
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

  const jsonRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })
  const patchRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "PATCH" })

  return {
    userCreate(instanceId: string, input: UserCreateRequest): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("userApiClientCreate", "The user request is invalid."))
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/users`,
        jsonRequest(parsed.output),
        userResponseSchema,
      )
    },
    userGet(instanceId: string, userId: string): Promise<Result<UserResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/users/${encodeURIComponent(userId)}`,
        { method: "GET" },
        userResponseSchema,
      )
    },
    userList(instanceId: string): Promise<Result<UserListResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/users`,
        { method: "GET" },
        userListResponseSchema,
      )
    },
    userProfileUpdate(
      instanceId: string,
      userId: string,
      input: UserProfileUpdateRequest,
    ): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userProfileUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("userApiClientProfileUpdate", "The user profile update is invalid."))
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/users/${encodeURIComponent(userId)}/profile`,
        patchRequest(parsed.output),
        userResponseSchema,
      )
    },
    userLifecycleSet(instanceId: string, userId: string, input: UserLifecycleRequest): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("userApiClientLifecycleSet", "The user lifecycle request is invalid."))
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/users/${encodeURIComponent(userId)}/lifecycle`,
        jsonRequest(parsed.output),
        userResponseSchema,
      )
    },
    userEmailVerificationSet(
      instanceId: string,
      userId: string,
      input: UserVerificationRequest,
    ): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userVerificationRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("userApiClientVerificationSet", "The user verification request is invalid."),
        )
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/users/${encodeURIComponent(userId)}/verification`,
        jsonRequest(parsed.output),
        userResponseSchema,
      )
    },
    userDelete(instanceId: string, userId: string): Promise<Result<UserResponse>> {
      return request(
        `/system/instances/${encodeURIComponent(instanceId)}/users/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
        userResponseSchema,
      )
    },
  }
}
