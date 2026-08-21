import { Hono, type MiddlewareHandler } from "hono"
import * as v from "valibot"
import type { Result } from "#result"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { realmBootstrapAdminAuthenticate } from "../../realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import type { SessionAssurance } from "../../sessions/public/sessionAssuranceSchema.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import { machineApiKeyCreate } from "../actions/machineApiKeyCreate.js"
import { machineCredentialList } from "../actions/machineCredentialList.js"
import { machineCredentialRevoke } from "../actions/machineCredentialRevoke.js"
import { machinePersonalAccessTokenCreate } from "../actions/machinePersonalAccessTokenCreate.js"
import { machineUserClientSecretRotate } from "../actions/machineUserClientSecretRotate.js"
import { machineUserCreate } from "../actions/machineUserCreate.js"
import { machineUserGet } from "../actions/machineUserGet.js"
import { machineUserLifecycleSet } from "../actions/machineUserLifecycleSet.js"
import { machineUserList } from "../actions/machineUserList.js"
import { machineCredentialIssueRequestSchema } from "../public/machineCredentialIssueRequestSchema.js"
import { machineCredentialRevokeRequestSchema } from "../public/machineCredentialRevokeRequestSchema.js"
import { machineUserCreateRequestSchema } from "../public/machineUserCreateRequestSchema.js"
import { machineUserLifecycleRequestSchema } from "../public/machineUserLifecycleRequestSchema.js"
import { machineProtectedMiddlewareCreate } from "./machineProtectedMiddlewareCreate.js"

type MachineUserServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly publicOrigin?: string
  readonly systemSecret?: Secret | string
}

type MachineRequestContext = RealmSystemContext | RealmTenantContext
type MachineUserServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
  }
}
type MachineAuthenticator = (context: {
  req: { header: (name: string) => string | undefined; url: string }
}) => { data: MachineRequestContext; success: true } | { errorMessage: string; op: string; success: false }

export function machineUserServerAppCreate(options: MachineUserServerAppCreateOptions) {
  const app = new Hono<MachineUserServerEnv>()
  machineRoutesRegister(app, options, "/system/realms/:realmId", (context) =>
    machineSystemAuthenticate(context.req.header("authorization"), options.systemSecret),
  )
  const browserProtectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    publicOrigin: options.publicOrigin,
  })
  machineRoutesRegister(
    app,
    options,
    "/realms/:realmId",
    (context) =>
      machineTenantAuthenticate(
        options.database,
        context.req.header("host"),
        context.req.url,
        context.req.header("authorization"),
      ),
    browserProtectedMiddleware,
  )

  app.get(
    "/realms/:realmId/protected-api",
    machineProtectedMiddlewareCreate({ database: options.database }),
    (context) =>
      context.json({
        actor: context.get("authorizationActor"),
        credential: context.get("machineAuthentication").credential,
        machineUser: context.get("machineAuthentication").machineUser,
        scopes: context.get("machineAuthentication").scopes,
      }),
  )
  return app
}

function machineRoutesRegister(
  app: Hono<MachineUserServerEnv>,
  options: MachineUserServerAppCreateOptions,
  prefix: string,
  authenticate: MachineAuthenticator,
  browserProtectedMiddleware?: MiddlewareHandler,
) {
  app.get(`${prefix}/machine-users`, (context) =>
    machineRouteHandle(
      context,
      authenticate,
      options.database,
      browserProtectedMiddleware,
      "machine.user.manage",
      undefined,
      (authenticated) => {
        const query = listQueryFromSearchParams(context.req.query())
        if (!query.success) return machineErrorResponseCreate(context, query)
        return machineResultResponseCreate(
          context,
          machineUserList({
            context: authenticated,
            database: options.database,
            query: query.data,
            realmId: machineParamGet(context, "realmId"),
          }),
        )
      },
    ),
  )

  app.post(`${prefix}/machine-users`, (context) =>
    machineRouteHandle(
      context,
      authenticate,
      options.database,
      browserProtectedMiddleware,
      "machine.user.manage",
      "multi_factor",
      async (authenticated) => {
        const body = await machineRequestJsonRead(context)
        if (!body.success) return machineErrorResponseCreate(context, body)
        const input = v.safeParse(machineUserCreateRequestSchema, body.data)
        if (!input.success)
          return machineErrorResponseCreate(context, {
            code: "machine-users.invalid",
            errorMessage: "The machine user request is invalid.",
            op: "machineUserCreate",
          })
        return machineResultResponseCreate(
          context,
          machineUserCreate({
            context: authenticated,
            database: options.database,
            input: input.output,
            realmId: machineParamGet(context, "realmId"),
          }),
          201,
        )
      },
    ),
  )

  app.get(`${prefix}/machine-users/:machineUserId`, (context) =>
    machineRouteHandle(
      context,
      authenticate,
      options.database,
      browserProtectedMiddleware,
      "machine.user.manage",
      undefined,
      (authenticated) => {
        return machineResultResponseCreate(
          context,
          machineUserGet({
            context: authenticated,
            database: options.database,
            realmId: machineParamGet(context, "realmId"),
            machineUserId: machineParamGet(context, "machineUserId"),
          }),
        )
      },
    ),
  )

  app.post(`${prefix}/machine-users/:machineUserId/lifecycle`, (context) =>
    machineRouteHandle(
      context,
      authenticate,
      options.database,
      browserProtectedMiddleware,
      "machine.user.manage",
      undefined,
      async (authenticated) => {
        const body = await machineRequestJsonRead(context)
        if (!body.success) return machineErrorResponseCreate(context, body)
        const input = v.safeParse(machineUserLifecycleRequestSchema, body.data)
        if (!input.success)
          return machineErrorResponseCreate(context, {
            code: "machine-users.invalid",
            errorMessage: "The machine user lifecycle request is invalid.",
            op: "machineUserLifecycleSet",
          })
        return machineResultResponseCreate(
          context,
          machineUserLifecycleSet({
            context: authenticated,
            database: options.database,
            input: input.output,
            realmId: machineParamGet(context, "realmId"),
            machineUserId: machineParamGet(context, "machineUserId"),
          }),
        )
      },
    ),
  )

  app.post(`${prefix}/machine-users/:machineUserId/client-secret/rotate`, (context) =>
    machineRouteHandle(
      context,
      authenticate,
      options.database,
      browserProtectedMiddleware,
      "machine.credential.manage",
      "multi_factor",
      (authenticated) => {
        return machineResultResponseCreate(
          context,
          machineUserClientSecretRotate({
            context: authenticated,
            database: options.database,
            realmId: machineParamGet(context, "realmId"),
            machineUserId: machineParamGet(context, "machineUserId"),
          }),
        )
      },
    ),
  )

  app.get(`${prefix}/machine-users/:machineUserId/credentials`, (context) =>
    machineRouteHandle(
      context,
      authenticate,
      options.database,
      browserProtectedMiddleware,
      "machine.credential.manage",
      undefined,
      (authenticated) => {
        const query = listQueryFromSearchParams(context.req.query())
        if (!query.success) return machineErrorResponseCreate(context, query)
        return machineResultResponseCreate(
          context,
          machineCredentialList({
            context: authenticated,
            database: options.database,
            realmId: machineParamGet(context, "realmId"),
            machineUserId: machineParamGet(context, "machineUserId"),
            query: query.data,
          }),
        )
      },
    ),
  )

  app.post(`${prefix}/machine-users/:machineUserId/personal-access-tokens`, (context) =>
    machineRouteHandle(
      context,
      authenticate,
      options.database,
      browserProtectedMiddleware,
      "machine.credential.manage",
      "multi_factor",
      async (authenticated) => {
        const body = await machineRequestJsonRead(context)
        if (!body.success) return machineErrorResponseCreate(context, body)
        const input = v.safeParse(machineCredentialIssueRequestSchema, {
          ...machineObjectGet(body.data),
          machineUserId: machineParamGet(context, "machineUserId"),
        })
        if (!input.success)
          return machineErrorResponseCreate(context, {
            code: "machine-users.invalid",
            errorMessage: "The personal access token request is invalid.",
            op: "machinePersonalAccessTokenCreate",
          })
        return machineResultResponseCreate(
          context,
          machinePersonalAccessTokenCreate({
            context: authenticated,
            database: options.database,
            input: input.output,
            realmId: machineParamGet(context, "realmId"),
          }),
          201,
        )
      },
    ),
  )

  app.post(`${prefix}/machine-users/:machineUserId/api-keys`, (context) =>
    machineRouteHandle(
      context,
      authenticate,
      options.database,
      browserProtectedMiddleware,
      "machine.credential.manage",
      "multi_factor",
      async (authenticated) => {
        const body = await machineRequestJsonRead(context)
        if (!body.success) return machineErrorResponseCreate(context, body)
        const input = v.safeParse(machineCredentialIssueRequestSchema, {
          ...machineObjectGet(body.data),
          machineUserId: machineParamGet(context, "machineUserId"),
        })
        if (!input.success)
          return machineErrorResponseCreate(context, {
            code: "machine-users.invalid",
            errorMessage: "The API key request is invalid.",
            op: "machineApiKeyCreate",
          })
        return machineResultResponseCreate(
          context,
          machineApiKeyCreate({
            context: authenticated,
            database: options.database,
            input: input.output,
            realmId: machineParamGet(context, "realmId"),
          }),
          201,
        )
      },
    ),
  )

  app.post(`${prefix}/machine-credentials/:credentialId/revoke`, (context) =>
    machineRouteHandle(
      context,
      authenticate,
      options.database,
      browserProtectedMiddleware,
      "machine.credential.manage",
      "multi_factor",
      async (authenticated) => {
        const body = await machineRequestJsonRead(context)
        if (!body.success) return machineErrorResponseCreate(context, body)
        const input = v.safeParse(machineCredentialRevokeRequestSchema, body.data)
        if (!input.success)
          return machineErrorResponseCreate(context, {
            code: "machine-users.invalid",
            errorMessage: "The machine credential revocation request is invalid.",
            op: "machineCredentialRevoke",
          })
        return machineResultResponseCreate(
          context,
          machineCredentialRevoke({
            context: authenticated,
            credentialId: machineParamGet(context, "credentialId"),
            database: options.database,
            input: input.output,
            realmId: machineParamGet(context, "realmId"),
          }),
        )
      },
    ),
  )
}

async function machineRouteHandle(
  context: Parameters<MiddlewareHandler>[0],
  authenticate: MachineAuthenticator,
  database: StorageDatabase,
  browserProtectedMiddleware: MiddlewareHandler | undefined,
  permission: AuthorizationPermission,
  minimumAssurance: SessionAssurance | undefined,
  handler: (authenticated: MachineRequestContext) => Response | Promise<Response>,
): Promise<Response | void> {
  if (browserProtectedMiddleware === undefined || context.req.header("authorization") !== undefined) {
    const authenticated = authenticate(context)
    if (!authenticated.success) return machineErrorResponseCreate(context, authenticated)
    return handler(authenticated.data)
  }

  let response: Response | undefined
  const middlewareResponse = await browserProtectedMiddleware(context, async () => {
    const authenticated = realmAdministratorContextAuthorize({
      actor: context.get("authorizationActor"),
      database,
      minimumAssurance,
      permission,
      realmId: machineParamGet(context, "realmId"),
    })
    if (!authenticated.success) {
      response = machineErrorResponseCreate(context, authenticated)
      return
    }
    response = await handler(authenticated.data)
  })
  return response ?? middlewareResponse
}

function machineSystemAuthenticate(authorization: string | undefined, configuredSecret: Secret | string | undefined) {
  const token = machineBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return {
      code: "machine-users.authentication-required",
      errorMessage: "System authorization is required.",
      op: "machineSystemAuthorization",
      success: false as const,
    }
  return { data: realmSystemContextCreate(), success: true as const }
}

function machineTenantAuthenticate(
  database: StorageDatabase,
  host: string | undefined,
  requestUrl: string,
  authorization: string | undefined,
) {
  const resolved = realmTenantContextResolve({ database, host: machineHostGet(host, requestUrl) })
  if (!resolved.success) return resolved
  return realmBootstrapAdminAuthenticate({
    context: resolved.data,
    database,
    secret: machineBearerTokenGet(authorization) ?? "",
  })
}

function machineHostGet(host: string | undefined, requestUrl: string): string {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  return resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : (resolvedHost.split(":")[0] ?? "")
}

function machineBearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer\s+(\S+)$/i.exec(authorization)
  return match?.[1] ?? null
}

function machineParamGet(context: { req: { param: (name: string) => string | undefined } }, name: string): string {
  return context.req.param(name) ?? ""
}

async function machineRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return {
      code: "machine-users.invalid",
      errorMessage: "The request body is invalid.",
      op: "machineRequestJsonRead",
      success: false as const,
    }
  }
}

function machineObjectGet(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function machineErrorResponseCreate(
  context: {
    json: (body: unknown, status?: number) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  return httpResultResponseCreate(context, {
    ...result,
    success: false,
    code: result.code ?? "machine-users.invalid",
  } as Result<unknown>)
}

function machineResultResponseCreate<T>(
  context: {
    json: (body: unknown, status?: number) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
) {
  if (!result.success)
    return machineErrorResponseCreate(
      context,
      result as { errorMessage: string; op: string; code?: string; success: false },
    )
  return httpResultResponseCreate(context, result as Result<T>, status)
}
