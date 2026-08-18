import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { sessionList } from "../actions/sessionList.js"
import { sessionRecentList } from "../actions/sessionRecentList.js"
import { sessionRevoke } from "../actions/sessionRevoke.js"
import { sessionRevokeAll } from "../actions/sessionRevokeAll.js"
import { sessionRotate } from "../actions/sessionRotate.js"
import { sessionProtectedMiddlewareCreate } from "./sessionProtectedMiddlewareCreate.js"
import { sessionRevokeAllRequestSchema } from "../public/sessionRevokeAllRequestSchema.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { Session } from "../public/sessionSchema.js"

type SessionServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    session: Session
  }
}

type SessionServerAppCreateOptions = {
  readonly database: StorageDatabase
}

export function sessionServerAppCreate(options: SessionServerAppCreateOptions) {
  const app = new Hono<SessionServerEnv>()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({ database: options.database })

  app.get("/realms/:realmId/sessions/current", protectedMiddleware, (context) =>
    sessionResultResponseCreate(context, {
      data: { session: context.get("session") },
      success: true,
    }),
  )

  app.get("/realms/:realmId/sessions", protectedMiddleware, (context) =>
    sessionResultResponseCreate(
      context,
      sessionList({
        currentSessionId: context.get("session").id,
        database: options.database,
        realmId: context.req.param("realmId"),
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.get("/realms/:realmId/sessions/recent", protectedMiddleware, (context) =>
    sessionResultResponseCreate(
      context,
      sessionRecentList({
        currentSessionId: context.get("session").id,
        database: options.database,
        realmId: context.req.param("realmId"),
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.post("/realms/:realmId/sessions/rotate", protectedMiddleware, (context) =>
    sessionResultResponseCreate(
      context,
      sessionRotate({
        database: options.database,
        realmId: context.req.param("realmId"),
        token: sessionBearerTokenGet(context.req.header("authorization")),
      }),
    ),
  )

  app.delete("/realms/:realmId/sessions/:sessionId", protectedMiddleware, (context) =>
    sessionResultResponseCreate(
      context,
      sessionRevoke({
        database: options.database,
        realmId: context.req.param("realmId"),
        sessionId: context.req.param("sessionId"),
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.delete("/realms/:realmId/sessions", protectedMiddleware, async (context) => {
    const body = await sessionRevokeAllBodyRead(context)
    if (!body.success) return sessionErrorResponseCreate(context, body.errorMessage, "bad_request")
    return sessionResultResponseCreate(
      context,
      sessionRevokeAll({
        database: options.database,
        exceptSessionId: body.data.keepCurrent ? context.get("session").id : undefined,
        realmId: context.req.param("realmId"),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.get("/realms/:realmId/protected", protectedMiddleware, (context) =>
    context.json({ actor: context.get("authorizationActor"), session: context.get("session") }),
  )

  return app
}

function sessionBearerTokenGet(authorization: string | undefined): string {
  if (authorization === undefined) return ""
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? ""
}

async function sessionRevokeAllBodyRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    const raw = await context.req.json<unknown>()
    const parsed = v.safeParse(sessionRevokeAllRequestSchema, raw)
    if (!parsed.success) return { errorMessage: "The session revocation request is invalid.", success: false as const }
    return { data: parsed.output, success: true as const }
  } catch (_error) {
    return { data: {}, success: true as const }
  }
}

function sessionErrorResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  message: string,
  code: string,
) {
  return context.json(httpErrorResponseCreate(code, message), httpErrorStatusGet(code) as ContentfulStatusCode)
}

function sessionResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; op?: string; success: boolean },
  status = 200,
) {
  if (!result.success)
    return sessionErrorResponseCreate(context, result.errorMessage ?? "The session request failed.", "bad_request")
  return context.json(result.data, status as ContentfulStatusCode)
}
