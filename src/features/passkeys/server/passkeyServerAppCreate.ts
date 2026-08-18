import { Hono } from "hono"
import * as v from "valibot"
import type { Result } from "#result"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import { passkeyAuthenticationComplete } from "../actions/passkeyAuthenticationComplete.js"
import { passkeyAuthenticationStart } from "../actions/passkeyAuthenticationStart.js"
import { passkeyCredentialList } from "../actions/passkeyCredentialList.js"
import { passkeyCredentialRevoke } from "../actions/passkeyCredentialRevoke.js"
import { passkeyRegistrationComplete } from "../actions/passkeyRegistrationComplete.js"
import { passkeyRegistrationStart } from "../actions/passkeyRegistrationStart.js"
import { passkeyAuthenticationCompleteRequestSchema } from "../public/passkeyAuthenticationCompleteRequestSchema.js"
import { passkeyCredentialRevokeRequestSchema } from "../public/passkeyCredentialRevokeRequestSchema.js"
import { passkeyRegistrationCompleteRequestSchema } from "../public/passkeyRegistrationCompleteRequestSchema.js"
import { passkeyRegistrationStartRequestSchema } from "../public/passkeyRegistrationStartRequestSchema.js"
import { passkeyAuthenticationStartRequestSchema } from "../public/passkeyAuthenticationStartRequestSchema.js"

type PasskeyServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly origins: readonly string[]
  readonly rpId: string
  readonly rpName: string
}

type PasskeyServerEnv = {
  Variables: {
    authorizationActor: { actorId: string }
    session: { id: string }
  }
}

type PasskeyRouteContext = {
  readonly get: {
    (key: "authorizationActor"): { actorId: string }
    (key: "session"): { id: string }
  }
  readonly json: (body: unknown, status?: number) => Response
  readonly req: {
    readonly header: (name: string) => string | undefined
    readonly json: <T>() => Promise<T>
    readonly param: (name: string) => string
    readonly query: () => Record<string, string>
  }
}

export function passkeyServerAppCreate(options: PasskeyServerAppCreateOptions) {
  const app = new Hono<PasskeyServerEnv>()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({ database: options.database })
  const strongMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    minimumAssurance: "multi_factor",
  })

  app.post("/realms/:realmId/passkeys/registration/start", protectedMiddleware, async (context) => {
    const body = await passkeyJsonRead(context)
    const input = body.success
      ? v.safeParse(passkeyRegistrationStartRequestSchema, body.data)
      : v.safeParse(passkeyRegistrationStartRequestSchema, {})
    if (!input.success)
      return passkeyErrorResponseCreate(context, "The passkey registration request is invalid.", "passkeys.invalid")
    return passkeyResultResponseCreate(
      context,
      await passkeyRegistrationStart({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        realmId: context.req.param("realmId"),
        origins: options.origins,
        rpId: options.rpId,
        rpName: options.rpName,
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.post("/realms/:realmId/passkeys/registration/complete", protectedMiddleware, async (context) => {
    const body = await passkeyJsonRead(context)
    if (!body.success) return passkeyErrorResponseCreate(context, body.errorMessage, "passkeys.invalid")
    const input = v.safeParse(passkeyRegistrationCompleteRequestSchema, body.data)
    if (!input.success)
      return passkeyErrorResponseCreate(context, "The passkey registration response is invalid.", "passkeys.invalid")
    return passkeyResultResponseCreate(
      context,
      await passkeyRegistrationComplete({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        origins: options.origins,
        rpId: options.rpId,
        rpName: options.rpName,
        runtime: options.database.runtime,
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.post("/realms/:realmId/passkeys/authentication/start", async (context) => {
    const tenant = passkeyTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return passkeyErrorResponseCreate(context, tenant.errorMessage, "passkeys.not-found")
    const body = await passkeyJsonRead(context)
    const input = body.success
      ? v.safeParse(passkeyAuthenticationStartRequestSchema, body.data)
      : v.safeParse(passkeyAuthenticationStartRequestSchema, {})
    if (!input.success)
      return passkeyErrorResponseCreate(context, "The passkey authentication request is invalid.", "passkeys.invalid")
    return passkeyResultResponseCreate(
      context,
      await passkeyAuthenticationStart({
        database: options.database,
        realmId: context.req.param("realmId"),
        organizationId: input.output.organizationId,
        origins: options.origins,
        purpose: "passwordless",
        rpId: options.rpId,
        rpName: options.rpName,
      }),
    )
  })

  app.post("/realms/:realmId/passkeys/authentication/complete", async (context) => {
    const tenant = passkeyTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return passkeyErrorResponseCreate(context, tenant.errorMessage, "passkeys.not-found")
    const body = await passkeyJsonRead(context)
    if (!body.success) return passkeyErrorResponseCreate(context, body.errorMessage, "passkeys.invalid")
    const input = v.safeParse(passkeyAuthenticationCompleteRequestSchema, body.data)
    if (!input.success)
      return passkeyErrorResponseCreate(context, "The passkey authentication response is invalid.", "passkeys.invalid")
    return passkeyResultResponseCreate(
      context,
      await passkeyAuthenticationComplete({
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        origins: options.origins,
        rpId: options.rpId,
        rpName: options.rpName,
      }),
    )
  })

  app.post("/realms/:realmId/passkeys/mfa/start", protectedMiddleware, (context) =>
    passkeyResultResponseCreate(
      context,
      passkeyAuthenticationStart({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        realmId: context.req.param("realmId"),
        origins: options.origins,
        purpose: "mfa",
        rpId: options.rpId,
        rpName: options.rpName,
        sessionId: context.get("session").id,
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.post("/realms/:realmId/passkeys/mfa/complete", protectedMiddleware, async (context) =>
    passkeyAuthenticationCompleteRoute(context, options, "mfa"),
  )

  app.post("/realms/:realmId/passkeys/step-up/start", protectedMiddleware, (context) =>
    passkeyResultResponseCreate(
      context,
      passkeyAuthenticationStart({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        realmId: context.req.param("realmId"),
        origins: options.origins,
        purpose: "step_up",
        rpId: options.rpId,
        rpName: options.rpName,
        sessionId: context.get("session").id,
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.post("/realms/:realmId/passkeys/step-up/complete", protectedMiddleware, async (context) =>
    passkeyAuthenticationCompleteRoute(context, options, "step_up"),
  )

  app.get("/realms/:realmId/passkeys", protectedMiddleware, (context) =>
    passkeyCredentialListRoute(context, options.database),
  )

  app.delete("/realms/:realmId/passkeys", strongMiddleware, async (context) => {
    const body = await passkeyJsonRead(context)
    if (!body.success) return passkeyErrorResponseCreate(context, body.errorMessage, "passkeys.invalid")
    const input = v.safeParse(passkeyCredentialRevokeRequestSchema, body.data)
    if (!input.success)
      return passkeyErrorResponseCreate(context, "The passkey credential is invalid.", "passkeys.invalid")
    return passkeyResultResponseCreate(
      context,
      passkeyCredentialRevoke({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  return app
}

function passkeyTenantContextResolve(
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
      op: "passkeyTenantContextResolve",
      success: false as const,
    }
  return tenant
}

async function passkeyAuthenticationCompleteRoute(
  context: PasskeyRouteContext,
  options: PasskeyServerAppCreateOptions,
  purpose: "mfa" | "step_up",
) {
  const body = await passkeyJsonRead(context)
  if (!body.success) return passkeyErrorResponseCreate(context, body.errorMessage, "passkeys.invalid")
  const input = v.safeParse(passkeyAuthenticationCompleteRequestSchema, body.data)
  if (!input.success)
    return passkeyErrorResponseCreate(context, "The passkey authentication response is invalid.", "passkeys.invalid")
  return passkeyResultResponseCreate(
    context,
    await passkeyAuthenticationComplete({
      actorId: context.get("authorizationActor").actorId,
      database: options.database,
      input: input.output,
      realmId: context.req.param("realmId"),
      origins: options.origins,
      rpId: options.rpId,
      rpName: options.rpName,
      expectedPurpose: purpose,
      sessionToken: passkeyBearerTokenGet(context.req.header("authorization")),
    }),
  )
}

async function passkeyJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return { errorMessage: "The request body is invalid.", success: false as const }
  }
}

function passkeyBearerTokenGet(authorization: string | undefined): string {
  if (authorization === undefined) return ""
  return /^Bearer (.+)$/.exec(authorization)?.[1] ?? ""
}

function passkeyErrorResponseCreate(context: PasskeyRouteContext, message: string, code = "passkeys.invalid") {
  return httpResultResponseCreate(context, {
    code,
    errorMessage: message,
    op: "passkeyServerRequest",
    success: false,
  } as Result<unknown>)
}

function passkeyResultResponseCreate<T>(
  context: PasskeyRouteContext,
  result:
    | { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean }
    | Promise<{ data?: T; errorMessage?: string; op?: string; code?: string; success: boolean }>,
) {
  return Promise.resolve(result).then((resolved) => {
    if (!resolved.success) return httpResultResponseCreate(context, resolved as Result<unknown>)
    return httpResultResponseCreate(context, resolved as Result<T>)
  })
}

function passkeyCredentialListRoute(context: PasskeyRouteContext, database: StorageDatabase) {
  const query = listQueryFromSearchParams(context.req.query())
  if (!query.success) return httpResultResponseCreate(context, query as Result<unknown>)
  return passkeyResultResponseCreate(
    context,
    passkeyCredentialList({
      database,
      query: query.data,
      realmId: context.req.param("realmId"),
      userId: context.get("authorizationActor").actorId,
    }),
  )
}
