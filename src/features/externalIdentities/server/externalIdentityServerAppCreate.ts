import { Hono } from "hono"
import * as v from "valibot"
import type { Result } from "#result"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { externalIdentityCallback } from "../actions/externalIdentityCallback.js"
import { externalIdentityLinkComplete } from "../actions/externalIdentityLinkComplete.js"
import { externalIdentityLinkStart } from "../actions/externalIdentityLinkStart.js"
import { externalIdentityList } from "../actions/externalIdentityList.js"
import { externalIdentityProviderCreate } from "../actions/externalIdentityProviderCreate.js"
import { externalIdentityProviderDisable } from "../actions/externalIdentityProviderDisable.js"
import { externalIdentityProviderGet } from "../actions/externalIdentityProviderGet.js"
import { externalIdentityProviderList } from "../actions/externalIdentityProviderList.js"
import { externalIdentityProviderUpdate } from "../actions/externalIdentityProviderUpdate.js"
import { externalIdentityStart } from "../actions/externalIdentityStart.js"
import { externalIdentityUnlink } from "../actions/externalIdentityUnlink.js"
import { externalIdentityProviderPortCreate } from "../domain/externalIdentityProviderPortCreate.js"
import type { ExternalIdentityProviderPorts } from "../domain/externalIdentityProviderPort.js"
import { externalIdentityProviderCreateRequestSchema } from "../public/externalIdentityProviderCreateRequestSchema.js"
import { externalIdentityProviderUpdateRequestSchema } from "../public/externalIdentityProviderUpdateRequestSchema.js"
import { externalIdentityLinkCompleteRequestSchema } from "../public/externalIdentityLinkCompleteRequestSchema.js"
import { externalIdentityStartRequestSchema } from "../public/externalIdentityStartRequestSchema.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"

type ExternalIdentityServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly providerPorts?: ExternalIdentityProviderPorts
  readonly systemSecret?: Secret | string
}

export function externalIdentityServerAppCreate(options: ExternalIdentityServerAppCreateOptions) {
  const app = new Hono()
  const systemContext = realmSystemContextCreate("system")
  const providerPorts = options.providerPorts ?? externalIdentityProviderPortCreate()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    minimumAssurance: "authenticated",
  })

  app.get("/realms/:realmId/external-identity-providers", (context) => {
    const tenant = externalIdentityTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return externalIdentityErrorResponseCreate(context, tenant)
    const query = listQueryFromSearchParams(context.req.query())
    if (!query.success) return externalIdentityErrorResponseCreate(context, query)
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderList({
        database: options.database,
        realmId: context.req.param("realmId"),
        organizationId: context.req.query("organizationId"),
        query: query.data,
      }),
    )
  })

  app.get("/system/realms/:realmId/external-identity-providers", (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    const query = listQueryFromSearchParams(context.req.query())
    if (!query.success) return externalIdentityErrorResponseCreate(context, query)
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderList({
        database: options.database,
        includeDisabled: true,
        realmId: context.req.param("realmId"),
        organizationId: context.req.query("organizationId"),
        query: query.data,
      }),
    )
  })

  app.post("/system/realms/:realmId/external-identity-providers", async (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    const body = await externalIdentityJsonRead(context)
    if (!body.success) return externalIdentityErrorResponseCreate(context, body)
    const input = v.safeParse(externalIdentityProviderCreateRequestSchema, body.data)
    if (!input.success)
      return externalIdentityErrorResponseCreate(context, {
        code: "external-identities.invalid",
        errorMessage: "The provider request is invalid.",
        op: "externalIdentityProviderCreate",
      })
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderCreate({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.get("/system/realms/:realmId/external-identity-providers/:providerId", (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    const result = externalIdentityProviderGet({
      database: options.database,
      includeDisabled: true,
      realmId: context.req.param("realmId"),
      providerId: context.req.param("providerId"),
    })
    return externalIdentityResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.provider.updatedAt) : undefined,
    )
  })

  app.patch("/system/realms/:realmId/external-identity-providers/:providerId", async (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    const body = await externalIdentityJsonRead(context)
    if (!body.success) return externalIdentityErrorResponseCreate(context, body)
    const input = v.safeParse(externalIdentityProviderUpdateRequestSchema, body.data)
    if (!input.success)
      return externalIdentityErrorResponseCreate(context, {
        code: "external-identities.invalid",
        errorMessage: "The provider update is invalid.",
        op: "externalIdentityProviderUpdate",
      })
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderUpdate({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        providerId: context.req.param("providerId"),
      }),
    )
  })

  app.post("/system/realms/:realmId/external-identity-providers/:providerId/disable", (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderDisable({
        context: systemContext,
        database: options.database,
        realmId: context.req.param("realmId"),
        providerId: context.req.param("providerId"),
      }),
    )
  })

  app.post("/realms/:realmId/external-identity/:providerId/start", async (context) => {
    const tenant = externalIdentityTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return externalIdentityErrorResponseCreate(context, tenant)
    const body = await externalIdentityJsonRead(context)
    if (!body.success) return externalIdentityErrorResponseCreate(context, body)
    const input = v.safeParse(externalIdentityStartRequestSchema, body.data)
    if (!input.success)
      return externalIdentityErrorResponseCreate(context, {
        code: "external-identities.invalid",
        errorMessage: "The external identity start request is invalid.",
        op: "externalIdentityStart",
      })
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityStart({
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        providerId: context.req.param("providerId"),
        providerPorts,
      }),
    )
  })

  app.get("/realms/:realmId/external-identity/:providerId/callback", async (context) => {
    const tenant = externalIdentityTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return externalIdentityErrorResponseCreate(context, tenant)
    return externalIdentityResultResponseCreate(
      context,
      await externalIdentityCallback({
        code: context.req.query("code") ?? "",
        database: options.database,
        deviceMetadata: externalIdentityDeviceMetadataGet(context),
        realmId: context.req.param("realmId"),
        providerId: context.req.param("providerId"),
        providerPorts,
        state: context.req.query("state") ?? "",
      }),
    )
  })

  app.post(
    "/realms/:realmId/users/:userId/external-identities/:providerId/link/start",
    protectedMiddleware,
    async (context) => {
      const body = await externalIdentityJsonRead(context)
      if (!body.success) return externalIdentityErrorResponseCreate(context, body)
      const input = v.safeParse(externalIdentityStartRequestSchema, body.data)
      if (!input.success)
        return externalIdentityErrorResponseCreate(context, {
          code: "external-identities.invalid",
          errorMessage: "The external identity link request is invalid.",
          op: "externalIdentityLinkStart",
        })
      return externalIdentityResultResponseCreate(
        context,
        externalIdentityLinkStart({
          database: options.database,
          input: input.output,
          realmId: context.req.param("realmId"),
          providerId: context.req.param("providerId"),
          providerPorts,
          session: context.get("session"),
          userId: context.req.param("userId"),
        }),
      )
    },
  )

  app.post(
    "/realms/:realmId/users/:userId/external-identities/:providerId/link/complete",
    protectedMiddleware,
    async (context) => {
      const body = await externalIdentityJsonRead(context)
      if (!body.success) return externalIdentityErrorResponseCreate(context, body)
      const input = v.safeParse(externalIdentityLinkCompleteRequestSchema, body.data)
      if (!input.success)
        return externalIdentityErrorResponseCreate(context, {
          code: "external-identities.invalid",
          errorMessage: "Explicit link confirmation is required.",
          op: "externalIdentityLinkComplete",
        })
      return externalIdentityResultResponseCreate(
        context,
        externalIdentityLinkComplete({
          database: options.database,
          input: input.output,
          realmId: context.req.param("realmId"),
          providerId: context.req.param("providerId"),
          session: context.get("session"),
          userId: context.req.param("userId"),
        }),
      )
    },
  )

  app.get("/realms/:realmId/users/:userId/external-identities", protectedMiddleware, (context) =>
    externalIdentityListRoute(context, options.database),
  )

  app.delete(
    "/realms/:realmId/users/:userId/external-identities/:providerId/:externalSubject",
    protectedMiddleware,
    (context) =>
      externalIdentityResultResponseCreate(
        context,
        externalIdentityUnlink({
          database: options.database,
          externalSubject: context.req.param("externalSubject"),
          realmId: context.req.param("realmId"),
          providerId: context.req.param("providerId"),
          session: context.get("session"),
          userId: context.req.param("userId"),
        }),
      ),
  )

  return app
}

function externalIdentityTenantContextResolve(
  database: StorageDatabase,
  host: string | undefined,
  requestUrl: string,
  realmId: string,
) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : (resolvedHost.split(":")[0] ?? "")
  const tenant = realmTenantContextResolve({ database, host: normalizedHost })
  if (!tenant.success) return tenant
  if (tenant.data.realmId !== realmId)
    return {
      errorMessage: "The realm is not available in this tenant context.",
      op: "externalIdentityTenantContextResolve",
      success: false as const,
    }
  return tenant
}

function externalIdentitySystemAuthorizationGet(
  authorization: string | undefined,
  configuredSecret: Secret | string | undefined,
) {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1]
  if (configuredSecret === undefined || token === undefined || !secretMatches(token, configuredSecret))
    return {
      code: "external-identities.authentication-required",
      errorMessage: "System authorization is required.",
      op: "externalIdentitySystemAuthorizationGet",
      success: false as const,
    }
  return { data: undefined, success: true as const }
}

function externalIdentityDeviceMetadataGet(context: { req: { header: (name: string) => string | undefined } }) {
  const forwardedFor = context.req.header("x-forwarded-for")?.split(",", 1)[0]?.trim()
  return {
    ...(context.req.header("user-agent") === undefined ? {} : { userAgent: context.req.header("user-agent") }),
    ...(forwardedFor === undefined || forwardedFor.length === 0 ? {} : { ipAddress: forwardedFor }),
    ...(context.req.header("x-device-fingerprint") === undefined
      ? {}
      : { fingerprint: context.req.header("x-device-fingerprint") }),
    ...(context.req.header("x-device-description") === undefined
      ? {}
      : { description: context.req.header("x-device-description") }),
  }
}

async function externalIdentityJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return {
      code: "external-identities.invalid",
      errorMessage: "The request body is invalid.",
      op: "externalIdentityJsonRead",
      success: false as const,
    }
  }
}

function externalIdentityErrorResponseCreate(
  context: ExternalIdentityRouteContext,
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  return httpResultResponseCreate(context, {
    ...result,
    success: false,
    code: result.code ?? "external-identities.invalid",
  } as Result<unknown>)
}

function externalIdentityResultResponseCreate<T>(
  context: ExternalIdentityRouteContext,
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
  lastModified?: Date,
) {
  if (!result.success)
    return externalIdentityErrorResponseCreate(context, {
      code: result.code,
      errorMessage: result.errorMessage ?? "The external identity request failed.",
      op: result.op ?? "externalIdentity",
      success: false,
    })
  return httpResultResponseCreate(context, result as Result<T>, status, lastModified)
}

function externalIdentityListRoute(context: ExternalIdentityRouteContext, database: StorageDatabase) {
  const query = listQueryFromSearchParams(context.req.query())
  if (!query.success) return externalIdentityErrorResponseCreate(context, query)
  return externalIdentityResultResponseCreate(
    context,
    externalIdentityList({
      database,
      query: query.data,
      realmId: context.req.param("realmId"),
      session: context.get("session"),
      userId: context.req.param("userId"),
    }),
  )
}

type ExternalIdentityRouteContext = {
  readonly get: (key: "session") => import("../../sessions/public/sessionSchema.js").Session
  readonly json: (body: unknown, status?: number) => Response
  readonly req: {
    readonly header: (name: string) => string | undefined
    readonly param: (name: string) => string
    readonly query: {
      (): Record<string, string>
      (name: string): string | undefined
    }
    readonly url: string
  }
}
