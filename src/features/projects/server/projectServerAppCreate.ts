import { Hono } from "hono"
import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmBootstrapAdminAuthenticate } from "../../realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectAccessCheck } from "../actions/projectAccessCheck.js"
import { projectApplicationCreate } from "../actions/projectApplicationCreate.js"
import { projectApplicationDelete } from "../actions/projectApplicationDelete.js"
import { projectApplicationGet } from "../actions/projectApplicationGet.js"
import { projectApplicationLifecycleSet } from "../actions/projectApplicationLifecycleSet.js"
import { projectApplicationList } from "../actions/projectApplicationList.js"
import { projectApplicationUpdate } from "../actions/projectApplicationUpdate.js"
import { projectCreate } from "../actions/projectCreate.js"
import { projectDelete } from "../actions/projectDelete.js"
import { projectGet } from "../actions/projectGet.js"
import { projectGrantCreate } from "../actions/projectGrantCreate.js"
import { projectGrantDelete } from "../actions/projectGrantDelete.js"
import { projectGrantLifecycleSet } from "../actions/projectGrantLifecycleSet.js"
import { projectGrantList } from "../actions/projectGrantList.js"
import { projectGrantUpdate } from "../actions/projectGrantUpdate.js"
import { projectLifecycleSet } from "../actions/projectLifecycleSet.js"
import { projectList } from "../actions/projectList.js"
import { projectRoleCreate } from "../actions/projectRoleCreate.js"
import { projectRoleDelete } from "../actions/projectRoleDelete.js"
import { projectRoleList } from "../actions/projectRoleList.js"
import { projectRoleUpdate } from "../actions/projectRoleUpdate.js"
import { projectUpdate } from "../actions/projectUpdate.js"
import { projectApplicationCreateRequestSchema } from "../public/projectApplicationCreateRequestSchema.js"
import { projectApplicationLifecycleRequestSchema } from "../public/projectApplicationLifecycleRequestSchema.js"
import { projectApplicationUpdateRequestSchema } from "../public/projectApplicationUpdateRequestSchema.js"
import { projectCreateRequestSchema } from "../public/projectCreateRequestSchema.js"
import { projectGrantCreateRequestSchema } from "../public/projectGrantCreateRequestSchema.js"
import { projectGrantLifecycleRequestSchema } from "../public/projectGrantLifecycleRequestSchema.js"
import { projectGrantUpdateRequestSchema } from "../public/projectGrantUpdateRequestSchema.js"
import { projectLifecycleRequestSchema } from "../public/projectLifecycleRequestSchema.js"
import { projectRoleCreateRequestSchema } from "../public/projectRoleCreateRequestSchema.js"
import { projectRoleUpdateRequestSchema } from "../public/projectRoleUpdateRequestSchema.js"
import { projectUpdateRequestSchema } from "../public/projectUpdateRequestSchema.js"

type ProjectServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
}

type ProjectRequestContext = RealmSystemContext | RealmTenantContext
type ProjectAuthenticator = (context: {
  req: { header: (name: string) => string | undefined; url: string }
}) => { data: ProjectRequestContext; success: true } | { errorMessage: string; op: string; success: false }

export function projectServerAppCreate(options: ProjectServerAppCreateOptions) {
  const app = new Hono() as Hono & { projectDatabase?: StorageDatabase }
  app.projectDatabase = options.database
  projectRoutesRegister(app, "/system/realms/:realmId", (context) =>
    projectSystemAuthenticate(context.req.header("authorization"), options.systemSecret),
  )
  projectRoutesRegister(app, "/realms/:realmId", (context) =>
    projectTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    ),
  )
  return app
}

function projectRoutesRegister(app: Hono, prefix: string, authenticate: ProjectAuthenticator) {
  app.get(`${prefix}/projects`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return projectErrorResponseCreate(context, query)
    return projectResultResponseCreate(
      context,
      projectList({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        query: query.data,
        realmId: projectParamGet(context, "realmId"),
      }),
    )
  })

  app.post(`${prefix}/projects`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const body = await projectRequestJsonRead(context)
    if (!body.success) return projectErrorResponseCreate(context, body)
    const input = v.safeParse(projectCreateRequestSchema, body.data)
    if (!input.success)
      return projectErrorResponseCreate(context, {
        errorMessage: "The project request is invalid.",
        op: "projectCreate",
      })
    return projectResultResponseCreate(
      context,
      projectCreate({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        input: input.output,
        realmId: projectParamGet(context, "realmId"),
      }),
      201,
    )
  })

  app.get(`${prefix}/projects/:projectId`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const result = projectGet({
      context: authenticated.data,
      database: projectDatabaseGet(app),
      realmId: projectParamGet(context, "realmId"),
      projectId: projectParamGet(context, "projectId"),
    })
    return projectResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.project.updatedAt) : undefined,
    )
  })

  app.patch(`${prefix}/projects/:projectId`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const body = await projectRequestJsonRead(context)
    if (!body.success) return projectErrorResponseCreate(context, body)
    const input = v.safeParse(projectUpdateRequestSchema, body.data)
    if (!input.success)
      return projectErrorResponseCreate(context, {
        errorMessage: "The project update is invalid.",
        op: "projectUpdate",
      })
    return projectResultResponseCreate(
      context,
      projectUpdate({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        input: input.output,
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
    )
  })

  app.post(`${prefix}/projects/:projectId/lifecycle`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const body = await projectRequestJsonRead(context)
    if (!body.success) return projectErrorResponseCreate(context, body)
    const input = v.safeParse(projectLifecycleRequestSchema, body.data)
    if (!input.success)
      return projectErrorResponseCreate(context, {
        errorMessage: "The project lifecycle request is invalid.",
        op: "projectLifecycleSet",
      })
    return projectResultResponseCreate(
      context,
      projectLifecycleSet({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        input: input.output,
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
    )
  })

  app.delete(`${prefix}/projects/:projectId`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    return projectResultResponseCreate(
      context,
      projectDelete({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
    )
  })

  projectApplicationRoutesRegister(app, prefix, authenticate)
  projectRoleRoutesRegister(app, prefix, authenticate)
  projectGrantRoutesRegister(app, prefix, authenticate)
}

function projectApplicationRoutesRegister(app: Hono, prefix: string, authenticate: ProjectAuthenticator) {
  app.get(`${prefix}/projects/:projectId/applications`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return projectErrorResponseCreate(context, query)
    return projectResultResponseCreate(
      context,
      projectApplicationList({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
        query: query.data,
      }),
    )
  })
  app.post(`${prefix}/projects/:projectId/applications`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const body = await projectRequestJsonRead(context)
    if (!body.success) return projectErrorResponseCreate(context, body)
    const input = v.safeParse(projectApplicationCreateRequestSchema, body.data)
    if (!input.success)
      return projectErrorResponseCreate(context, {
        errorMessage: "The application request is invalid.",
        op: "projectApplicationCreate",
      })
    return projectResultResponseCreate(
      context,
      projectApplicationCreate({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        input: input.output,
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
      201,
    )
  })
  app.get(`${prefix}/projects/:projectId/applications/:applicationId`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const result = projectApplicationGet({
      applicationId: projectParamGet(context, "applicationId"),
      context: authenticated.data,
      database: projectDatabaseGet(app),
      realmId: projectParamGet(context, "realmId"),
      projectId: projectParamGet(context, "projectId"),
    })
    return projectResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.application.updatedAt) : undefined,
    )
  })
  app.patch(`${prefix}/projects/:projectId/applications/:applicationId`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const body = await projectRequestJsonRead(context)
    if (!body.success) return projectErrorResponseCreate(context, body)
    const input = v.safeParse(projectApplicationUpdateRequestSchema, body.data)
    if (!input.success)
      return projectErrorResponseCreate(context, {
        errorMessage: "The application update is invalid.",
        op: "projectApplicationUpdate",
      })
    return projectResultResponseCreate(
      context,
      projectApplicationUpdate({
        applicationId: projectParamGet(context, "applicationId"),
        context: authenticated.data,
        database: projectDatabaseGet(app),
        input: input.output,
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
    )
  })
  app.post(`${prefix}/projects/:projectId/applications/:applicationId/lifecycle`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const body = await projectRequestJsonRead(context)
    if (!body.success) return projectErrorResponseCreate(context, body)
    const input = v.safeParse(projectApplicationLifecycleRequestSchema, body.data)
    if (!input.success)
      return projectErrorResponseCreate(context, {
        errorMessage: "The application lifecycle request is invalid.",
        op: "projectApplicationLifecycleSet",
      })
    return projectResultResponseCreate(
      context,
      projectApplicationLifecycleSet({
        applicationId: projectParamGet(context, "applicationId"),
        context: authenticated.data,
        database: projectDatabaseGet(app),
        input: input.output,
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
    )
  })
  app.delete(`${prefix}/projects/:projectId/applications/:applicationId`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    return projectResultResponseCreate(
      context,
      projectApplicationDelete({
        applicationId: projectParamGet(context, "applicationId"),
        context: authenticated.data,
        database: projectDatabaseGet(app),
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
    )
  })
}

function projectRoleRoutesRegister(app: Hono, prefix: string, authenticate: ProjectAuthenticator) {
  app.get(`${prefix}/projects/:projectId/roles`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return projectErrorResponseCreate(context, query)
    return projectResultResponseCreate(
      context,
      projectRoleList({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
        query: query.data,
      }),
    )
  })
  app.post(`${prefix}/projects/:projectId/roles`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const body = await projectRequestJsonRead(context)
    if (!body.success) return projectErrorResponseCreate(context, body)
    const input = v.safeParse(projectRoleCreateRequestSchema, body.data)
    if (!input.success)
      return projectErrorResponseCreate(context, {
        errorMessage: "The project role request is invalid.",
        op: "projectRoleCreate",
      })
    return projectResultResponseCreate(
      context,
      projectRoleCreate({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        input: input.output,
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
      201,
    )
  })
  app.patch(`${prefix}/projects/:projectId/roles/:roleId`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const body = await projectRequestJsonRead(context)
    if (!body.success) return projectErrorResponseCreate(context, body)
    const input = v.safeParse(projectRoleUpdateRequestSchema, body.data)
    if (!input.success)
      return projectErrorResponseCreate(context, {
        errorMessage: "The project role update is invalid.",
        op: "projectRoleUpdate",
      })
    return projectResultResponseCreate(
      context,
      projectRoleUpdate({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        input: input.output,
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
        roleId: projectParamGet(context, "roleId"),
      }),
    )
  })
  app.delete(`${prefix}/projects/:projectId/roles/:roleId`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    return projectResultResponseCreate(
      context,
      projectRoleDelete({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
        roleId: projectParamGet(context, "roleId"),
      }),
    )
  })
}

function projectGrantRoutesRegister(app: Hono, prefix: string, authenticate: ProjectAuthenticator) {
  app.get(`${prefix}/projects/:projectId/grants`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return projectErrorResponseCreate(context, query)
    return projectResultResponseCreate(
      context,
      projectGrantList({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
        query: query.data,
      }),
    )
  })
  app.post(`${prefix}/projects/:projectId/grants`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const body = await projectRequestJsonRead(context)
    if (!body.success) return projectErrorResponseCreate(context, body)
    const input = v.safeParse(projectGrantCreateRequestSchema, body.data)
    if (!input.success)
      return projectErrorResponseCreate(context, {
        errorMessage: "The project grant request is invalid.",
        op: "projectGrantCreate",
      })
    return projectResultResponseCreate(
      context,
      projectGrantCreate({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        input: input.output,
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
      201,
    )
  })
  app.patch(`${prefix}/projects/:projectId/grants/:grantId`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const body = await projectRequestJsonRead(context)
    if (!body.success) return projectErrorResponseCreate(context, body)
    const input = v.safeParse(projectGrantUpdateRequestSchema, body.data)
    if (!input.success)
      return projectErrorResponseCreate(context, {
        errorMessage: "The project grant update is invalid.",
        op: "projectGrantUpdate",
      })
    return projectResultResponseCreate(
      context,
      projectGrantUpdate({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        grantId: projectParamGet(context, "grantId"),
        input: input.output,
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
    )
  })
  app.post(`${prefix}/projects/:projectId/grants/:grantId/lifecycle`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    const body = await projectRequestJsonRead(context)
    if (!body.success) return projectErrorResponseCreate(context, body)
    const input = v.safeParse(projectGrantLifecycleRequestSchema, body.data)
    if (!input.success)
      return projectErrorResponseCreate(context, {
        errorMessage: "The project grant lifecycle request is invalid.",
        op: "projectGrantLifecycleSet",
      })
    return projectResultResponseCreate(
      context,
      projectGrantLifecycleSet({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        grantId: projectParamGet(context, "grantId"),
        input: input.output,
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
    )
  })
  app.delete(`${prefix}/projects/:projectId/grants/:grantId`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    return projectResultResponseCreate(
      context,
      projectGrantDelete({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        grantId: projectParamGet(context, "grantId"),
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
    )
  })
  app.get(`${prefix}/projects/:projectId/access`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return projectErrorResponseCreate(context, authenticated)
    return projectResultResponseCreate(
      context,
      projectAccessCheck({
        context: authenticated.data,
        database: projectDatabaseGet(app),
        realmId: projectParamGet(context, "realmId"),
        projectId: projectParamGet(context, "projectId"),
      }),
    )
  })
}

function projectDatabaseGet(_app: Hono): StorageDatabase {
  return (_app as Hono & { projectDatabase?: StorageDatabase }).projectDatabase as StorageDatabase
}

function projectParamGet(context: { req: { param: (name: string) => string | undefined } }, name: string): string {
  return context.req.param(name) ?? ""
}

function projectSystemAuthenticate(authorization: string | undefined, configuredSecret: Secret | string | undefined) {
  const token = projectBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return resultErrorCodedCreate(
      "projectSystemAuthorization",
      "System authorization is required.",
      "projects.unauthorized",
    )
  return resultCreate(realmSystemContextCreate())
}

function projectTenantAuthenticate(
  database: StorageDatabase,
  host: string | undefined,
  requestUrl: string,
  authorization: string | undefined,
) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : resolvedHost.split(":")[0]
  const tenant = realmTenantContextResolve({ database, host: normalizedHost ?? "" })
  if (!tenant.success) return tenant
  return realmBootstrapAdminAuthenticate({
    context: tenant.data,
    database,
    secret: projectBearerTokenGet(authorization) ?? "",
  })
}

function projectBearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? null
}

function projectErrorResponseCreate(
  context: {
    json: (body: unknown, status?: number) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  const coded =
    result.code === undefined ? resultErrorCodedCreate(result.op, result.errorMessage, "projects.invalid") : result
  return httpResultResponseCreate(context, coded as Result<never>)
}

function projectResultResponseCreate<T>(
  context: {
    json: (body: unknown, status?: number) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: Result<T>,
  status = 200,
  lastModified?: Date,
) {
  return httpResultResponseCreate(context, result, status, lastModified)
}

async function projectRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return resultErrorCodedCreate("projectRequestJsonRead", "The request body is invalid.", "projects.request-invalid")
  }
}
