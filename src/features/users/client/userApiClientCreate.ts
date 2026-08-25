import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { HttpGetOptions } from "../../../platform/http/HttpGetOptions.js"
import type { HttpGetResult } from "../../../platform/http/HttpGetResult.js"
import { httpApiClientGetRequest } from "../../../platform/http/httpApiClientGetRequest.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listQueryToSearchParams } from "../../../platform/http/listQueryToSearchParams.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { sessionBrowserRequest } from "../../sessions/client/sessionBrowserRequest.js"
import {
  type UserAuthenticationMethods,
  userAuthenticationMethodsSchema,
} from "../public/userAuthenticationMethodsSchema.js"
import { type UserCreateRequest, userCreateRequestSchema } from "../public/userCreateRequestSchema.js"
import type { UserEmailChangeResendRequest } from "../public/userEmailChangeResendRequestSchema.js"
import { userEmailChangeResendRequestSchema } from "../public/userEmailChangeResendRequestSchema.js"
import type { UserEmailChangeResendResponse } from "../public/userEmailChangeResendResponseSchema.js"
import { userEmailChangeResendResponseSchema } from "../public/userEmailChangeResendResponseSchema.js"
import type { UserEmailChangeStartRequest } from "../public/userEmailChangeStartRequestSchema.js"
import { userEmailChangeStartRequestSchema } from "../public/userEmailChangeStartRequestSchema.js"
import type { UserEmailChangeStartResponse } from "../public/userEmailChangeStartResponseSchema.js"
import { userEmailChangeStartResponseSchema } from "../public/userEmailChangeStartResponseSchema.js"
import type { UserEmailChangeVerifyRequest } from "../public/userEmailChangeVerifyRequestSchema.js"
import { userEmailChangeVerifyRequestSchema } from "../public/userEmailChangeVerifyRequestSchema.js"
import type { UserEmailChangeVerifyResponse } from "../public/userEmailChangeVerifyResponseSchema.js"
import { userEmailChangeVerifyResponseSchema } from "../public/userEmailChangeVerifyResponseSchema.js"
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
  const getRequest = <T>(
    path: string,
    schema: v.GenericSchema<T>,
    getOptions?: HttpGetOptions,
  ): Promise<HttpGetResult<T>> =>
    httpApiClientGetRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      ifModifiedSince: getOptions?.ifModifiedSince,
      init: { method: "GET" },
      op: "userApiClientRequest",
      path,
      schema,
      token: options.token,
    })

  const jsonRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "POST" })
  const patchRequest = (input: unknown): RequestInit => ({ body: JSON.stringify(input), method: "PATCH" })
  const tenantPath = (realmId: string, suffix = "") => `/realms/${encodeURIComponent(realmId)}/users${suffix}`
  const tenantUserPath = (realmId: string, userId: string, suffix = "") =>
    tenantPath(realmId, `/${encodeURIComponent(userId)}${suffix}`)
  const tenantRead = <T>(path: string, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    request(path, { credentials: "include", method: "GET" }, schema)
  const tenantMutate = <T>(
    realmId: string,
    op: string,
    path: string,
    init: RequestInit,
    schema: v.GenericSchema<T>,
  ): Promise<Result<T>> =>
    sessionBrowserRequest({ baseUrl: options.baseUrl, fetch: options.fetch, init, op, path, realmId, schema })
  const meMutate = <T>(
    realmId: string,
    op: string,
    path: string,
    input: unknown,
    requestSchema: v.GenericSchema<unknown>,
    responseSchema: v.GenericSchema<T>,
  ): Promise<Result<T>> => {
    const parsed = v.safeParse(requestSchema, input)
    if (!parsed.success)
      return Promise.resolve(resultErrorCreate(op, "The account email-change request is invalid.", "users.invalid"))
    const init = { body: JSON.stringify(parsed.output), method: "POST" }
    if (options.token !== undefined) return request(path, init, responseSchema)
    return sessionBrowserRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op,
      path,
      realmId,
      schema: responseSchema,
    })
  }

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
    userGet(realmId: string, userId: string, getOptions?: HttpGetOptions): Promise<HttpGetResult<UserResponse>> {
      return getRequest(
        `/system/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}`,
        userResponseSchema,
        getOptions,
      )
    },
    userList(realmId: string, query?: ListQuery): Promise<Result<UserListResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/users${listQueryToSearchParams(query)}`,
        { method: "GET" },
        userListResponseSchema,
      )
    },
    userMeGet(realmId: string, getOptions?: HttpGetOptions): Promise<HttpGetResult<UserResponse>> {
      return getRequest(`/realms/${encodeURIComponent(realmId)}/me`, userResponseSchema, getOptions)
    },
    userMeAuthenticationMethodsGet(
      realmId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<UserAuthenticationMethods>> {
      return getRequest(
        `/realms/${encodeURIComponent(realmId)}/me/authentication-methods`,
        userAuthenticationMethodsSchema,
        getOptions,
      )
    },
    userMeEmailChangeResend(
      realmId: string,
      input: UserEmailChangeResendRequest,
    ): Promise<Result<UserEmailChangeResendResponse>> {
      return meMutate(
        realmId,
        "userMeEmailChangeResend",
        `/realms/${encodeURIComponent(realmId)}/me/email-change/resend`,
        input,
        userEmailChangeResendRequestSchema,
        userEmailChangeResendResponseSchema,
      )
    },
    userMeEmailChangeStart(
      realmId: string,
      input: UserEmailChangeStartRequest,
    ): Promise<Result<UserEmailChangeStartResponse>> {
      return meMutate(
        realmId,
        "userMeEmailChangeStart",
        `/realms/${encodeURIComponent(realmId)}/me/email-change/start`,
        input,
        userEmailChangeStartRequestSchema,
        userEmailChangeStartResponseSchema,
      )
    },
    userMeEmailChangeVerify(
      realmId: string,
      input: UserEmailChangeVerifyRequest,
    ): Promise<Result<UserEmailChangeVerifyResponse>> {
      return meMutate(
        realmId,
        "userMeEmailChangeVerify",
        `/realms/${encodeURIComponent(realmId)}/me/email-change/verify`,
        input,
        userEmailChangeVerifyRequestSchema,
        userEmailChangeVerifyResponseSchema,
      )
    },
    userTenantAuthenticationMethodsGet(realmId: string, userId: string): Promise<Result<UserAuthenticationMethods>> {
      return tenantRead(`${tenantUserPath(realmId, userId)}/authentication-methods`, userAuthenticationMethodsSchema)
    },
    userMeProfileUpdate(realmId: string, input: UserProfileUpdateRequest): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userProfileUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("userApiClientProfileUpdate", "The user profile update is invalid.", "users.invalid"),
        )
      if (options.token !== undefined)
        return request(`/realms/${encodeURIComponent(realmId)}/me`, patchRequest(parsed.output), userResponseSchema)
      return sessionBrowserRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: patchRequest(parsed.output),
        op: "userMeProfileUpdate",
        path: `/realms/${encodeURIComponent(realmId)}/me`,
        realmId,
        schema: userResponseSchema,
      })
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
    userTenantList(realmId: string, query?: ListQuery): Promise<Result<UserListResponse>> {
      return tenantRead(tenantPath(realmId, listQueryToSearchParams(query)), userListResponseSchema)
    },
    userTenantGet(realmId: string, userId: string): Promise<Result<UserResponse>> {
      return tenantRead(tenantUserPath(realmId, userId), userResponseSchema)
    },
    userTenantCreate(realmId: string, input: UserCreateRequest): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("userApiClientTenantCreate", "The user request is invalid.", "users.invalid"),
        )
      return tenantMutate(
        realmId,
        "userTenantCreate",
        tenantPath(realmId),
        jsonRequest(parsed.output),
        userResponseSchema,
      )
    },
    userTenantProfileUpdate(
      realmId: string,
      userId: string,
      input: UserProfileUpdateRequest,
    ): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userProfileUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("userApiClientTenantProfileUpdate", "The user profile update is invalid.", "users.invalid"),
        )
      return tenantMutate(
        realmId,
        "userTenantProfileUpdate",
        tenantUserPath(realmId, userId, "/profile"),
        patchRequest(parsed.output),
        userResponseSchema,
      )
    },
    userTenantLifecycleSet(
      realmId: string,
      userId: string,
      input: UserLifecycleRequest,
    ): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "userApiClientTenantLifecycleSet",
            "The user lifecycle request is invalid.",
            "users.invalid",
          ),
        )
      return tenantMutate(
        realmId,
        "userTenantLifecycleSet",
        tenantUserPath(realmId, userId, "/lifecycle"),
        jsonRequest(parsed.output),
        userResponseSchema,
      )
    },
    userTenantVerificationSet(
      realmId: string,
      userId: string,
      input: UserVerificationRequest,
    ): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userVerificationRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "userApiClientTenantVerificationSet",
            "The user verification request is invalid.",
            "users.invalid",
          ),
        )
      return tenantMutate(
        realmId,
        "userTenantVerificationSet",
        tenantUserPath(realmId, userId, "/verification"),
        jsonRequest(parsed.output),
        userResponseSchema,
      )
    },
    userTenantDelete(realmId: string, userId: string): Promise<Result<UserResponse>> {
      return tenantMutate(
        realmId,
        "userTenantDelete",
        tenantUserPath(realmId, userId),
        { method: "DELETE" },
        userResponseSchema,
      )
    },
    userMeDelete(realmId: string): Promise<Result<UserResponse>> {
      if (options.token !== undefined)
        return request(`/realms/${encodeURIComponent(realmId)}/me`, { method: "DELETE" }, userResponseSchema)
      return sessionBrowserRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: { method: "DELETE" },
        op: "userMeDelete",
        path: `/realms/${encodeURIComponent(realmId)}/me`,
        realmId,
        schema: userResponseSchema,
      })
    },
  }
}
