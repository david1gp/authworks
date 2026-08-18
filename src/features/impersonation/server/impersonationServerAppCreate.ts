import { Hono } from "hono"
import * as v from "valibot"
import type { Result } from "#result"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import { impersonationEnd } from "../actions/impersonationEnd.js"
import { impersonationStart } from "../actions/impersonationStart.js"
import { impersonationStartRequestSchema } from "../public/impersonationStartRequestSchema.js"
import type { ImpersonationSecurityNotification } from "../public/impersonationSecurityNotificationSchema.js"

type ImpersonationServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    session: Session
  }
}

type ImpersonationServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly onSecurityNotification?: (notification: ImpersonationSecurityNotification) => void | Promise<void>
}

export function impersonationServerAppCreate(options: ImpersonationServerAppCreateOptions) {
  const app = new Hono<ImpersonationServerEnv>()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({ database: options.database })

  app.post("/realms/:realmId/impersonations", protectedMiddleware, async (context) => {
    const body = await impersonationRequestBodyRead(context)
    if (!body.success) return impersonationErrorResponseCreate(context, body)
    const input = v.safeParse(impersonationStartRequestSchema, body.data)
    if (!input.success)
      return impersonationErrorResponseCreate(context, {
        errorMessage: "The impersonation request is invalid.",
        op: "impersonationStart",
      })
    return impersonationResultResponseCreate(
      context,
      impersonationStart({
        actor: context.get("authorizationActor"),
        database: options.database,
        durationMs: input.output.durationSeconds * 1_000,
        realmId: context.req.param("realmId"),
        onSecurityNotification: options.onSecurityNotification,
        ...(input.output.organizationId === undefined ? {} : { organizationId: input.output.organizationId }),
        reason: input.output.reason,
        targetUserId: input.output.targetUserId,
      }),
      201,
    )
  })

  app.post("/realms/:realmId/impersonations/:sessionId/end", protectedMiddleware, (context) =>
    impersonationResultResponseCreate(
      context,
      impersonationEnd({
        actor: context.get("authorizationActor"),
        database: options.database,
        realmId: context.req.param("realmId"),
        onSecurityNotification: options.onSecurityNotification,
        sessionId: context.req.param("sessionId"),
      }),
    ),
  )
  app.delete("/realms/:realmId/impersonations/:sessionId", protectedMiddleware, (context) =>
    impersonationResultResponseCreate(
      context,
      impersonationEnd({
        actor: context.get("authorizationActor"),
        database: options.database,
        realmId: context.req.param("realmId"),
        onSecurityNotification: options.onSecurityNotification,
        sessionId: context.req.param("sessionId"),
      }),
    ),
  )

  return app
}

async function impersonationRequestBodyRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return { errorMessage: "The request body is invalid.", op: "impersonationRequestBodyRead", success: false as const }
  }
}

function impersonationErrorResponseCreate(
  context: ImpersonationRouteContext,
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  return httpResultResponseCreate(context, {
    ...result,
    code: result.code ?? "impersonation.invalid",
    success: false,
  } as Result<unknown>)
}

function impersonationResultResponseCreate<T>(
  context: ImpersonationRouteContext,
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
) {
  if (!result.success)
    return impersonationErrorResponseCreate(context, {
      code: result.code,
      errorMessage: result.errorMessage ?? "The impersonation request failed.",
      op: result.op ?? "impersonation",
      success: false,
    })
  return httpResultResponseCreate(context, result as Result<T>, status)
}

type ImpersonationRouteContext = {
  readonly get: {
    (key: "authorizationActor"): AuthorizationActorContext
    (key: "session"): Session
  }
  readonly json: (body: unknown, status?: number) => Response
  readonly req: {
    readonly json: <T>() => Promise<T>
    readonly param: (name: string) => string
    readonly header: (name: string) => string | undefined
  }
}
