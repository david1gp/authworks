import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
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
  readonly json: (body: unknown, status?: ContentfulStatusCode) => Response
  readonly req: {
    readonly header: (name: string) => string | undefined
    readonly json: <T>() => Promise<T>
    readonly param: (name: string) => string
  }
}

export function passkeyServerAppCreate(options: PasskeyServerAppCreateOptions) {
  const app = new Hono<PasskeyServerEnv>()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({ database: options.database })
  const strongMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    minimumAssurance: "multi_factor",
  })

  app.post("/instances/:instanceId/passkeys/registration/start", protectedMiddleware, async (context) => {
    const body = await passkeyJsonRead(context)
    const input = body.success
      ? v.safeParse(passkeyRegistrationStartRequestSchema, body.data)
      : v.safeParse(passkeyRegistrationStartRequestSchema, {})
    if (!input.success)
      return passkeyErrorResponseCreate(context, "The passkey registration request is invalid.", "bad_request")
    return passkeyResultResponseCreate(
      context,
      await passkeyRegistrationStart({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        instanceId: context.req.param("instanceId"),
        origins: options.origins,
        rpId: options.rpId,
        rpName: options.rpName,
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.post("/instances/:instanceId/passkeys/registration/complete", protectedMiddleware, async (context) => {
    const body = await passkeyJsonRead(context)
    if (!body.success) return passkeyErrorResponseCreate(context, body.errorMessage, "bad_request")
    const input = v.safeParse(passkeyRegistrationCompleteRequestSchema, body.data)
    if (!input.success)
      return passkeyErrorResponseCreate(context, "The passkey registration response is invalid.", "bad_request")
    return passkeyResultResponseCreate(
      context,
      await passkeyRegistrationComplete({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        origins: options.origins,
        rpId: options.rpId,
        rpName: options.rpName,
        runtime: options.database.runtime,
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.post("/instances/:instanceId/passkeys/authentication/start", async (context) => {
    const body = await passkeyJsonRead(context)
    const input = body.success
      ? v.safeParse(passkeyAuthenticationStartRequestSchema, body.data)
      : v.safeParse(passkeyAuthenticationStartRequestSchema, {})
    if (!input.success)
      return passkeyErrorResponseCreate(context, "The passkey authentication request is invalid.", "bad_request")
    return passkeyResultResponseCreate(
      context,
      await passkeyAuthenticationStart({
        database: options.database,
        instanceId: context.req.param("instanceId"),
        organizationId: input.output.organizationId,
        origins: options.origins,
        purpose: "passwordless",
        rpId: options.rpId,
        rpName: options.rpName,
      }),
    )
  })

  app.post("/instances/:instanceId/passkeys/authentication/complete", async (context) => {
    const body = await passkeyJsonRead(context)
    if (!body.success) return passkeyErrorResponseCreate(context, body.errorMessage, "bad_request")
    const input = v.safeParse(passkeyAuthenticationCompleteRequestSchema, body.data)
    if (!input.success)
      return passkeyErrorResponseCreate(context, "The passkey authentication response is invalid.", "bad_request")
    return passkeyResultResponseCreate(
      context,
      await passkeyAuthenticationComplete({
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        origins: options.origins,
        rpId: options.rpId,
        rpName: options.rpName,
      }),
    )
  })

  app.post("/instances/:instanceId/passkeys/mfa/start", protectedMiddleware, (context) =>
    passkeyResultResponseCreate(
      context,
      passkeyAuthenticationStart({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        instanceId: context.req.param("instanceId"),
        origins: options.origins,
        purpose: "mfa",
        rpId: options.rpId,
        rpName: options.rpName,
        sessionId: context.get("session").id,
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.post("/instances/:instanceId/passkeys/mfa/complete", protectedMiddleware, async (context) =>
    passkeyAuthenticationCompleteRoute(context, options, "mfa"),
  )

  app.post("/instances/:instanceId/passkeys/step-up/start", protectedMiddleware, (context) =>
    passkeyResultResponseCreate(
      context,
      passkeyAuthenticationStart({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        instanceId: context.req.param("instanceId"),
        origins: options.origins,
        purpose: "step_up",
        rpId: options.rpId,
        rpName: options.rpName,
        sessionId: context.get("session").id,
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.post("/instances/:instanceId/passkeys/step-up/complete", protectedMiddleware, async (context) =>
    passkeyAuthenticationCompleteRoute(context, options, "step_up"),
  )

  app.get("/instances/:instanceId/passkeys", protectedMiddleware, (context) =>
    passkeyResultResponseCreate(
      context,
      passkeyCredentialList({
        database: options.database,
        instanceId: context.req.param("instanceId"),
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.delete("/instances/:instanceId/passkeys", strongMiddleware, async (context) => {
    const body = await passkeyJsonRead(context)
    if (!body.success) return passkeyErrorResponseCreate(context, body.errorMessage, "bad_request")
    const input = v.safeParse(passkeyCredentialRevokeRequestSchema, body.data)
    if (!input.success) return passkeyErrorResponseCreate(context, "The passkey credential is invalid.", "bad_request")
    return passkeyResultResponseCreate(
      context,
      passkeyCredentialRevoke({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  return app
}

async function passkeyAuthenticationCompleteRoute(
  context: PasskeyRouteContext,
  options: PasskeyServerAppCreateOptions,
  purpose: "mfa" | "step_up",
) {
  const body = await passkeyJsonRead(context)
  if (!body.success) return passkeyErrorResponseCreate(context, body.errorMessage, "bad_request")
  const input = v.safeParse(passkeyAuthenticationCompleteRequestSchema, body.data)
  if (!input.success)
    return passkeyErrorResponseCreate(context, "The passkey authentication response is invalid.", "bad_request")
  return passkeyResultResponseCreate(
    context,
    await passkeyAuthenticationComplete({
      actorId: context.get("authorizationActor").actorId,
      database: options.database,
      input: input.output,
      instanceId: context.req.param("instanceId"),
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

function passkeyErrorResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  message: string,
  code: string,
) {
  return context.json(httpErrorResponseCreate(code, message), httpErrorStatusGet(code) as ContentfulStatusCode)
}

function passkeyResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result:
    | { data?: T; errorMessage?: string; success: boolean }
    | Promise<{ data?: T; errorMessage?: string; success: boolean }>,
) {
  return Promise.resolve(result).then((resolved) => {
    if (!resolved.success)
      return passkeyErrorResponseCreate(context, resolved.errorMessage ?? "The passkey request failed.", "bad_request")
    return context.json(resolved.data)
  })
}
