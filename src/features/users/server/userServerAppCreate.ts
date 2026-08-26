import type { Next } from "hono"
import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import type { Result } from "#result"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import {
  realmAdministratorContextAuthorize,
  realmBootstrapAdminAuthenticate,
  realmSystemContextCreate,
  realmTenantContextResolve,
} from "../../realms/server/index.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import { userAuthenticationMethodsAdministratorGet } from "../actions/userAuthenticationMethodsAdministratorGet.js"
import { userAuthenticationMethodsGet } from "../actions/userAuthenticationMethodsGet.js"
import { userCreate } from "../actions/userCreate.js"
import { userDelete } from "../actions/userDelete.js"
import { userEmailAddressAddResend } from "../actions/userEmailAddressAddResend.js"
import { userEmailAddressAddStart } from "../actions/userEmailAddressAddStart.js"
import { userEmailAddressAddVerify } from "../actions/userEmailAddressAddVerify.js"
import { userEmailAddressList } from "../actions/userEmailAddressList.js"
import { userEmailAddressPrimarySet } from "../actions/userEmailAddressPrimarySet.js"
import { userEmailAddressRemove } from "../actions/userEmailAddressRemove.js"
import { userEmailChangeResend } from "../actions/userEmailChangeResend.js"
import { userEmailChangeStart } from "../actions/userEmailChangeStart.js"
import { userEmailChangeVerify } from "../actions/userEmailChangeVerify.js"
import { userEmailVerificationSet } from "../actions/userEmailVerificationSet.js"
import { userGet } from "../actions/userGet.js"
import { userLifecycleSet } from "../actions/userLifecycleSet.js"
import { userList } from "../actions/userList.js"
import { userProfileUpdate } from "../actions/userProfileUpdate.js"
import { userProfilePictureUpload } from "../actions/userProfilePictureUpload.js"
import { userProfilePictureRemove } from "../actions/userProfilePictureRemove.js"
import { userRealmReadCapabilityResolve } from "../actions/userRealmReadCapabilityResolve.js"
import { userCreateRequestSchema } from "../public/userCreateRequestSchema.js"
import { userEmailAddressAddResendRequestSchema } from "../public/userEmailAddressAddResendRequestSchema.js"
import { userEmailAddressAddStartRequestSchema } from "../public/userEmailAddressAddStartRequestSchema.js"
import { userEmailAddressAddVerifyRequestSchema } from "../public/userEmailAddressAddVerifyRequestSchema.js"
import { userEmailAddressPrimarySetRequestSchema } from "../public/userEmailAddressPrimarySetRequestSchema.js"
import type { UserEmailAddressVerificationDelivery } from "../public/userEmailAddressVerificationDeliverySchema.js"
import type { UserEmailChangeDelivery } from "../public/userEmailChangeDeliverySchema.js"
import type { UserEmailChangeNotification } from "../public/userEmailChangeNotificationSchema.js"
import { userEmailChangeResendRequestSchema } from "../public/userEmailChangeResendRequestSchema.js"
import { userEmailChangeStartRequestSchema } from "../public/userEmailChangeStartRequestSchema.js"
import { userEmailChangeVerifyRequestSchema } from "../public/userEmailChangeVerifyRequestSchema.js"
import { userLifecycleRequestSchema } from "../public/userLifecycleRequestSchema.js"
import { userProfileUpdateRequestSchema } from "../public/userProfileUpdateRequestSchema.js"
import { userVerificationRequestSchema } from "../public/userVerificationRequestSchema.js"
import type { R2ObjectStorage } from "../../../platform/storage/r2/r2ObjectStorage.js"

type UserServerAppCreateOptions = {
  readonly clientIpResolve?: (context: { readonly req: { readonly raw: Request } }) => string | undefined
  readonly database: StorageDatabase
  readonly onEmailAddressVerificationDelivery?: (delivery: UserEmailAddressVerificationDelivery) => void | Promise<void>
  readonly onEmailChangeDelivery?: (delivery: UserEmailChangeDelivery) => void | Promise<void>
  readonly onEmailChangeNotification?: (notification: UserEmailChangeNotification) => void | Promise<void>
  readonly publicOrigin?: string
  readonly profilePicturePublicOrigin?: string
  readonly profilePictureStorage?: R2ObjectStorage
  readonly rateLimitSecret?: Secret | string
  readonly systemSecret?: Secret | string
}

type UserServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    cookieAuthenticated: boolean
    session: Session
  }
}

export function userServerAppCreate(options: UserServerAppCreateOptions) {
  const app = new Hono<UserServerEnv>()
  const systemContext = realmSystemContextCreate("system")
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    publicOrigin: options.publicOrigin,
  })
  const authenticatedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    minimumAssurance: "authenticated",
    publicOrigin: options.publicOrigin,
  })
  const userReadMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    fallback: (context, next) => userBootstrapFallback(options.database, context, next),
    publicOrigin: options.publicOrigin,
  })
  const userManageMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    fallback: (context, next) => userBootstrapFallback(options.database, context, next),
    publicOrigin: options.publicOrigin,
  })

  app.get("/system/realms/:realmId/users", (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return userErrorResponseCreate(context, query)
    return userResultResponseCreate(
      context,
      userList({
        context: systemContext,
        database: options.database,
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/system/realms/:realmId/users", async (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userCreateRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The user request is invalid.",
        op: "userCreate",
      })
    return userResultResponseCreate(
      context,
      userCreate({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.get("/system/realms/:realmId/users/:userId", (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    const result = userGet({
      context: systemContext,
      database: options.database,
      realmId: context.req.param("realmId"),
      userId: context.req.param("userId"),
    })
    return userResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.user.updatedAt) : undefined,
    )
  })

  app.patch("/system/realms/:realmId/users/:userId/profile", async (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userProfileUpdateRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The user profile update is invalid.",
        op: "userProfileUpdate",
      })
    return userResultResponseCreate(
      context,
      userProfileUpdate({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.post("/system/realms/:realmId/users/:userId/lifecycle", async (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userLifecycleRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The user lifecycle request is invalid.",
        op: "userLifecycleSet",
      })
    return userResultResponseCreate(
      context,
      userLifecycleSet({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.post("/system/realms/:realmId/users/:userId/verification", async (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userVerificationRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The user verification request is invalid.",
        op: "userEmailVerificationSet",
      })
    return userResultResponseCreate(
      context,
      userEmailVerificationSet({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.delete("/system/realms/:realmId/users/:userId", async (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    return userResultResponseCreate(
      context,
      await userDelete({
        context: systemContext,
        database: options.database,
        profilePicturePublicOrigin: options.profilePicturePublicOrigin,
        profilePictureStorage: options.profilePictureStorage,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.get("/realms/:realmId/me", protectedMiddleware, (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    const result = userGet({
      context: subject.data,
      database: options.database,
      realmId: context.req.param("realmId"),
      userId: subject.data.actorId,
    })
    if (!result.success) return userResultResponseCreate(context, result)
    const capabilities = userRealmReadCapabilityResolve({
      actor: context.get("authorizationActor"),
      database: options.database,
      realmId: context.req.param("realmId"),
    })
    if (!capabilities.success) return userResultResponseCreate(context, capabilities)
    return userResultResponseCreate(
      context,
      { data: { ...result.data, capabilities: capabilities.data }, success: true },
      200,
      new Date(result.data.user.updatedAt),
    )
  })

  app.get("/realms/:realmId/me/authentication-methods", authenticatedMiddleware, (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    return userResultResponseCreate(
      context,
      userAuthenticationMethodsGet({
        context: subject.data,
        database: options.database,
        realmId: context.req.param("realmId"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.get("/realms/:realmId/me/emails", authenticatedMiddleware, (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    return userResultResponseCreate(
      context,
      userEmailAddressList({
        context: subject.data,
        database: options.database,
        realmId: context.req.param("realmId"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.post("/realms/:realmId/me/emails/add/start", authenticatedMiddleware, async (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userEmailAddressAddStartRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The email address request is invalid.",
        op: "userEmailAddressAddStart",
      })
    return userResultResponseCreate(
      context,
      userEmailAddressAddStart({
        clientIp: options.clientIpResolve?.(context),
        context: subject.data,
        database: options.database,
        input: input.output,
        onDelivery: options.onEmailAddressVerificationDelivery,
        rateLimitSecret: options.rateLimitSecret ?? options.systemSecret,
        realmId: context.req.param("realmId"),
        session: context.get("session"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.post("/realms/:realmId/me/emails/add/resend", authenticatedMiddleware, async (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userEmailAddressAddResendRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The email verification request is invalid.",
        op: "userEmailAddressAddResend",
      })
    return userResultResponseCreate(
      context,
      userEmailAddressAddResend({
        clientIp: options.clientIpResolve?.(context),
        context: subject.data,
        database: options.database,
        input: input.output,
        onDelivery: options.onEmailAddressVerificationDelivery,
        rateLimitSecret: options.rateLimitSecret ?? options.systemSecret,
        realmId: context.req.param("realmId"),
        session: context.get("session"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.post("/realms/:realmId/me/emails/add/verify", authenticatedMiddleware, async (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userEmailAddressAddVerifyRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The email verification token is invalid.",
        op: "userEmailAddressAddVerify",
      })
    return userResultResponseCreate(
      context,
      userEmailAddressAddVerify({
        clientIp: options.clientIpResolve?.(context),
        context: subject.data,
        database: options.database,
        input: input.output,
        rateLimitSecret: options.rateLimitSecret ?? options.systemSecret,
        realmId: context.req.param("realmId"),
        runtime: options.database.runtime,
        session: context.get("session"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.post("/realms/:realmId/me/emails/:emailId/primary", authenticatedMiddleware, async (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userEmailAddressPrimarySetRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The primary email address request is invalid.",
        op: "userEmailAddressPrimarySet",
      })
    return userResultResponseCreate(
      context,
      userEmailAddressPrimarySet({
        context: subject.data,
        database: options.database,
        emailId: context.req.param("emailId"),
        input: input.output,
        realmId: context.req.param("realmId"),
        session: context.get("session"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.delete("/realms/:realmId/me/emails/:emailId", authenticatedMiddleware, (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    return userResultResponseCreate(
      context,
      userEmailAddressRemove({
        context: subject.data,
        database: options.database,
        emailId: context.req.param("emailId"),
        realmId: context.req.param("realmId"),
        session: context.get("session"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.post("/realms/:realmId/me/email-change/start", authenticatedMiddleware, async (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userEmailChangeStartRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The account email-change request is invalid.",
        op: "userEmailChangeStart",
      })
    return userResultResponseCreate(
      context,
      userEmailChangeStart({
        clientIp: options.clientIpResolve?.(context),
        context: subject.data,
        database: options.database,
        input: input.output,
        onDelivery: options.onEmailChangeDelivery,
        rateLimitSecret: options.rateLimitSecret ?? options.systemSecret,
        realmId: context.req.param("realmId"),
        session: context.get("session"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.post("/realms/:realmId/me/email-change/resend", authenticatedMiddleware, async (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userEmailChangeResendRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The account email-change request is invalid.",
        op: "userEmailChangeResend",
      })
    return userResultResponseCreate(
      context,
      userEmailChangeResend({
        clientIp: options.clientIpResolve?.(context),
        context: subject.data,
        database: options.database,
        input: input.output,
        onDelivery: options.onEmailChangeDelivery,
        rateLimitSecret: options.rateLimitSecret ?? options.systemSecret,
        realmId: context.req.param("realmId"),
        session: context.get("session"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.post("/realms/:realmId/me/email-change/verify", authenticatedMiddleware, async (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userEmailChangeVerifyRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The account email-change token is invalid.",
        op: "userEmailChangeVerify",
      })
    return userResultResponseCreate(
      context,
      userEmailChangeVerify({
        clientIp: options.clientIpResolve?.(context),
        context: subject.data,
        database: options.database,
        input: input.output,
        onNotification: options.onEmailChangeNotification,
        rateLimitSecret: options.rateLimitSecret ?? options.systemSecret,
        realmId: context.req.param("realmId"),
        session: context.get("session"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.get("/realms/:realmId/users/:userId/authentication-methods", userReadMiddleware, (context) =>
    userResultResponseCreate(
      context,
      userAuthenticationMethodsAdministratorGet({
        actor: context.get("authorizationActor"),
        database: options.database,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    ),
  )

  app.patch("/realms/:realmId/me", protectedMiddleware, async (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userProfileUpdateRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The user profile update is invalid.",
        op: "userProfileUpdate",
      })
    return userResultResponseCreate(
      context,
      userProfileUpdate({
        context: subject.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.put("/realms/:realmId/me/profile-picture", authenticatedMiddleware, async (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    const body = await userProfilePictureBodyRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    return userResultResponseCreate(
      context,
      await userProfilePictureUpload({
        body: body.data,
        contentType: context.req.header("content-type") ?? "",
        context: subject.data,
        database: options.database,
        publicOrigin: options.profilePicturePublicOrigin,
        realmId: context.req.param("realmId"),
        storage: options.profilePictureStorage,
        userId: subject.data.actorId,
      }),
    )
  })

  app.delete("/realms/:realmId/me/profile-picture", authenticatedMiddleware, async (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    return userResultResponseCreate(
      context,
      await userProfilePictureRemove({
        context: subject.data,
        database: options.database,
        publicOrigin: options.profilePicturePublicOrigin,
        realmId: context.req.param("realmId"),
        storage: options.profilePictureStorage,
        userId: subject.data.actorId,
      }),
    )
  })

  app.delete("/realms/:realmId/me", protectedMiddleware, async (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    return userResultResponseCreate(
      context,
      await userDelete({
        context: subject.data,
        database: options.database,
        profilePicturePublicOrigin: options.profilePicturePublicOrigin,
        profilePictureStorage: options.profilePictureStorage,
        realmId: context.req.param("realmId"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.get("/realms/:realmId/users", userReadMiddleware, (context) => {
    const authenticated = userAdministratorAuthorize(
      context,
      options.database,
      context.req.param("realmId"),
      authorizationPermissionDefinitions.userRead,
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return userErrorResponseCreate(context, query)
    return userResultResponseCreate(
      context,
      userList({
        context: authenticated.data,
        database: options.database,
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/users", userManageMiddleware, async (context) => {
    const authenticated = userAdministratorAuthorize(
      context,
      options.database,
      context.req.param("realmId"),
      authorizationPermissionDefinitions.userManage,
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userCreateRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The user request is invalid.",
        op: "userCreate",
      })
    return userResultResponseCreate(
      context,
      userCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.get("/realms/:realmId/users/:userId", userReadMiddleware, (context) => {
    const authenticated = userAdministratorAuthorize(
      context,
      options.database,
      context.req.param("realmId"),
      authorizationPermissionDefinitions.userRead,
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    const result = userGet({
      context: authenticated.data,
      database: options.database,
      realmId: context.req.param("realmId"),
      userId: context.req.param("userId"),
    })
    return userResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.user.updatedAt) : undefined,
    )
  })

  app.patch("/realms/:realmId/users/:userId/profile", userManageMiddleware, async (context) => {
    const authenticated = userAdministratorAuthorize(
      context,
      options.database,
      context.req.param("realmId"),
      authorizationPermissionDefinitions.userManage,
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userProfileUpdateRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The user profile update is invalid.",
        op: "userProfileUpdate",
      })
    return userResultResponseCreate(
      context,
      userProfileUpdate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.post("/realms/:realmId/users/:userId/lifecycle", userManageMiddleware, async (context) => {
    const authenticated = userAdministratorAuthorize(
      context,
      options.database,
      context.req.param("realmId"),
      authorizationPermissionDefinitions.userManage,
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userLifecycleRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The user lifecycle request is invalid.",
        op: "userLifecycleSet",
      })
    return userResultResponseCreate(
      context,
      userLifecycleSet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.post("/realms/:realmId/users/:userId/verification", userManageMiddleware, async (context) => {
    const authenticated = userAdministratorAuthorize(
      context,
      options.database,
      context.req.param("realmId"),
      authorizationPermissionDefinitions.userManage,
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userVerificationRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        code: "users.invalid",
        errorMessage: "The user verification request is invalid.",
        op: "userEmailVerificationSet",
      })
    return userResultResponseCreate(
      context,
      userEmailVerificationSet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.delete("/realms/:realmId/users/:userId", userManageMiddleware, async (context) => {
    const authenticated = userAdministratorAuthorize(
      context,
      options.database,
      context.req.param("realmId"),
      authorizationPermissionDefinitions.userManage,
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    return userResultResponseCreate(
      context,
      await userDelete({
        context: authenticated.data,
        database: options.database,
        profilePicturePublicOrigin: options.profilePicturePublicOrigin,
        profilePictureStorage: options.profilePictureStorage,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  return app
}

function userErrorResponseCreate(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  return httpResultResponseCreate(context, {
    ...result,
    code: result.code ?? "users.invalid",
    success: false,
  } as Result<unknown>)
}

function userResultResponseCreate<T>(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
  lastModified?: Date,
) {
  if (!result.success)
    return userErrorResponseCreate(
      context,
      result as { errorMessage: string; op: string; code?: string; success: false },
    )
  return httpResultResponseCreate(context, result as Result<T>, status, lastModified)
}

async function userRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return {
      code: "users.invalid",
      errorMessage: "The request body is invalid.",
      op: "userRequestJsonRead",
      success: false as const,
    }
  }
}

async function userProfilePictureBodyRead(context: {
  readonly req: {
    readonly header: (name: string) => string | undefined
    readonly raw: Request
  }
}) {
  const op = "userProfilePictureBodyRead"
  const maximumBytes = 512 * 1024
  const contentLength = context.req.header("content-length")
  if (contentLength !== undefined && /^\d+$/.test(contentLength)) {
    const length = Number(contentLength)
    if (Number.isSafeInteger(length) && length > maximumBytes)
      return {
        code: "users.invalid",
        errorMessage: "The user picture must not exceed 512 KiB.",
        op,
        success: false as const,
      }
  }
  const body = context.req.raw.body
  if (body === null) return { data: new Uint8Array(), success: true as const }
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      if (!(chunk.value instanceof Uint8Array)) {
        await reader.cancel().catch(() => undefined)
        return {
          code: "users.invalid",
          errorMessage: "The user picture body is invalid.",
          op,
          success: false as const,
        }
      }
      length += chunk.value.byteLength
      if (length > maximumBytes) {
        await reader.cancel().catch(() => undefined)
        return {
          code: "users.invalid",
          errorMessage: "The user picture must not exceed 512 KiB.",
          op,
          success: false as const,
        }
      }
      chunks.push(chunk.value)
    }
  } catch (_error) {
    return {
      code: "users.invalid",
      errorMessage: "The user picture body is invalid.",
      op,
      success: false as const,
    }
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { data: result, success: true as const }
}

function userSystemAuthorizationGet(authorization: string | undefined, configuredSecret: Secret | string | undefined) {
  const token = userBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return {
      code: "users.unauthorized",
      errorMessage: "System authorization is required.",
      op: "userSystemAuthorizationGet",
      success: false as const,
    }
  return { data: undefined, success: true as const }
}

function userTenantAuthenticate(
  database: StorageDatabase,
  host: string | undefined,
  requestUrl: string,
  authorization: string | undefined,
) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : resolvedHost.split(":")[0]
  const tenant = realmTenantContextResolve({ database, host: normalizedHost ?? "" })
  if (!tenant.success) return tenant
  const authenticated = realmBootstrapAdminAuthenticate({
    context: tenant.data,
    database,
    secret: userBearerTokenGet(authorization) ?? "",
  })
  if (!authenticated.success && authenticated.code === "realms.unauthorized")
    return { ...authenticated, code: "users.unauthorized" }
  if (!authenticated.success) return authenticated
  return authenticated
}

function userBearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? null
}

function userBootstrapFallback(
  database: StorageDatabase,
  context: {
    readonly json: (body: unknown, status?: ContentfulStatusCode) => Response
    readonly req: {
      readonly header: (name: string) => string | undefined
      readonly url: string
    }
    readonly set: (
      key: "authorizationActor" | "cookieAuthenticated",
      value: AuthorizationActorContext | boolean,
    ) => void
  },
  next: Next,
) {
  const tenant = realmTenantContextResolve({
    database,
    host: userRequestHostGet(context.req.header("host"), context.req.url),
  })
  if (!tenant.success) return userErrorResponseCreate(context, tenant)
  const authenticated = realmBootstrapAdminAuthenticate({
    context: tenant.data,
    database,
    secret: userBearerTokenGet(context.req.header("authorization")) ?? "",
  })
  if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
  context.set("authorizationActor", authenticated.data.actor)
  context.set("cookieAuthenticated", false)
  return next()
}

function userRequestHostGet(headerHost: string | undefined, requestUrl: string): string {
  const host = headerHost ?? new URL(requestUrl).hostname
  return host.startsWith("[") ? host.slice(1, host.indexOf("]")) : (host.split(":")[0] ?? "")
}

function userAdministratorAuthorize(
  context: { readonly get: (key: "authorizationActor") => AuthorizationActorContext },
  database: StorageDatabase,
  realmId: string,
  permission: "user.read" | "user.manage",
): Result<RealmTenantContext> {
  return realmAdministratorContextAuthorize({
    actor: context.get("authorizationActor"),
    database,
    permission,
    realmId,
  })
}

function userSubjectContextResolve(
  context: { readonly get: (key: "authorizationActor") => AuthorizationActorContext },
  realmId: string,
): Result<RealmTenantContext> {
  const op = "userSubjectContextResolve"
  const actor = context.get("authorizationActor")
  if (actor.kind !== "user" || actor.realmId !== realmId)
    return {
      code: "users.forbidden",
      errorMessage: "The authenticated user is not available in this realm.",
      op,
      success: false,
    }
  return {
    data: { actor, actorId: actor.actorId, kind: "tenant", realmId },
    success: true,
  }
}
