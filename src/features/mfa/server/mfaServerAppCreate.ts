import { Hono } from "hono"
import * as v from "valibot"
import type { Result } from "#result"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionAuthenticate } from "../../sessions/actions/sessionAuthenticate.js"
import { sessionBrowserCookieTokenGet } from "../../sessions/domain/sessionBrowserCookieTokenGet.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { sessionBrowserCredentialResponseCreate } from "../../sessions/server/sessionBrowserCredentialResponseCreate.js"
import { sessionBrowserModeRequested } from "../../sessions/server/sessionBrowserModeRequested.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import { mfaChallengeComplete } from "../actions/mfaChallengeComplete.js"
import { mfaChallengeFactorSelect } from "../actions/mfaChallengeFactorSelect.js"
import { mfaEmailOtpStart } from "../actions/mfaEmailOtpStart.js"
import { mfaPolicyGet } from "../actions/mfaPolicyGet.js"
import { mfaPolicySet } from "../actions/mfaPolicySet.js"
import { mfaRecoveryCodesGenerate } from "../actions/mfaRecoveryCodesGenerate.js"
import { mfaRecoveryCodeVerify } from "../actions/mfaRecoveryCodeVerify.js"
import { mfaStepUpComplete } from "../actions/mfaStepUpComplete.js"
import { mfaStepUpStart } from "../actions/mfaStepUpStart.js"
import { mfaTotpEnrollmentConfirm } from "../actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentRemove } from "../actions/mfaTotpEnrollmentRemove.js"
import { mfaTotpEnrollmentStart } from "../actions/mfaTotpEnrollmentStart.js"
import { mfaTotpVerify } from "../actions/mfaTotpVerify.js"
import { mfaChallengeCompleteRequestSchema } from "../public/mfaChallengeCompleteRequestSchema.js"
import { mfaChallengeFactorSelectRequestSchema } from "../public/mfaChallengeFactorSelectRequestSchema.js"
import type { MfaEmailOtpDelivery } from "../public/mfaEmailOtpDeliverySchema.js"
import { mfaEmailOtpStartRequestSchema } from "../public/mfaEmailOtpStartRequestSchema.js"
import { mfaPolicySetRequestSchema } from "../public/mfaPolicySetRequestSchema.js"
import { mfaTotpEnrollmentConfirmRequestSchema } from "../public/mfaTotpEnrollmentConfirmRequestSchema.js"
import { mfaTotpEnrollmentStartRequestSchema } from "../public/mfaTotpEnrollmentStartRequestSchema.js"
import { mfaTotpEnrollmentRemoveRequestSchema } from "../public/mfaTotpEnrollmentRemoveRequestSchema.js"

type MfaServerAppCreateOptions = {
  readonly browserMode?: boolean
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
  readonly encryptionSecret?: Secret | string
  readonly publicOrigin?: string
  readonly onEmailOtpDelivery?: (delivery: MfaEmailOtpDelivery) => void | Promise<void>
}

type MfaServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    cookieAuthenticated: boolean
    session: Session
  }
}

export function mfaServerAppCreate(options: MfaServerAppCreateOptions) {
  const app = new Hono<MfaServerEnv>()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    publicOrigin: options.publicOrigin,
  })
  const policyWriteMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    minimumAssurance: "multi_factor",
    publicOrigin: options.publicOrigin,
  })
  const encryptionSecret = options.encryptionSecret ?? options.systemSecret

  app.get(
    "/realms/:realmId/mfa-policy",
    async (context, next) => {
      if (mfaSessionRequestIsAuthenticated(options.database, context)) return protectedMiddleware(context, next)
      const authorization = mfaSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
      if (!authorization.success) return mfaErrorResponseCreate(context, authorization.errorMessage, "mfa.unauthorized")
      return mfaResultResponseCreate(
        context,
        mfaPolicyGet({
          context: realmSystemContextCreate("system"),
          database: options.database,
          realmId: context.req.param("realmId"),
        }),
      )
    },
    (context) => {
      const authorized = realmAdministratorContextAuthorize({
        actor: context.get("authorizationActor"),
        database: options.database,
        permission: authorizationPermissionDefinitions.realmRead,
        realmId: context.req.param("realmId"),
      })
      if (!authorized.success) return mfaErrorResponseCreate(context, authorized.errorMessage, authorized.code)
      return mfaResultResponseCreate(
        context,
        mfaPolicyGet({
          context: realmSystemContextCreate(authorized.data.actorId),
          database: options.database,
          realmId: context.req.param("realmId"),
        }),
      )
    },
  )

  app.get("/system/realms/:realmId/mfa-policy", (context) => {
    const authorization = mfaSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return mfaErrorResponseCreate(context, authorization.errorMessage, "mfa.unauthorized")
    return mfaResultResponseCreate(
      context,
      mfaPolicyGet({
        context: realmSystemContextCreate("system"),
        database: options.database,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.patch("/system/realms/:realmId/mfa-policy", async (context) => {
    const authorization = mfaSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return mfaErrorResponseCreate(context, authorization.errorMessage, "mfa.unauthorized")
    const body = await mfaJsonRead(context)
    if (!body.success) return mfaErrorResponseCreate(context, body.errorMessage, "mfa.invalid")
    const input = v.safeParse(mfaPolicySetRequestSchema, body.data)
    if (!input.success) return mfaErrorResponseCreate(context, "The MFA policy is invalid.", "mfa.invalid")
    return mfaResultResponseCreate(
      context,
      mfaPolicySet({
        context: realmSystemContextCreate("system"),
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.patch("/realms/:realmId/mfa-policy", policyWriteMiddleware, async (context) => {
    const authorized = realmAdministratorContextAuthorize({
      actor: context.get("authorizationActor"),
      database: options.database,
      minimumAssurance: "multi_factor",
      permission: authorizationPermissionDefinitions.realmWrite,
      realmId: context.req.param("realmId"),
    })
    if (!authorized.success) return mfaErrorResponseCreate(context, authorized.errorMessage, authorized.code)
    const body = await mfaJsonRead(context)
    if (!body.success) return mfaErrorResponseCreate(context, body.errorMessage, "mfa.invalid")
    const input = v.safeParse(mfaPolicySetRequestSchema, body.data)
    if (!input.success) return mfaErrorResponseCreate(context, "The MFA policy is invalid.", "mfa.invalid")
    return mfaResultResponseCreate(
      context,
      mfaPolicySet({
        context: realmSystemContextCreate(authorized.data.actorId),
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/mfa/totp/enroll", protectedMiddleware, async (context) => {
    const body = await mfaJsonRead(context)
    const input = body.success
      ? v.safeParse(mfaTotpEnrollmentStartRequestSchema, body.data)
      : v.safeParse(mfaTotpEnrollmentStartRequestSchema, {})
    if (!input.success) return mfaErrorResponseCreate(context, "The TOTP enrollment request is invalid.", "mfa.invalid")
    return mfaResultResponseCreate(
      context,
      mfaTotpEnrollmentStart({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        encryptionSecret,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.post("/realms/:realmId/mfa/totp/confirm", protectedMiddleware, async (context) => {
    const body = await mfaJsonRead(context)
    if (!body.success) return mfaErrorResponseCreate(context, body.errorMessage, "mfa.invalid")
    const input = v.safeParse(mfaTotpEnrollmentConfirmRequestSchema, body.data)
    if (!input.success)
      return mfaErrorResponseCreate(context, "The TOTP confirmation request is invalid.", "mfa.invalid")
    return mfaResultResponseCreate(
      context,
      mfaTotpEnrollmentConfirm({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        encryptionSecret,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.delete("/realms/:realmId/mfa/totp", protectedMiddleware, async (context) => {
    const body = await mfaJsonRead(context)
    const input = v.safeParse(mfaTotpEnrollmentRemoveRequestSchema, body.success ? body.data : {})
    if (!input.success) return mfaErrorResponseCreate(context, "The TOTP removal request is invalid.", "mfa.invalid")
    return mfaResultResponseCreate(
      context,
      mfaTotpEnrollmentRemove({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        enrollmentId: input.output.enrollmentId,
        realmId: context.req.param("realmId"),
        sessionToken: mfaSessionTokenGet(context, sessionBrowserModeRequested(context, options.browserMode)),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.post("/realms/:realmId/mfa/totp/verify", protectedMiddleware, async (context) => {
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
        realmId: context.req.param("realmId"),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.post("/realms/:realmId/mfa/recovery-codes", protectedMiddleware, (context) =>
    mfaResultResponseCreate(
      context,
      mfaRecoveryCodesGenerate({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        realmId: context.req.param("realmId"),
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.post("/realms/:realmId/mfa/recovery-codes/verify", protectedMiddleware, async (context) => {
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
        realmId: context.req.param("realmId"),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.post("/realms/:realmId/mfa/step-up/start", protectedMiddleware, (context) =>
    mfaResultResponseCreate(
      context,
      mfaStepUpStart({
        actorId: context.get("authorizationActor").actorId,
        database: options.database,
        realmId: context.req.param("realmId"),
        sessionId: context.get("session").id,
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.post("/realms/:realmId/mfa/step-up/complete", protectedMiddleware, async (context) => {
    const body = await mfaJsonRead(context)
    if (!body.success) return mfaErrorResponseCreate(context, body.errorMessage, "mfa.invalid")
    const input = v.safeParse(mfaChallengeCompleteRequestSchema, body.data)
    if (!input.success) return mfaErrorResponseCreate(context, "The MFA code is invalid.", "mfa.invalid")
    const completed = mfaStepUpComplete({
      actorId: context.get("authorizationActor").actorId,
      database: options.database,
      encryptionSecret,
      input: input.output,
      realmId: context.req.param("realmId"),
      sessionToken: mfaSessionTokenGet(context, sessionBrowserModeRequested(context, options.browserMode)),
    })
    return mfaResultResponseCreate(
      context,
      sessionBrowserModeRequested(context, options.browserMode)
        ? sessionBrowserCredentialResponseCreate(context, completed)
        : completed,
    )
  })

  app.post("/realms/:realmId/mfa/challenge/complete", async (context) => {
    const body = await mfaJsonRead(context)
    if (!body.success) return mfaErrorResponseCreate(context, body.errorMessage, "mfa.invalid")
    const input = v.safeParse(mfaChallengeCompleteRequestSchema, body.data)
    if (!input.success) return mfaErrorResponseCreate(context, "The MFA code is invalid.", "mfa.invalid")
    const completed = mfaChallengeComplete({
      database: options.database,
      encryptionSecret,
      input: input.output,
      realmId: context.req.param("realmId"),
    })
    return mfaResultResponseCreate(
      context,
      sessionBrowserModeRequested(context, options.browserMode)
        ? sessionBrowserCredentialResponseCreate(context, completed)
        : completed,
    )
  })

  app.post("/realms/:realmId/mfa/challenge/factor", async (context) => {
    const body = await mfaJsonRead(context)
    if (!body.success) return mfaErrorResponseCreate(context, body.errorMessage, "mfa.invalid")
    const input = v.safeParse(mfaChallengeFactorSelectRequestSchema, body.data)
    if (!input.success) return mfaErrorResponseCreate(context, "The MFA factor selection is invalid.", "mfa.invalid")
    return mfaResultResponseCreate(
      context,
      mfaChallengeFactorSelect({
        database: options.database,
        factor: input.output.factor,
        realmId: context.req.param("realmId"),
        token: input.output.token,
      }),
    )
  })

  app.post("/realms/:realmId/mfa/challenge/email-otp/start", async (context) => {
    const body = await mfaJsonRead(context)
    if (!body.success) return mfaErrorResponseCreate(context, body.errorMessage, "mfa.invalid")
    const input = v.safeParse(mfaEmailOtpStartRequestSchema, body.data)
    if (!input.success) return mfaErrorResponseCreate(context, "The MFA email OTP request is invalid.", "mfa.invalid")
    return mfaResultResponseCreate(
      context,
      mfaEmailOtpStart({
        challengeToken: input.output.token,
        database: options.database,
        onDelivery: options.onEmailOtpDelivery,
        realmId: context.req.param("realmId"),
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

function mfaSessionTokenGet(context: MfaRouteContext, browserMode: boolean): string {
  const bearer = mfaBearerTokenGet(context.req.header("authorization"))
  if (bearer.length > 0 || !browserMode || !context.get("cookieAuthenticated")) return bearer
  return sessionBrowserCookieTokenGet(context.req.header("cookie"))
}

function mfaSessionRequestIsAuthenticated(
  database: StorageDatabase,
  context: { req: { header: (name: string) => string | undefined; param: (name: string) => string } },
): boolean {
  const authorization = context.req.header("authorization")
  if (authorization !== undefined) {
    const token = /^Bearer (.+)$/.exec(authorization)?.[1]
    return token === undefined
      ? false
      : sessionAuthenticate({ database, realmId: context.req.param("realmId"), token }).success
  }
  return /(?:^|;)\s*session=[^;]+/.test(context.req.header("cookie") ?? "")
}

function mfaSystemAuthorizationGet(authorization: string | undefined, configuredSecret?: Secret | string) {
  const token = mfaBearerTokenGet(authorization)
  if (configuredSecret === undefined || token.length === 0 || !secretMatches(token, configuredSecret))
    return { errorMessage: "System authorization is required.", success: false as const }
  return { success: true as const }
}

function mfaErrorResponseCreate(context: MfaRouteContext, message: string, code = "mfa.invalid") {
  return httpResultResponseCreate(context, {
    code,
    errorMessage: message,
    op: "mfaServerRequest",
    success: false,
  } as Result<unknown>)
}

function mfaResultResponseCreate<T>(
  context: MfaRouteContext,
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
) {
  if (!result.success)
    return httpResultResponseCreate(context, { ...result, code: result.code ?? "mfa.invalid" } as Result<unknown>)
  return httpResultResponseCreate(context, result as Result<T>)
}

type MfaRouteContext = {
  readonly get: {
    (key: "authorizationActor"): AuthorizationActorContext
    (key: "cookieAuthenticated"): boolean
  }
  readonly header: (name: string, value: string) => void
  readonly json: (body: unknown, status?: number) => Response
  readonly req: { readonly header: (name: string) => string | undefined }
}
