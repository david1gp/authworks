import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmBootstrapAdminAuthenticate } from "../../realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { machineApiKeyCreate } from "../actions/machineApiKeyCreate.js"
import { machineCredentialList } from "../actions/machineCredentialList.js"
import { machineCredentialRevoke } from "../actions/machineCredentialRevoke.js"
import { machinePersonalAccessTokenCreate } from "../actions/machinePersonalAccessTokenCreate.js"
import { machineUserClientSecretRotate } from "../actions/machineUserClientSecretRotate.js"
import { machineUserCreate } from "../actions/machineUserCreate.js"
import { machineUserGet } from "../actions/machineUserGet.js"
import { machineUserLifecycleSet } from "../actions/machineUserLifecycleSet.js"
import { machineUserList } from "../actions/machineUserList.js"
import { machineProtectedMiddlewareCreate } from "./machineProtectedMiddlewareCreate.js"
import { machineCredentialIssueRequestSchema } from "../public/machineCredentialIssueRequestSchema.js"
import { machineCredentialRevokeRequestSchema } from "../public/machineCredentialRevokeRequestSchema.js"
import { machineUserCreateRequestSchema } from "../public/machineUserCreateRequestSchema.js"
import { machineUserLifecycleRequestSchema } from "../public/machineUserLifecycleRequestSchema.js"

type MachineUserServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
}

type MachineRequestContext = RealmSystemContext | RealmTenantContext
type MachineAuthenticator = (context: {
  req: { header: (name: string) => string | undefined; url: string }
}) => { data: MachineRequestContext; success: true } | { errorMessage: string; op: string; success: false }

export function machineUserServerAppCreate(options: MachineUserServerAppCreateOptions) {
  const app = new Hono()
  machineRoutesRegister(app, options, "/system/realms/:realmId", (context) =>
    machineSystemAuthenticate(context.req.header("authorization"), options.systemSecret),
  )
  machineRoutesRegister(app, options, "/realms/:realmId", (context) =>
    machineTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    ),
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
  app: Hono,
  options: MachineUserServerAppCreateOptions,
  prefix: string,
  authenticate: MachineAuthenticator,
) {
  app.get(`${prefix}/machine-users`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return machineErrorResponseCreate(context, authenticated)
    return machineResultResponseCreate(
      context,
      machineUserList({
        context: authenticated.data,
        database: options.database,
        realmId: machineParamGet(context, "realmId"),
      }),
    )
  })

  app.post(`${prefix}/machine-users`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return machineErrorResponseCreate(context, authenticated)
    const body = await machineRequestJsonRead(context)
    if (!body.success) return machineErrorResponseCreate(context, body)
    const input = v.safeParse(machineUserCreateRequestSchema, body.data)
    if (!input.success)
      return machineErrorResponseCreate(context, {
        errorMessage: "The machine user request is invalid.",
        op: "machineUserCreate",
      })
    return machineResultResponseCreate(
      context,
      machineUserCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: machineParamGet(context, "realmId"),
      }),
      201,
    )
  })

  app.get(`${prefix}/machine-users/:machineUserId`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return machineErrorResponseCreate(context, authenticated)
    return machineResultResponseCreate(
      context,
      machineUserGet({
        context: authenticated.data,
        database: options.database,
        realmId: machineParamGet(context, "realmId"),
        machineUserId: machineParamGet(context, "machineUserId"),
      }),
    )
  })

  app.post(`${prefix}/machine-users/:machineUserId/lifecycle`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return machineErrorResponseCreate(context, authenticated)
    const body = await machineRequestJsonRead(context)
    if (!body.success) return machineErrorResponseCreate(context, body)
    const input = v.safeParse(machineUserLifecycleRequestSchema, body.data)
    if (!input.success)
      return machineErrorResponseCreate(context, {
        errorMessage: "The machine user lifecycle request is invalid.",
        op: "machineUserLifecycleSet",
      })
    return machineResultResponseCreate(
      context,
      machineUserLifecycleSet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: machineParamGet(context, "realmId"),
        machineUserId: machineParamGet(context, "machineUserId"),
      }),
    )
  })

  app.post(`${prefix}/machine-users/:machineUserId/client-secret/rotate`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return machineErrorResponseCreate(context, authenticated)
    return machineResultResponseCreate(
      context,
      machineUserClientSecretRotate({
        context: authenticated.data,
        database: options.database,
        realmId: machineParamGet(context, "realmId"),
        machineUserId: machineParamGet(context, "machineUserId"),
      }),
    )
  })

  app.get(`${prefix}/machine-users/:machineUserId/credentials`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return machineErrorResponseCreate(context, authenticated)
    return machineResultResponseCreate(
      context,
      machineCredentialList({
        context: authenticated.data,
        database: options.database,
        realmId: machineParamGet(context, "realmId"),
        machineUserId: machineParamGet(context, "machineUserId"),
      }),
    )
  })

  app.post(`${prefix}/machine-users/:machineUserId/personal-access-tokens`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return machineErrorResponseCreate(context, authenticated)
    const body = await machineRequestJsonRead(context)
    if (!body.success) return machineErrorResponseCreate(context, body)
    const input = v.safeParse(machineCredentialIssueRequestSchema, {
      ...machineObjectGet(body.data),
      machineUserId: machineParamGet(context, "machineUserId"),
    })
    if (!input.success)
      return machineErrorResponseCreate(context, {
        errorMessage: "The personal access token request is invalid.",
        op: "machinePersonalAccessTokenCreate",
      })
    return machineResultResponseCreate(
      context,
      machinePersonalAccessTokenCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: machineParamGet(context, "realmId"),
      }),
      201,
    )
  })

  app.post(`${prefix}/machine-users/:machineUserId/api-keys`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return machineErrorResponseCreate(context, authenticated)
    const body = await machineRequestJsonRead(context)
    if (!body.success) return machineErrorResponseCreate(context, body)
    const input = v.safeParse(machineCredentialIssueRequestSchema, {
      ...machineObjectGet(body.data),
      machineUserId: machineParamGet(context, "machineUserId"),
    })
    if (!input.success)
      return machineErrorResponseCreate(context, {
        errorMessage: "The API key request is invalid.",
        op: "machineApiKeyCreate",
      })
    return machineResultResponseCreate(
      context,
      machineApiKeyCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: machineParamGet(context, "realmId"),
      }),
      201,
    )
  })

  app.post(`${prefix}/machine-credentials/:credentialId/revoke`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return machineErrorResponseCreate(context, authenticated)
    const body = await machineRequestJsonRead(context)
    if (!body.success) return machineErrorResponseCreate(context, body)
    const input = v.safeParse(machineCredentialRevokeRequestSchema, body.data)
    if (!input.success)
      return machineErrorResponseCreate(context, {
        errorMessage: "The machine credential revocation request is invalid.",
        op: "machineCredentialRevoke",
      })
    return machineResultResponseCreate(
      context,
      machineCredentialRevoke({
        context: authenticated.data,
        credentialId: machineParamGet(context, "credentialId"),
        database: options.database,
        input: input.output,
        realmId: machineParamGet(context, "realmId"),
      }),
    )
  })
}

function machineSystemAuthenticate(authorization: string | undefined, configuredSecret: Secret | string | undefined) {
  const token = machineBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return {
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
    return { errorMessage: "The request body is invalid.", op: "machineRequestJsonRead", success: false as const }
  }
}

function machineObjectGet(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function machineErrorResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { errorMessage: string; op: string },
) {
  const code = machineErrorCodeGet(result)
  return context.json(
    httpErrorResponseCreate(code, result.errorMessage),
    httpErrorStatusGet(code) as ContentfulStatusCode,
  )
}

function machineResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; op?: string; success: boolean },
  status = 200,
) {
  if (!result.success) return machineErrorResponseCreate(context, result as { errorMessage: string; op: string })
  return context.json(result.data, status as ContentfulStatusCode)
}

function machineErrorCodeGet(result: { errorMessage: string; op: string }): string {
  const message = result.errorMessage.toLowerCase()
  const op = result.op.toLowerCase()
  if (op.includes("authorization") || message.includes("authorization") || message.includes("authentication"))
    return "unauthorized"
  if (message.includes("not authorized") || message.includes("permission")) return "forbidden"
  if (message.includes("not found")) return "not_found"
  if (message.includes("already") || message.includes("active") || message.includes("exists")) return "conflict"
  return "bad_request"
}
