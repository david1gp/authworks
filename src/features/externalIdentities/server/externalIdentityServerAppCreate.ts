import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { instanceTenantContextResolve } from "../../instances/actions/instanceTenantContextResolve.js"
import { instanceSystemContextCreate } from "../../instances/domain/instanceSystemContextCreate.js"
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
  const systemContext = instanceSystemContextCreate("system")
  const providerPorts = options.providerPorts ?? externalIdentityProviderPortCreate()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    minimumAssurance: "authenticated",
  })

  app.get("/instances/:instanceId/external-identity-providers", (context) => {
    const tenant = externalIdentityTenantInstanceResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("instanceId"),
    )
    if (!tenant.success) return externalIdentityErrorResponseCreate(context, tenant)
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderList({
        database: options.database,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.query("organizationId"),
      }),
    )
  })

  app.get("/system/instances/:instanceId/external-identity-providers", (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderList({
        database: options.database,
        includeDisabled: true,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.query("organizationId"),
      }),
    )
  })

  app.post("/system/instances/:instanceId/external-identity-providers", async (context) => {
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
        errorMessage: "The provider request is invalid.",
        op: "externalIdentityProviderCreate",
      })
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderCreate({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
      }),
      201,
    )
  })

  app.get("/system/instances/:instanceId/external-identity-providers/:providerId", (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderGet({
        database: options.database,
        includeDisabled: true,
        instanceId: context.req.param("instanceId"),
        providerId: context.req.param("providerId"),
      }),
    )
  })

  app.patch("/system/instances/:instanceId/external-identity-providers/:providerId", async (context) => {
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
        errorMessage: "The provider update is invalid.",
        op: "externalIdentityProviderUpdate",
      })
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderUpdate({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        providerId: context.req.param("providerId"),
      }),
    )
  })

  app.post("/system/instances/:instanceId/external-identity-providers/:providerId/disable", (context) => {
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
        instanceId: context.req.param("instanceId"),
        providerId: context.req.param("providerId"),
      }),
    )
  })

  app.post("/instances/:instanceId/external-identity/:providerId/start", async (context) => {
    const tenant = externalIdentityTenantInstanceResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("instanceId"),
    )
    if (!tenant.success) return externalIdentityErrorResponseCreate(context, tenant)
    const body = await externalIdentityJsonRead(context)
    if (!body.success) return externalIdentityErrorResponseCreate(context, body)
    const input = v.safeParse(externalIdentityStartRequestSchema, body.data)
    if (!input.success)
      return externalIdentityErrorResponseCreate(context, {
        errorMessage: "The external identity start request is invalid.",
        op: "externalIdentityStart",
      })
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityStart({
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        providerId: context.req.param("providerId"),
        providerPorts,
      }),
    )
  })

  app.get("/instances/:instanceId/external-identity/:providerId/callback", async (context) => {
    const tenant = externalIdentityTenantInstanceResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("instanceId"),
    )
    if (!tenant.success) return externalIdentityErrorResponseCreate(context, tenant)
    return externalIdentityResultResponseCreate(
      context,
      await externalIdentityCallback({
        code: context.req.query("code") ?? "",
        database: options.database,
        deviceMetadata: externalIdentityDeviceMetadataGet(context),
        instanceId: context.req.param("instanceId"),
        providerId: context.req.param("providerId"),
        providerPorts,
        state: context.req.query("state") ?? "",
      }),
    )
  })

  app.post(
    "/instances/:instanceId/users/:userId/external-identities/:providerId/link/start",
    protectedMiddleware,
    async (context) => {
      const body = await externalIdentityJsonRead(context)
      if (!body.success) return externalIdentityErrorResponseCreate(context, body)
      const input = v.safeParse(externalIdentityStartRequestSchema, body.data)
      if (!input.success)
        return externalIdentityErrorResponseCreate(context, {
          errorMessage: "The external identity link request is invalid.",
          op: "externalIdentityLinkStart",
        })
      return externalIdentityResultResponseCreate(
        context,
        externalIdentityLinkStart({
          database: options.database,
          input: input.output,
          instanceId: context.req.param("instanceId"),
          providerId: context.req.param("providerId"),
          providerPorts,
          session: context.get("session"),
          userId: context.req.param("userId"),
        }),
      )
    },
  )

  app.post(
    "/instances/:instanceId/users/:userId/external-identities/:providerId/link/complete",
    protectedMiddleware,
    async (context) => {
      const body = await externalIdentityJsonRead(context)
      if (!body.success) return externalIdentityErrorResponseCreate(context, body)
      const input = v.safeParse(externalIdentityLinkCompleteRequestSchema, body.data)
      if (!input.success)
        return externalIdentityErrorResponseCreate(context, {
          errorMessage: "Explicit link confirmation is required.",
          op: "externalIdentityLinkComplete",
        })
      return externalIdentityResultResponseCreate(
        context,
        externalIdentityLinkComplete({
          database: options.database,
          input: input.output,
          instanceId: context.req.param("instanceId"),
          providerId: context.req.param("providerId"),
          session: context.get("session"),
          userId: context.req.param("userId"),
        }),
      )
    },
  )

  app.get("/instances/:instanceId/users/:userId/external-identities", protectedMiddleware, (context) =>
    externalIdentityResultResponseCreate(
      context,
      externalIdentityList({
        database: options.database,
        instanceId: context.req.param("instanceId"),
        session: context.get("session"),
        userId: context.req.param("userId"),
      }),
    ),
  )

  app.delete(
    "/instances/:instanceId/users/:userId/external-identities/:providerId/:externalSubject",
    protectedMiddleware,
    (context) =>
      externalIdentityResultResponseCreate(
        context,
        externalIdentityUnlink({
          database: options.database,
          externalSubject: context.req.param("externalSubject"),
          instanceId: context.req.param("instanceId"),
          providerId: context.req.param("providerId"),
          session: context.get("session"),
          userId: context.req.param("userId"),
        }),
      ),
  )

  return app
}

function externalIdentityTenantInstanceResolve(
  database: StorageDatabase,
  host: string | undefined,
  requestUrl: string,
  instanceId: string,
) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : (resolvedHost.split(":")[0] ?? "")
  const tenant = instanceTenantContextResolve({ database, host: normalizedHost })
  if (!tenant.success) return tenant
  if (tenant.data.instanceId !== instanceId)
    return {
      errorMessage: "The instance is not available in this tenant context.",
      op: "externalIdentityTenantInstanceResolve",
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
    return { errorMessage: "The request body is invalid.", op: "externalIdentityJsonRead", success: false as const }
  }
}

function externalIdentityErrorResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { errorMessage: string; op: string },
) {
  const message = result.errorMessage
  const code =
    result.op.includes("Authorization") || message.includes("authorization") || message.includes("session")
      ? "unauthorized"
      : message.includes("not found")
        ? "not_found"
        : message.includes("already") || message.includes("last usable")
          ? "conflict"
          : message.includes("disabled")
            ? "forbidden"
            : "bad_request"
  return context.json(httpErrorResponseCreate(code, message), httpErrorStatusGet(code) as ContentfulStatusCode)
}

function externalIdentityResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; op?: string; success: boolean },
  status = 200,
) {
  if (!result.success)
    return externalIdentityErrorResponseCreate(context, {
      errorMessage: result.errorMessage ?? "The external identity request failed.",
      op: result.op ?? "externalIdentity",
    })
  return context.json(result.data, status as ContentfulStatusCode)
}
