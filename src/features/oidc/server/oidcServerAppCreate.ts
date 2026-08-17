import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { instanceBootstrapAdminAuthenticate } from "../../instances/actions/instanceBootstrapAdminAuthenticate.js"
import { instanceTenantContextResolve } from "../../instances/actions/instanceTenantContextResolve.js"
import { instanceSystemContextCreate } from "../../instances/domain/instanceSystemContextCreate.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { oidcAuthorizationCodeRedeem } from "../actions/oidcAuthorizationCodeRedeem.js"
import { oidcAuthorizationRequestAuthorize } from "../actions/oidcAuthorizationRequestAuthorize.js"
import { oidcClientCreate } from "../actions/oidcClientCreate.js"
import { oidcClientGet } from "../actions/oidcClientGet.js"
import { oidcClientLifecycleSet } from "../actions/oidcClientLifecycleSet.js"
import { oidcClientList } from "../actions/oidcClientList.js"
import { oidcClientSecretRotate } from "../actions/oidcClientSecretRotate.js"
import { oidcClientUpdate } from "../actions/oidcClientUpdate.js"
import { oidcDiscoveryGet } from "../actions/oidcDiscoveryGet.js"
import { oidcJwksGet } from "../actions/oidcJwksGet.js"
import { oidcSigningKeyCreate } from "../actions/oidcSigningKeyCreate.js"
import { oidcSigningKeyLifecycleSet } from "../actions/oidcSigningKeyLifecycleSet.js"
import { oidcSigningKeyList } from "../actions/oidcSigningKeyList.js"
import { oidcAuthorizationCodeRedeemRequestSchema } from "../public/oidcAuthorizationCodeRedeemRequestSchema.js"
import { oidcAuthorizationRequestSchema } from "../public/oidcAuthorizationRequestSchema.js"
import { oidcClientCreateRequestSchema } from "../public/oidcClientCreateRequestSchema.js"
import { oidcClientLifecycleRequestSchema } from "../public/oidcClientLifecycleRequestSchema.js"
import { oidcClientUpdateRequestSchema } from "../public/oidcClientUpdateRequestSchema.js"
import { oidcSigningKeyLifecycleRequestSchema } from "../public/oidcSigningKeyLifecycleRequestSchema.js"

type OidcServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
}

type OidcRequestContext = ReturnType<typeof instanceSystemContextCreate> | InstanceTenantContext

export function oidcServerAppCreate(options: OidcServerAppCreateOptions) {
  const app = new Hono()
  oidcManagementRoutesRegister(app, options, "/system/instances/:instanceId/oidc", (context) =>
    oidcSystemAuthenticate(context.req.header("authorization"), options.systemSecret),
  )
  oidcManagementRoutesRegister(app, options, "/instances/:instanceId/oidc", (context) =>
    oidcTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    ),
  )

  app.get("/.well-known/openid-configuration", (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcErrorResponseCreate(context, instance)
    const discovery = oidcDiscoveryGet({ database: options.database, instanceId: instance.data.instanceId })
    if (!discovery.success) return oidcErrorResponseCreate(context, discovery)
    return context.json(discovery.data)
  })

  app.get("/.well-known/jwks.json", (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcErrorResponseCreate(context, instance)
    const jwks = oidcJwksGet({ database: options.database, instanceId: instance.data.instanceId })
    if (!jwks.success) return oidcErrorResponseCreate(context, jwks)
    return context.json(jwks.data)
  })

  app.get("/oauth2/authorize", (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcErrorResponseCreate(context, instance)
    const input = v.safeParse(oidcAuthorizationRequestSchema, oidcAuthorizationRequestInputCreate(context))
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC authorization request is invalid.",
        op: "oidcAuthorizationRequestAuthorize",
      })
    const authorization = oidcAuthorizationRequestAuthorize({
      database: options.database,
      encryptionSecret: options.systemSecret,
      input: input.output,
      instanceId: instance.data.instanceId,
      sessionToken: oidcBearerTokenGet(context.req.header("authorization")) ?? "",
    })
    if (!authorization.success) return oidcErrorResponseCreate(context, authorization)
    if (context.req.header("accept")?.includes("application/json")) return context.json(authorization.data)
    const redirect = new URL(authorization.data.redirect_uri)
    redirect.searchParams.set("code", authorization.data.code)
    redirect.searchParams.set("state", authorization.data.state)
    return context.redirect(redirect.toString(), 302)
  })

  app.post("/oauth2/authorization-code/redeem", async (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcErrorResponseCreate(context, instance)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcAuthorizationCodeRedeemRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The authorization code request is invalid.",
        op: "oidcAuthorizationCodeRedeem",
      })
    return oidcResultResponseCreate(
      context,
      oidcAuthorizationCodeRedeem({
        database: options.database,
        encryptionSecret: options.systemSecret,
        input: input.output,
        instanceId: instance.data.instanceId,
      }),
    )
  })
  return app
}

function oidcManagementRoutesRegister(
  app: Hono,
  options: OidcServerAppCreateOptions,
  prefix: string,
  authenticate: (context: {
    req: { header: (name: string) => string | undefined; url: string }
  }) => { data: OidcRequestContext; success: true } | { errorMessage: string; op: string; success: false },
) {
  app.get(`${prefix}/clients`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcClientList({
        context: authenticated.data,
        database: options.database,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.post(`${prefix}/clients`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcClientCreateRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC client request is invalid.",
        op: "oidcClientCreate",
      })
    return oidcResultResponseCreate(
      context,
      oidcClientCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
      201,
    )
  })

  app.get(`${prefix}/clients/:clientId`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcClientGet({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.patch(`${prefix}/clients/:clientId`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcClientUpdateRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC client update is invalid.",
        op: "oidcClientUpdate",
      })
    return oidcResultResponseCreate(
      context,
      oidcClientUpdate({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        input: input.output,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.post(`${prefix}/clients/:clientId/lifecycle`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcClientLifecycleRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC client lifecycle request is invalid.",
        op: "oidcClientLifecycleSet",
      })
    return oidcResultResponseCreate(
      context,
      oidcClientLifecycleSet({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        input: input.output,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.post(`${prefix}/clients/:clientId/secret/rotate`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcClientSecretRotate({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.get(`${prefix}/signing-keys`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcSigningKeyList({
        context: authenticated.data,
        database: options.database,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.post(`${prefix}/signing-keys`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcSigningKeyCreate({
        context: authenticated.data,
        database: options.database,
        encryptionSecret: options.systemSecret,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
      201,
    )
  })

  app.post(`${prefix}/signing-keys/:signingKeyId/lifecycle`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcSigningKeyLifecycleRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The signing key lifecycle request is invalid.",
        op: "oidcSigningKeyLifecycleSet",
      })
    return oidcResultResponseCreate(
      context,
      oidcSigningKeyLifecycleSet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        instanceId: oidcParamGet(context, "instanceId"),
        signingKeyId: oidcParamGet(context, "signingKeyId"),
      }),
    )
  })
}

function oidcSystemAuthenticate(authorization: string | undefined, configuredSecret: Secret | string | undefined) {
  const token = oidcBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return { errorMessage: "System authorization is required.", op: "oidcSystemAuthorization", success: false as const }
  return { data: instanceSystemContextCreate(), success: true as const }
}

function oidcTenantAuthenticate(
  database: StorageDatabase,
  host: string | undefined,
  requestUrl: string,
  authorization: string | undefined,
) {
  const tenant = oidcPublicInstanceResolve(database, host, requestUrl)
  if (!tenant.success) return tenant
  return instanceBootstrapAdminAuthenticate({
    context: { ...tenant.data, actor: { ...tenant.data.actor, kind: "anonymous" }, actorId: "anonymous" },
    database,
    secret: oidcBearerTokenGet(authorization) ?? "",
  })
}

function oidcPublicInstanceResolve(database: StorageDatabase, host: string | undefined, requestUrl: string) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : resolvedHost.split(":")[0]
  return instanceTenantContextResolve({ database, host: normalizedHost ?? "" })
}

function oidcBearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? null
}

function oidcAuthorizationRequestInputCreate(context: {
  req: { query: (name: string) => string | undefined }
}): Record<string, string> {
  const nonce = context.req.query("nonce")
  const prompt = context.req.query("prompt")
  return {
    client_id: context.req.query("client_id") ?? "",
    code_challenge: context.req.query("code_challenge") ?? "",
    code_challenge_method: context.req.query("code_challenge_method") ?? "",
    ...(nonce === undefined ? {} : { nonce }),
    ...(prompt === undefined ? {} : { prompt }),
    redirect_uri: context.req.query("redirect_uri") ?? "",
    response_type: context.req.query("response_type") ?? "",
    scope: context.req.query("scope") ?? "",
    state: context.req.query("state") ?? "",
  }
}

function oidcParamGet(context: { req: { param: (name: string) => string | undefined } }, name: string): string {
  return context.req.param(name) ?? ""
}

function oidcErrorResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { errorMessage: string; op: string },
) {
  const code = oidcErrorCodeGet(result)
  return context.json(
    httpErrorResponseCreate(code, result.errorMessage),
    httpErrorStatusGet(code) as ContentfulStatusCode,
  )
}

function oidcErrorCodeGet(result: { errorMessage: string; op: string }): string {
  const message = result.errorMessage.toLowerCase()
  const op = result.op.toLowerCase()
  if (
    op.includes("systemauthorization") ||
    op.includes("authenticate") ||
    message.includes("authentication") ||
    message.includes("session authorization") ||
    message.includes("credentials")
  )
    return "unauthorized"
  if (message.includes("not authorized") || message.includes("forbidden")) return "forbidden"
  if (message.includes("not found") || message.includes("not available") || message.includes("tenant host"))
    return "not_found"
  if (
    message.includes("already") ||
    message.includes("removed") ||
    message.includes("inactive") ||
    message.includes("do not have")
  )
    return "conflict"
  if (
    message.includes("invalid") ||
    message.includes("empty") ||
    message.includes("unique") ||
    message.includes("must")
  )
    return "bad_request"
  return "internal_server_error"
}

function oidcResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; op?: string; success: boolean },
  status = 200,
) {
  if (!result.success) return oidcErrorResponseCreate(context, result as { errorMessage: string; op: string })
  return context.json(result.data, status as ContentfulStatusCode)
}

async function oidcRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return { errorMessage: "The request body is invalid.", op: "oidcRequestJsonRead", success: false as const }
  }
}
