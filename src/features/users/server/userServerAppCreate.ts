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
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { realmBootstrapAdminAuthenticate } from "../../realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import { userAuthenticationMethodsGet } from "../actions/userAuthenticationMethodsGet.js"
import { userCreate } from "../actions/userCreate.js"
import { userDelete } from "../actions/userDelete.js"
import { userEmailVerificationSet } from "../actions/userEmailVerificationSet.js"
import { userGet } from "../actions/userGet.js"
import { userLifecycleSet } from "../actions/userLifecycleSet.js"
import { userList } from "../actions/userList.js"
import { userProfileUpdate } from "../actions/userProfileUpdate.js"
import { userCreateRequestSchema } from "../public/userCreateRequestSchema.js"
import { userLifecycleRequestSchema } from "../public/userLifecycleRequestSchema.js"
import { userProfileUpdateRequestSchema } from "../public/userProfileUpdateRequestSchema.js"
import { userVerificationRequestSchema } from "../public/userVerificationRequestSchema.js"

type UserServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly publicOrigin?: string
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

  app.delete("/system/realms/:realmId/users/:userId", (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    return userResultResponseCreate(
      context,
      userDelete({
        context: systemContext,
        database: options.database,
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
    return userResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.user.updatedAt) : undefined,
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

  app.delete("/realms/:realmId/me", protectedMiddleware, (context) => {
    const subject = userSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return userErrorResponseCreate(context, subject)
    return userResultResponseCreate(
      context,
      userDelete({
        context: subject.data,
        database: options.database,
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

  app.delete("/realms/:realmId/users/:userId", userManageMiddleware, (context) => {
    const authenticated = userAdministratorAuthorize(
      context,
      options.database,
      context.req.param("realmId"),
      authorizationPermissionDefinitions.userManage,
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    return userResultResponseCreate(
      context,
      userDelete({
        context: authenticated.data,
        database: options.database,
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
