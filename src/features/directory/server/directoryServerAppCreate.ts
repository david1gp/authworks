import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import type { Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { organizationContextAuthorize } from "../../organizations/actions/organizationContextAuthorize.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import { realmAdministratorContextAuthorize } from "../../realms/server/index.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import type { DirectoryUserListQuery } from "../public/directoryUserListSchema.js"
import { directoryUserListQuerySchema } from "../public/directoryUserListSchema.js"
import { directoryOrganizationUserList } from "./directoryOrganizationUserList.js"
import { directoryOrganizationUserSummary } from "./directoryOrganizationUserSummary.js"
import { directoryRealmUserList } from "./directoryRealmUserList.js"
import { directoryUserAccess } from "./directoryUserAccess.js"

type DirectoryServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly publicOrigin?: string
}

type DirectoryServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    cookieAuthenticated: boolean
    session: Session
  }
}

export function directoryServerAppCreate(options: DirectoryServerAppCreateOptions) {
  const app = new Hono<DirectoryServerEnv>()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    publicOrigin: options.publicOrigin,
  })

  app.get("/realms/:realmId/organizations/:organizationId/users", protectedMiddleware, (context) => {
    const realmId = context.req.param("realmId")
    const organizationId = context.req.param("organizationId")
    const actor = context.get("authorizationActor")
    if (actor.realmId !== realmId)
      return directoryErrorResponseCreate(context, {
        code: "directory.forbidden",
        errorMessage: "The actor is not available in this tenant context.",
        op: "directoryOrganizationUserAuthorize",
      })
    const repository = organizationRepositoryCreate(options.database.db)
    const organization = repository.organizationGet(organizationId)
    if (!organization.success) return directoryErrorResponseCreate(context, organization)
    if (organization.data === null || organization.data.realmId !== realmId || organization.data.status !== "active")
      return directoryErrorResponseCreate(context, {
        code: "directory.not-found",
        errorMessage: "The organization was not found.",
        op: "directoryOrganizationUserList",
      })
    const systemShaped = directorySystemContextShape(actor, realmId)
    const membershipLookup =
      actor.kind === "user" ? unwrapMembership(repository, organizationId, actor.actorId) : undefined
    const authorized = organizationContextAuthorize({
      context: systemShaped,
      database: options.database,
      membership: membershipLookup,
      organization: organization.data,
      repository,
      requiredPermission: "user.read",
    })
    if (!authorized.success) return directoryErrorResponseCreate(context, authorized)
    const query = directoryListQueryRead(context.req.url)
    if (!query.success) return directoryErrorResponseCreate(context, query)
    const administrator = directoryRealmAdministratorCheck(options.database, realmId, actor)
    if (!administrator.success) return directoryErrorResponseCreate(context, administrator)
    return directoryResultResponseCreate(
      context,
      directoryOrganizationUserList({
        context: directorySystemContextShape(actor, realmId),
        database: options.database,
        includeOtherMemberships: administrator.data,
        organizationId,
        organizationName: organization.data.name,
        query: query.data,
        realmId,
      }),
    )
  })

  app.get("/realms/:realmId/organizations/:organizationId/users/summary", protectedMiddleware, (context) => {
    const realmId = context.req.param("realmId")
    const organizationId = context.req.param("organizationId")
    const actor = context.get("authorizationActor")
    if (actor.realmId !== realmId)
      return directoryErrorResponseCreate(context, {
        code: "directory.forbidden",
        errorMessage: "The actor is not available in this tenant context.",
        op: "directoryOrganizationUserAuthorize",
      })
    const repository = organizationRepositoryCreate(options.database.db)
    const organization = repository.organizationGet(organizationId)
    if (!organization.success) return directoryErrorResponseCreate(context, organization)
    if (organization.data === null || organization.data.realmId !== realmId || organization.data.status !== "active")
      return directoryErrorResponseCreate(context, {
        code: "directory.not-found",
        errorMessage: "The organization was not found.",
        op: "directoryOrganizationUserSummary",
      })
    const authorized = organizationContextAuthorize({
      context: directorySystemContextShape(actor, realmId),
      database: options.database,
      membership: actor.kind === "user" ? unwrapMembership(repository, organizationId, actor.actorId) : undefined,
      organization: organization.data,
      repository,
      requiredPermission: "user.read",
    })
    if (!authorized.success) return directoryErrorResponseCreate(context, authorized)
    return directoryResultResponseCreate(
      context,
      directoryOrganizationUserSummary({ database: options.database, organizationId, realmId }),
    )
  })

  app.get("/realms/:realmId/directory/users", protectedMiddleware, (context) => {
    const realmId = context.req.param("realmId")
    const authorized = realmAdministratorContextAuthorize({
      actor: context.get("authorizationActor"),
      database: options.database,
      permission: authorizationPermissionDefinitions.userRead,
      realmId,
    })
    if (!authorized.success) return directoryErrorResponseCreate(context, authorized)
    const query = directoryListQueryRead(context.req.url)
    if (!query.success) return directoryErrorResponseCreate(context, query)
    return directoryResultResponseCreate(
      context,
      directoryRealmUserList({ context: authorized.data, database: options.database, query: query.data, realmId }),
    )
  })

  app.get("/realms/:realmId/users/:userId/access", protectedMiddleware, (context) => {
    const realmId = context.req.param("realmId")
    const targetUserId = context.req.param("userId")
    const authorized = realmAdministratorContextAuthorize({
      actor: context.get("authorizationActor"),
      database: options.database,
      permission: authorizationPermissionDefinitions.userRead,
      realmId,
      targetUserId,
    })
    if (!authorized.success) return directoryErrorResponseCreate(context, authorized)
    return directoryResultResponseCreate(
      context,
      directoryUserAccess({
        context: authorized.data,
        database: options.database,
        realmId,
        targetUserId,
      }),
    )
  })

  return app
}

function directorySystemContextShape(
  actor: AuthorizationActorContext,
  realmId: string,
): RealmTenantContext & { kind: "tenant" } {
  return { actor, actorId: actor.actorId, kind: "tenant", realmId }
}

function directoryRealmAdministratorCheck(
  database: StorageDatabase,
  realmId: string,
  actor: AuthorizationActorContext,
): Result<boolean> {
  if (actor.kind !== "user") return { data: actor.kind === "bootstrap_admin", success: true }
  const authorized = realmAdministratorContextAuthorize({
    actor,
    database,
    permission: authorizationPermissionDefinitions.realmRead,
    realmId,
  })
  if (authorized.success) return { data: true, success: true }
  return { data: false, success: true }
}

function directoryListQueryRead(requestUrl: string): Result<DirectoryUserListQuery> {
  const searchParams = new URL(requestUrl).searchParams
  const roleParam = searchParams.get("role")
  const parsed = listQueryFromSearchParams(searchParams)
  if (!parsed.success)
    return resultErrorCodedCreate("directoryListQueryRead", "The directory list query is invalid.", "directory.invalid")
  const query = v.safeParse(directoryUserListQuerySchema, {
    ...parsed.data,
    ...(roleParam === null ? {} : { role: roleParam }),
  })
  if (!query.success)
    return resultErrorCodedCreate("directoryListQueryRead", "The directory list query is invalid.", "directory.invalid")
  return resultErrorCheckedCreate(query.output)
}

function resultErrorCheckedCreate(output: DirectoryUserListQuery): Result<DirectoryUserListQuery> {
  return { data: output, success: true }
}

function unwrapMembership(
  repository: ReturnType<typeof organizationRepositoryCreate>,
  organizationId: string,
  userId: string,
) {
  const membership = repository.organizationMembershipGetByOrganizationUser(organizationId, userId)
  if (!membership.success || membership.data === null) return null
  return membership.data
}

function directoryErrorResponseCreate(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  return httpResultResponseCreate(context, {
    ...result,
    code: result.code ?? "directory.invalid",
    success: false,
  } as Result<unknown>)
}

function directoryResultResponseCreate<T>(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
  lastModified?: Date,
) {
  if (!result.success)
    return directoryErrorResponseCreate(
      context,
      result as { errorMessage: string; op: string; code?: string; success: false },
    )
  return httpResultResponseCreate(context, result as Result<T>, status, lastModified)
}
