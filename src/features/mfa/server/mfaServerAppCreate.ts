import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import { instanceSystemContextCreate } from "../../instances/domain/instanceSystemContextCreate.js"
import { mfaChallengeComplete } from "../actions/mfaChallengeComplete.js"
import { mfaLoginChallengeStart } from "../actions/mfaLoginChallengeStart.js"
import { mfaPolicyGet } from "../actions/mfaPolicyGet.js"
import { mfaPolicySet } from "../actions/mfaPolicySet.js"
import { mfaRecoveryCodeVerify } from "../actions/mfaRecoveryCodeVerify.js"
import { mfaRecoveryCodesGenerate } from "../actions/mfaRecoveryCodesGenerate.js"
import { mfaStepUpComplete } from "../actions/mfaStepUpComplete.js"
import { mfaStepUpStart } from "../actions/mfaStepUpStart.js"
import { mfaTotpEnrollmentConfirm } from "../actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentRemove } from "../actions/mfaTotpEnrollmentRemove.js"
import { mfaTotpEnrollmentStart } from "../actions/mfaTotpEnrollmentStart.js"
import { mfaTotpVerify } from "../actions/mfaTotpVerify.js"
import { mfaChallengeCompleteRequestSchema } from "../public/mfaChallengeCompleteRequestSchema.js"
import { mfaPolicySetRequestSchema } from "../public/mfaPolicySetRequestSchema.js"
import { mfaTotpEnrollmentConfirmRequestSchema } from "../public/mfaTotpEnrollmentConfirmRequestSchema.js"
import { mfaTotpEnrollmentStartRequestSchema } from "../public/mfaTotpEnrollmentStartRequestSchema.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"

type MfaServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
  readonly encryptionSecret?: Secret | string
}

type MfaServerEnv = {
  Variables: {
    authorizationActor: { actorId: string }
    session: { id: string }
  }
}

export function mfaServerAppCreate(options: MfaServerAppCreateOptions) {
  const app = new Hono<MfaServerEnv>()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({ database: options.database })
  const encryptionSecret = options.encryptionSecret ?? options.systemSecret

  app.get("/instances/:instanceId/mfa-policy", (context) => {
    const authorization = mfaSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return mfaErrorResponseCreate(context, authorization.errorMessage, "unauthorized")
    return mfaResultResponseCreate(
      context,
      mfaPolicyGet({
        context: instanceSystemContextCreate("system"),
        database: options.database,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  app.patch("/system/instances/:instanceId/mfa-policy", async (context) => {
    const authorization = mfaSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return mfaErrorResponseCreate(context, authorization.errorMessage, "unauthorized")
    const body = await mfaJsonRead(context)
    if (!body.success) return mfaErrorResponseCreate(context, body.errorMessage, "bad_request")
    const input = v.safeParse(mfaPolicySetRequestSchema, body.data)
    if (!input.success) return mfaErrorResponseCreate(context, "The MFA policy is invalid.", "bad_request")
    return mfaResultResponseCreate(
      context,
      mfaPolicySet({
        context: instanceSystemContextCreate("system"),
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  app.post("/instances/:instanceId/mfa/totp/enroll", protectedMiddleware, async (context) => {
    const body = await mfaJsonRead(context)
    const input = body.success
      ? v.safeParse(mfaTotpEnrollmentStartRequestSchema, body.data)
      : v.safeParse(mfaTotpEnrollmentStartRequestSchema, {})
    if (!input.success) return mfaErrorResponseCreate(context, "The TOTP enrollment request is invalid.", "bad_request")
    return mfaResultResponseCreate(
      context,
      mfaTotpEnrollmentStart({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        encryptionSecret,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.post("/instances/:instanceId/mfa/totp/confirm", protectedMiddleware, async (context) => {
    const body = await mfaJsonRead(context)
    if (!body.success) return mfaErrorResponseCreate(context, body.errorMessage, "bad_request")
    const input = v.safeParse(mfaTotpEnrollmentConfirmRequestSchema, body.data)
    if (!input.success)
      return mfaErrorResponseCreate(context, "The TOTP confirmation request is invalid.", "bad_request")
    return mfaResultResponseCreate(
      context,
      mfaTotpEnrollmentConfirm({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        encryptionSecret,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.delete("/instances/:instanceId/mfa/totp", protectedMiddleware, (context) =>
    mfaResultResponseCreate(
      context,
      mfaTotpEnrollmentRemove({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        instanceId: context.req.param("instanceId"),
        sessionToken: mfaBearerTokenGet(context.req.header("authorization")),
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.post("/instances/:instanceId/mfa/totp/verify", protectedMiddleware, async (context) => {
    const body = await mfaJsonRead(context)
    const code =
      body.success && typeof body.data === "object" && body.data !== null && "code" in body.data
        ? String(body.data.code)
        : ""
    return mfaResultResponseCreate(
      context,
      mfaTotpVerify({
        actorId: context.get("authorizationActor").actorId,
        code,
        database: options.database,
        encryptionSecret,
        instanceId: context.req.param("instanceId"),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.post("/instances/:instanceId/mfa/recovery-codes", protectedMiddleware, (context) =>
    mfaResultResponseCreate(
      context,
      mfaRecoveryCodesGenerate({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        instanceId: context.req.param("instanceId"),
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.post("/instances/:instanceId/mfa/recovery-codes/verify", protectedMiddleware, async (context) => {
    const body = await mfaJsonRead(context)
    const code =
      body.success && typeof body.data === "object" && body.data !== null && "code" in body.data
        ? String(body.data.code)
        : ""
    return mfaResultResponseCreate(
      context,
      mfaRecoveryCodeVerify({
        actorId: context.get("authorizationActor").actorId,
        code,
        database: options.database,
        instanceId: context.req.param("instanceId"),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.post("/instances/:instanceId/mfa/step-up/start", protectedMiddleware, (context) =>
    mfaResultResponseCreate(
      context,
      mfaStepUpStart({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        instanceId: context.req.param("instanceId"),
        sessionId: context.get("session").id,
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.post("/instances/:instanceId/mfa/step-up/complete", protectedMiddleware, async (context) => {
    const body = await mfaJsonRead(context)
    if (!body.success) return mfaErrorResponseCreate(context, body.errorMessage, "bad_request")
    const input = v.safeParse(mfaChallengeCompleteRequestSchema, body.data)
    if (!input.success) return mfaErrorResponseCreate(context, "The MFA code is invalid.", "bad_request")
    return mfaResultResponseCreate(
      context,
      mfaStepUpComplete({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        encryptionSecret,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        sessionToken: mfaBearerTokenGet(context.req.header("authorization")),
      }),
    )
  })

  app.post("/instances/:instanceId/mfa/challenge/complete", async (context) => {
    const body = await mfaJsonRead(context)
    if (!body.success) return mfaErrorResponseCreate(context, body.errorMessage, "bad_request")
    const input = v.safeParse(mfaChallengeCompleteRequestSchema, body.data)
    if (!input.success) return mfaErrorResponseCreate(context, "The MFA code is invalid.", "bad_request")
    return mfaResultResponseCreate(
      context,
      mfaChallengeComplete({
        database: options.database,
        encryptionSecret,
        input: input.output,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  return app
}

async function mfaJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return { errorMessage: "The request body is invalid.", success: false as const }
  }
}

function mfaBearerTokenGet(authorization: string | undefined): string {
  if (authorization === undefined) return ""
  return /^Bearer (.+)$/.exec(authorization)?.[1] ?? ""
}

function mfaSystemAuthorizationGet(authorization: string | undefined, configuredSecret?: Secret | string) {
  const token = mfaBearerTokenGet(authorization)
  if (configuredSecret === undefined || token.length === 0 || !secretMatches(token, configuredSecret))
    return { errorMessage: "System authorization is required.", success: false as const }
  return { success: true as const }
}

function mfaErrorResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  message: string,
  code: string,
) {
  return context.json(httpErrorResponseCreate(code, message), httpErrorStatusGet(code) as ContentfulStatusCode)
}

function mfaResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; success: boolean },
) {
  if (!result.success)
    return mfaErrorResponseCreate(context, result.errorMessage ?? "The MFA request failed.", "bad_request")
  return context.json(result.data)
}
