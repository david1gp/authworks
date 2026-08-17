import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
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

  app.post("/instances/:instanceId/impersonations", protectedMiddleware, async (context) => {
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
        instanceId: context.req.param("instanceId"),
        onSecurityNotification: options.onSecurityNotification,
        ...(input.output.organizationId === undefined ? {} : { organizationId: input.output.organizationId }),
        reason: input.output.reason,
        targetUserId: input.output.targetUserId,
      }),
      201,
    )
  })

  app.post("/instances/:instanceId/impersonations/:sessionId/end", protectedMiddleware, (context) =>
    impersonationResultResponseCreate(
      context,
      impersonationEnd({
        actor: context.get("authorizationActor"),
        database: options.database,
        instanceId: context.req.param("instanceId"),
        onSecurityNotification: options.onSecurityNotification,
        sessionId: context.req.param("sessionId"),
      }),
    ),
  )
  app.delete("/instances/:instanceId/impersonations/:sessionId", protectedMiddleware, (context) =>
    impersonationResultResponseCreate(
      context,
      impersonationEnd({
        actor: context.get("authorizationActor"),
        database: options.database,
        instanceId: context.req.param("instanceId"),
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
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { errorMessage: string; op: string },
) {
  const code = impersonationErrorCodeGet(result)
  return context.json(
    httpErrorResponseCreate(code, result.errorMessage),
    httpErrorStatusGet(code) as ContentfulStatusCode,
  )
}

function impersonationErrorCodeGet(result: { errorMessage: string; op: string }): string {
  const message = result.errorMessage.toLowerCase()
  if (message.includes("authorized") || message.includes("authentication") || message.includes("actor"))
    return "forbidden"
  if (message.includes("not found") || message.includes("not active") || message.includes("not a member"))
    return "not_found"
  if (message.includes("invalid") || message.includes("required") || message.includes("duration")) return "bad_request"
  return "internal_server_error"
}

function impersonationResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; op?: string; success: boolean },
  status = 200,
) {
  if (!result.success)
    return impersonationErrorResponseCreate(context, {
      errorMessage: result.errorMessage ?? "The impersonation request failed.",
      op: result.op ?? "impersonation",
    })
  return context.json(result.data, status as ContentfulStatusCode)
}
