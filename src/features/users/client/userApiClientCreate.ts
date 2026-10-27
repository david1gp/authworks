import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { HttpGetOptions } from "../../../platform/http/HttpGetOptions.js"
import type { HttpGetResult } from "../../../platform/http/HttpGetResult.js"
import { httpApiClientGetRequest } from "../../../platform/http/httpApiClientGetRequest.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { sessionBrowserRequest } from "../../sessions/client/sessionBrowserRequest.js"
import {
  type UserAuthenticationMethods,
  userAuthenticationMethodsSchema,
} from "../public/userAuthenticationMethodsSchema.js"
import { type UserCreateRequest, userCreateRequestSchema } from "../public/userCreateRequestSchema.js"
import { type UserCurrentResponse, userCurrentResponseSchema } from "../public/userCurrentResponseSchema.js"
import type { UserEmailAddressAddResendRequest } from "../public/userEmailAddressAddResendRequestSchema.js"
import { userEmailAddressAddResendRequestSchema } from "../public/userEmailAddressAddResendRequestSchema.js"
import type { UserEmailAddressAddResendResponse } from "../public/userEmailAddressAddResendResponseSchema.js"
import { userEmailAddressAddResendResponseSchema } from "../public/userEmailAddressAddResendResponseSchema.js"
import type { UserEmailAddressAddStartRequest } from "../public/userEmailAddressAddStartRequestSchema.js"
import { userEmailAddressAddStartRequestSchema } from "../public/userEmailAddressAddStartRequestSchema.js"
import type { UserEmailAddressAddStartResponse } from "../public/userEmailAddressAddStartResponseSchema.js"
import { userEmailAddressAddStartResponseSchema } from "../public/userEmailAddressAddStartResponseSchema.js"
import type { UserEmailAddressAddVerifyRequest } from "../public/userEmailAddressAddVerifyRequestSchema.js"
import { userEmailAddressAddVerifyRequestSchema } from "../public/userEmailAddressAddVerifyRequestSchema.js"
import {
  type UserEmailVerificationResendResponse,
  userEmailVerificationResendResponseSchema,
} from "../public/userEmailVerificationResendResponseSchema.js"
import type { UserEmailAddressAddVerifyResponse } from "../public/userEmailAddressAddVerifyResponseSchema.js"
import { userEmailAddressAddVerifyResponseSchema } from "../public/userEmailAddressAddVerifyResponseSchema.js"
import type { UserEmailAddressListResponse } from "../public/userEmailAddressListResponseSchema.js"
import { userEmailAddressListResponseSchema } from "../public/userEmailAddressListResponseSchema.js"
import type { UserEmailAddressPrimarySetRequest } from "../public/userEmailAddressPrimarySetRequestSchema.js"
import { userEmailAddressPrimarySetRequestSchema } from "../public/userEmailAddressPrimarySetRequestSchema.js"
import type { UserEmailAddressPrimarySetResponse } from "../public/userEmailAddressPrimarySetResponseSchema.js"
import { userEmailAddressPrimarySetResponseSchema } from "../public/userEmailAddressPrimarySetResponseSchema.js"
import type { UserEmailAddressRemoveResponse } from "../public/userEmailAddressRemoveResponseSchema.js"
import { userEmailAddressRemoveResponseSchema } from "../public/userEmailAddressRemoveResponseSchema.js"
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
import { type UserExportResponse, userExportResponseSchema } from "../public/userExportResponseSchema.js"
import { type UserLifecycleRequest, userLifecycleRequestSchema } from "../public/userLifecycleRequestSchema.js"
import type { UserListQuery } from "../public/userListQuerySchema.js"
import { type UserListResponse, userListResponseSchema } from "../public/userListResponseSchema.js"
import type { UserMetadataListQuery } from "../public/userMetadataListQuerySchema.js"
import {
  type UserMetadataListResponse,
  userMetadataListResponseSchema,
} from "../public/userMetadataListResponseSchema.js"
import {
  type UserMetadataRemoveResponse,
  userMetadataRemoveResponseSchema,
} from "../public/userMetadataRemoveResponseSchema.js"
import { type UserMetadataResponse, userMetadataResponseSchema } from "../public/userMetadataResponseSchema.js"
import { type UserMetadataSetRequest, userMetadataSetRequestSchema } from "../public/userMetadataSetRequestSchema.js"
import {
  type UserPhoneNumberSaveRequest,
  userPhoneNumberSaveRequestSchema,
} from "../public/userPhoneNumberSaveRequestSchema.js"
import {
  type UserProfileUpdateRequest,
  userProfileUpdateRequestSchema,
} from "../public/userProfileUpdateRequestSchema.js"
import { type UserPurgeResponse, userPurgeResponseSchema } from "../public/userPurgeResponseSchema.js"
import { type UserResponse, userResponseSchema } from "../public/userResponseSchema.js"
import { type UserVerificationRequest, userVerificationRequestSchema } from "../public/userVerificationRequestSchema.js"
import { userListQueryToSearchParams } from "./userListQueryToSearchParams.js"
import { userMetadataListQueryToSearchParams } from "./userMetadataListQueryToSearchParams.js"

type UserApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type UserApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: UserApiFetch
  readonly systemToken?: Secret | string
  readonly token?: Secret | string
}

export function userApiClientCreate(options: UserApiClientCreateOptions) {
  const systemRequestToken = "systemToken" in options ? options.systemToken : options.token
  const tokenFallback = Symbol("tokenFallback")
  const tokenNoFallback = Symbol("tokenNoFallback")
  const request = <T>(
    path: string,
    init: RequestInit,
    schema: v.GenericSchema<T>,
    token: Secret | string | undefined | typeof tokenFallback | typeof tokenNoFallback = tokenFallback,
  ): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "userApiClientRequest",
      path,
      schema,
      token: token === tokenFallback ? options.token : token === tokenNoFallback ? undefined : token,
    })
  const getRequest = <T>(
    path: string,
    schema: v.GenericSchema<T>,
    getOptions?: HttpGetOptions,
    token: Secret | string | undefined | typeof tokenFallback | typeof tokenNoFallback = tokenFallback,
    init: RequestInit = { method: "GET" },
  ): Promise<HttpGetResult<T>> =>
    httpApiClientGetRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      ifModifiedSince: getOptions?.ifModifiedSince,
      init,
      op: "userApiClientRequest",
      path,
      schema,
      token: token === tokenFallback ? options.token : token === tokenNoFallback ? undefined : token,
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
        systemRequestToken ?? tokenNoFallback,
      )
    },
    userGet(realmId: string, userId: string, getOptions?: HttpGetOptions): Promise<HttpGetResult<UserResponse>> {
      return getRequest(
        `/system/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}`,
        userResponseSchema,
        getOptions,
        systemRequestToken ?? tokenNoFallback,
      )
    },
    userList(realmId: string, query?: ListQuery | UserListQuery): Promise<Result<UserListResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/users${userListQueryToSearchParams(query)}`,
        { method: "GET" },
        userListResponseSchema,
        systemRequestToken ?? tokenNoFallback,
      )
    },
    userMeGet(realmId: string, getOptions?: HttpGetOptions): Promise<HttpGetResult<UserCurrentResponse>> {
      return getRequest(
        `/realms/${encodeURIComponent(realmId)}/me`,
        userCurrentResponseSchema,
        getOptions,
        tokenFallback,
        { cache: "no-store", method: "GET" },
      )
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
    userMeExportGet(realmId: string, getOptions?: HttpGetOptions): Promise<HttpGetResult<UserExportResponse>> {
      return getRequest(`/realms/${encodeURIComponent(realmId)}/me/export`, userExportResponseSchema, getOptions)
    },
    userMeEmailAddressList(
      realmId: string,
      getOptions?: HttpGetOptions,
    ): Promise<HttpGetResult<UserEmailAddressListResponse>> {
      return getRequest(
        `/realms/${encodeURIComponent(realmId)}/me/emails`,
        userEmailAddressListResponseSchema,
        getOptions,
      )
    },
    userMeEmailAddressAddStart(
      realmId: string,
      input: UserEmailAddressAddStartRequest,
    ): Promise<Result<UserEmailAddressAddStartResponse>> {
      return meMutate(
        realmId,
        "userMeEmailAddressAddStart",
        `/realms/${encodeURIComponent(realmId)}/me/emails/add/start`,
        input,
        userEmailAddressAddStartRequestSchema,
        userEmailAddressAddStartResponseSchema,
      )
    },
    userMeEmailAddressAddResend(
      realmId: string,
      input: UserEmailAddressAddResendRequest,
    ): Promise<Result<UserEmailAddressAddResendResponse>> {
      return meMutate(
        realmId,
        "userMeEmailAddressAddResend",
        `/realms/${encodeURIComponent(realmId)}/me/emails/add/resend`,
        input,
        userEmailAddressAddResendRequestSchema,
        userEmailAddressAddResendResponseSchema,
      )
    },
    userMeEmailAddressAddVerify(
      realmId: string,
      input: UserEmailAddressAddVerifyRequest,
    ): Promise<Result<UserEmailAddressAddVerifyResponse>> {
      return meMutate(
        realmId,
        "userMeEmailAddressAddVerify",
        `/realms/${encodeURIComponent(realmId)}/me/emails/add/verify`,
        input,
        userEmailAddressAddVerifyRequestSchema,
        userEmailAddressAddVerifyResponseSchema,
      )
    },
    userMeEmailAddressPrimarySet(
      realmId: string,
      emailId: string,
      input: UserEmailAddressPrimarySetRequest = {},
    ): Promise<Result<UserEmailAddressPrimarySetResponse>> {
      return meMutate(
        realmId,
        "userMeEmailAddressPrimarySet",
        `/realms/${encodeURIComponent(realmId)}/me/emails/${encodeURIComponent(emailId)}/primary`,
        input,
        userEmailAddressPrimarySetRequestSchema,
        userEmailAddressPrimarySetResponseSchema,
      )
    },
    userMeEmailAddressRemove(realmId: string, emailId: string): Promise<Result<UserEmailAddressRemoveResponse>> {
      const path = `/realms/${encodeURIComponent(realmId)}/me/emails/${encodeURIComponent(emailId)}`
      if (options.token !== undefined) return request(path, { method: "DELETE" }, userEmailAddressRemoveResponseSchema)
      return sessionBrowserRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: { method: "DELETE" },
        op: "userMeEmailAddressRemove",
        path,
        realmId,
        schema: userEmailAddressRemoveResponseSchema,
      })
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
    userMePhoneNumberSet(realmId: string, input: UserPhoneNumberSaveRequest): Promise<Result<UserResponse>> {
      const parsed = v.safeParse(userPhoneNumberSaveRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "userApiClientPhoneNumberSet",
            "The account phone-number request is invalid.",
            "users.invalid",
          ),
        )
      const path = `/realms/${encodeURIComponent(realmId)}/me/phone-number`
      const init = { body: JSON.stringify(parsed.output), method: "POST" }
      if (options.token !== undefined) return request(path, init, userResponseSchema)
      return sessionBrowserRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init,
        op: "userMePhoneNumberSet",
        path,
        realmId,
        schema: userResponseSchema,
      })
    },
    userMeProfilePictureUpload(realmId: string, file: Blob): Promise<Result<UserResponse>> {
      const path = `/realms/${encodeURIComponent(realmId)}/me/profile-picture`
      const init = {
        body: file,
        headers: { "content-type": file.type },
        method: "PUT",
      }
      if (options.token !== undefined) return request(path, init, userResponseSchema)
      return sessionBrowserRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init,
        op: "userMeProfilePictureUpload",
        path,
        realmId,
        schema: userResponseSchema,
      })
    },
    userMeProfilePictureRemove(realmId: string): Promise<Result<UserResponse>> {
      const path = `/realms/${encodeURIComponent(realmId)}/me/profile-picture`
      if (options.token !== undefined) return request(path, { method: "DELETE" }, userResponseSchema)
      return sessionBrowserRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: { method: "DELETE" },
        op: "userMeProfilePictureRemove",
        path,
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
        systemRequestToken ?? tokenNoFallback,
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
        systemRequestToken ?? tokenNoFallback,
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
        systemRequestToken ?? tokenNoFallback,
      )
    },
    userDelete(realmId: string, userId: string): Promise<Result<UserResponse>> {
      return request(
        `/system/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
        userResponseSchema,
        systemRequestToken ?? tokenNoFallback,
      )
    },
    userTenantList(realmId: string, query?: ListQuery | UserListQuery): Promise<Result<UserListResponse>> {
      return tenantRead(tenantPath(realmId, userListQueryToSearchParams(query)), userListResponseSchema)
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
    userTenantPurge(realmId: string, userId: string): Promise<Result<UserPurgeResponse>> {
      return tenantMutate(
        realmId,
        "userTenantPurge",
        tenantUserPath(realmId, userId, "/purge"),
        { method: "POST" },
        userPurgeResponseSchema,
      )
    },
    userTenantEmailAddressList(realmId: string, userId: string): Promise<Result<UserEmailAddressListResponse>> {
      return tenantRead(tenantUserPath(realmId, userId, "/emails"), userEmailAddressListResponseSchema)
    },
    userTenantEmailVerificationResend(
      realmId: string,
      userId: string,
      emailId: string,
    ): Promise<Result<UserEmailVerificationResendResponse>> {
      return tenantMutate(
        realmId,
        "userTenantEmailVerificationResend",
        tenantUserPath(realmId, userId, `/emails/${encodeURIComponent(emailId)}/verification-resend`),
        { method: "POST" },
        userEmailVerificationResendResponseSchema,
      )
    },
    userTenantMetadataList(
      realmId: string,
      userId: string,
      query?: ListQuery | UserMetadataListQuery,
    ): Promise<Result<UserMetadataListResponse>> {
      return tenantRead(
        tenantUserPath(realmId, userId, `/metadata${userMetadataListQueryToSearchParams(query)}`),
        userMetadataListResponseSchema,
      )
    },
    userTenantMetadataGet(realmId: string, userId: string, key: string): Promise<Result<UserMetadataResponse>> {
      return tenantRead(
        tenantUserPath(realmId, userId, `/metadata/${encodeURIComponent(key)}`),
        userMetadataResponseSchema,
      )
    },
    userTenantMetadataSet(
      realmId: string,
      userId: string,
      key: string,
      input: UserMetadataSetRequest,
    ): Promise<Result<UserMetadataResponse>> {
      const parsed = v.safeParse(userMetadataSetRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("userApiClientTenantMetadataSet", "The user metadata is invalid.", "users.invalid"),
        )
      return tenantMutate(
        realmId,
        "userTenantMetadataSet",
        tenantUserPath(realmId, userId, `/metadata/${encodeURIComponent(key)}`),
        { body: JSON.stringify(parsed.output), method: "PUT" },
        userMetadataResponseSchema,
      )
    },
    userTenantMetadataRemove(
      realmId: string,
      userId: string,
      key: string,
    ): Promise<Result<UserMetadataRemoveResponse>> {
      return tenantMutate(
        realmId,
        "userTenantMetadataRemove",
        tenantUserPath(realmId, userId, `/metadata/${encodeURIComponent(key)}`),
        { method: "DELETE" },
        userMetadataRemoveResponseSchema,
      )
    },
    userMeMetadataList(
      realmId: string,
      query?: ListQuery | UserMetadataListQuery,
    ): Promise<Result<UserMetadataListResponse>> {
      if (options.token !== undefined)
        return request(
          `/realms/${encodeURIComponent(realmId)}/me/metadata${userMetadataListQueryToSearchParams(query)}`,
          { method: "GET" },
          userMetadataListResponseSchema,
        )
      return sessionBrowserRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: { method: "GET" },
        op: "userMeMetadataList",
        path: `/realms/${encodeURIComponent(realmId)}/me/metadata${userMetadataListQueryToSearchParams(query)}`,
        realmId,
        schema: userMetadataListResponseSchema,
      })
    },
    userMeMetadataGet(realmId: string, key: string): Promise<Result<UserMetadataResponse>> {
      if (options.token !== undefined)
        return request(
          `/realms/${encodeURIComponent(realmId)}/me/metadata/${encodeURIComponent(key)}`,
          { method: "GET" },
          userMetadataResponseSchema,
        )
      return sessionBrowserRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: { method: "GET" },
        op: "userMeMetadataGet",
        path: `/realms/${encodeURIComponent(realmId)}/me/metadata/${encodeURIComponent(key)}`,
        realmId,
        schema: userMetadataResponseSchema,
      })
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
