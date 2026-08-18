import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listQueryToSearchParams } from "../../../platform/http/listQueryToSearchParams.js"
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
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "userApiClientRequest",
      path,
      schema,
      token: options.token,
    })

  const jsonRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })
  const patchRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "PATCH" })

  return {
    userCreate(realmId: string, input: UserCreateRequest): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("userApiClientCreate", "The user request is invalid.", "users.invalid"),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/users`,
        jsonRequest(parsed.output),
        userResponseSchema,
      )
    },
    userGet(realmId: string, userId: string): Promise<Result<UserResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}`,
        { method: "GET" },
        userResponseSchema,
      )
    },
    userList(realmId: string, query?: ListQuery): Promise<Result<UserListResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/users${listQueryToSearchParams(query)}`,
        { method: "GET" },
        userListResponseSchema,
      )
    },
    userProfileUpdate(realmId: string, userId: string, input: UserProfileUpdateRequest): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userProfileUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("userApiClientProfileUpdate", "The user profile update is invalid.", "users.invalid"),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/profile`,
        patchRequest(parsed.output),
        userResponseSchema,
      )
    },
    userLifecycleSet(realmId: string, userId: string, input: UserLifecycleRequest): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("userApiClientLifecycleSet", "The user lifecycle request is invalid.", "users.invalid"),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/lifecycle`,
        jsonRequest(parsed.output),
        userResponseSchema,
      )
    },
    userEmailVerificationSet(
      realmId: string,
      userId: string,
      input: UserVerificationRequest,
    ): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userVerificationRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "userApiClientVerificationSet",
            "The user verification request is invalid.",
            "users.invalid",
          ),
        )
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/verification`,
        jsonRequest(parsed.output),
        userResponseSchema,
      )
    },
    userDelete(realmId: string, userId: string): Promise<Result<UserResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
        userResponseSchema,
      )
    },
  }
}
