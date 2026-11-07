import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import { teamCreate } from "../actions/teamCreate.js"
import { teamDelete } from "../actions/teamDelete.js"
import { teamGet } from "../actions/teamGet.js"
import { teamList } from "../actions/teamList.js"
import { teamMemberAssign } from "../actions/teamMemberAssign.js"
import { teamMemberUnassign } from "../actions/teamMemberUnassign.js"
import { teamUpdate } from "../actions/teamUpdate.js"
import { teamCreateRequestSchema } from "../public/teamCreateRequestSchema.js"
import { teamMemberAssignRequestSchema } from "../public/teamMemberAssignRequestSchema.js"
import { teamUpdateRequestSchema } from "../public/teamUpdateRequestSchema.js"

type TeamServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly publicOrigin?: string
}

type TeamServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
  }
}

export function teamServerAppCreate(options: TeamServerAppCreateOptions) {
  const app = new Hono<TeamServerEnv>()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    publicOrigin: options.publicOrigin,
  })

  app.get("/realms/:realmId/organizations/:organizationId/teams", protectedMiddleware, (context) => {
    const authenticated = teamTenantContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return teamErrorResponseCreate(context, authenticated)
    const query = teamListQueryRead(context.req.url)
    if (!query.success) return teamErrorResponseCreate(context, query)
    return teamResultResponseCreate(
      context,
      teamList({
        context: authenticated.data,
        database: options.database,
        organizationId: context.req.param("organizationId"),
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/organizations/:organizationId/teams", protectedMiddleware, async (context) => {
    const authenticated = teamTenantContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return teamErrorResponseCreate(context, authenticated)
    const body = await teamRequestJsonRead(context)
    if (!body.success) return teamErrorResponseCreate(context, body)
    const input = v.safeParse(teamCreateRequestSchema, body.data)
    if (!input.success)
      return teamErrorResponseCreate(
        context,
        resultErrorCodedCreate("teamCreate", "The team request is invalid.", "teams.invalid"),
      )
    return teamResultResponseCreate(
      context,
      teamCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.get("/realms/:realmId/organizations/:organizationId/teams/:teamRef", protectedMiddleware, (context) => {
    const authenticated = teamTenantContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return teamErrorResponseCreate(context, authenticated)
    const result = teamGet({
      context: authenticated.data,
      database: options.database,
      organizationId: context.req.param("organizationId"),
      realmId: context.req.param("realmId"),
      teamRef: context.req.param("teamRef"),
    })
    return teamResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.team.updatedAt) : undefined,
    )
  })

  app.patch("/realms/:realmId/organizations/:organizationId/teams/:teamRef", protectedMiddleware, async (context) => {
    const authenticated = teamTenantContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return teamErrorResponseCreate(context, authenticated)
    const body = await teamRequestJsonRead(context)
    if (!body.success) return teamErrorResponseCreate(context, body)
    const input = v.safeParse(teamUpdateRequestSchema, body.data)
    if (!input.success)
      return teamErrorResponseCreate(
        context,
        resultErrorCodedCreate("teamUpdate", "The team update is invalid.", "teams.invalid"),
      )
    return teamResultResponseCreate(
      context,
      teamUpdate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
        teamRef: context.req.param("teamRef"),
      }),
    )
  })

  app.delete("/realms/:realmId/organizations/:organizationId/teams/:teamRef", protectedMiddleware, (context) => {
    const authenticated = teamTenantContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return teamErrorResponseCreate(context, authenticated)
    return teamResultResponseCreate(
      context,
      teamDelete({
        context: authenticated.data,
        database: options.database,
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
        teamRef: context.req.param("teamRef"),
      }),
    )
  })

  app.post(
    "/realms/:realmId/organizations/:organizationId/teams/:teamRef/members",
    protectedMiddleware,
    async (context) => {
      const authenticated = teamTenantContextResolve(context, context.req.param("realmId"))
      if (!authenticated.success) return teamErrorResponseCreate(context, authenticated)
      const body = await teamRequestJsonRead(context)
      if (!body.success) return teamErrorResponseCreate(context, body)
      const input = v.safeParse(teamMemberAssignRequestSchema, body.data)
      if (!input.success)
        return teamErrorResponseCreate(
          context,
          resultErrorCodedCreate("teamMemberAssign", "The team member request is invalid.", "teams.invalid"),
        )
      return teamResultResponseCreate(
        context,
        teamMemberAssign({
          context: authenticated.data,
          database: options.database,
          input: input.output,
          organizationId: context.req.param("organizationId"),
          realmId: context.req.param("realmId"),
          teamRef: context.req.param("teamRef"),
        }),
        201,
      )
    },
  )

  app.delete(
    "/realms/:realmId/organizations/:organizationId/teams/:teamRef/members/:userId",
    protectedMiddleware,
    (context) => {
      const authenticated = teamTenantContextResolve(context, context.req.param("realmId"))
      if (!authenticated.success) return teamErrorResponseCreate(context, authenticated)
      return teamResultResponseCreate(
        context,
        teamMemberUnassign({
          context: authenticated.data,
          database: options.database,
          organizationId: context.req.param("organizationId"),
          realmId: context.req.param("realmId"),
          teamRef: context.req.param("teamRef"),
          userId: context.req.param("userId"),
        }),
      )
    },
  )

  return app
}

function teamTenantContextResolve(
  context: { readonly get: (key: "authorizationActor") => AuthorizationActorContext },
  realmId: string,
): Result<RealmTenantContext> {
  const actor = context.get("authorizationActor")
  if (actor.realmId !== realmId)
    return resultErrorCodedCreate(
      "teamTenantContextResolve",
      "The actor is not available in this tenant context.",
      "teams.tenant-mismatch",
    )
  if (actor.kind !== "user" && actor.kind !== "bootstrap_admin")
    return resultErrorCodedCreate(
      "teamTenantContextResolve",
      "The actor is not authorized for team administration.",
      "teams.forbidden",
    )
  return resultCreate({ actor, actorId: actor.actorId, kind: "tenant", realmId })
}

function teamListQueryRead(requestUrl: string): Result<ListQuery> {
  const parsed = listQueryFromSearchParams(new URL(requestUrl).searchParams)
  if (!parsed.success) return resultErrorCodedCreate("teamListQueryRead", "The list query is invalid.", "teams.invalid")
  return parsed
}

function teamErrorResponseCreate(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: Result<unknown>,
) {
  return httpResultResponseCreate(context, result)
}

function teamResultResponseCreate<T>(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: Result<T>,
  status = 200,
  lastModified?: Date,
) {
  return httpResultResponseCreate(context, result, status, lastModified)
}

async function teamRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return resultErrorCodedCreate("teamRequestJsonRead", "The request body is invalid.", "teams.invalid")
  }
}
