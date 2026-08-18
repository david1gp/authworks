import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { passwordChange } from "../actions/passwordChange.js"
import { passwordEmailVerify } from "../actions/passwordEmailVerify.js"
import { passwordLogin } from "../actions/passwordLogin.js"
import { passwordPolicyGet } from "../actions/passwordPolicyGet.js"
import { passwordPolicySet } from "../actions/passwordPolicySet.js"
import { passwordRecoveryComplete } from "../actions/passwordRecoveryComplete.js"
import { passwordRecoveryRequest } from "../actions/passwordRecoveryRequest.js"
import { passwordRegister } from "../actions/passwordRegister.js"
import { passwordChangeRequestSchema } from "../public/passwordChangeRequestSchema.js"
import { passwordEmailVerificationRequestSchema } from "../public/passwordEmailVerificationRequestSchema.js"
import { passwordLoginRequestSchema } from "../public/passwordLoginRequestSchema.js"
import { passwordPolicySetRequestSchema } from "../public/passwordPolicySetRequestSchema.js"
import { passwordRecoveryCompleteRequestSchema } from "../public/passwordRecoveryCompleteRequestSchema.js"
import { passwordRecoveryRequestSchema } from "../public/passwordRecoveryRequestSchema.js"
import { passwordRegistrationRequestSchema } from "../public/passwordRegistrationRequestSchema.js"
import type { PasswordRegistrationDelivery } from "../public/passwordRegistrationDeliverySchema.js"
import type { PasswordRecoveryDelivery } from "../public/passwordRecoveryDeliverySchema.js"
import type { PasswordSessionCreate } from "../public/passwordSessionCreate.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import { sessionPasswordCreate } from "../../sessions/public/sessionPasswordCreate.js"

type PasswordServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
  readonly onRecoveryToken?: (delivery: PasswordRecoveryDelivery) => void
  readonly sessionCreate?: PasswordSessionCreate
  readonly onVerificationToken?: (delivery: PasswordRegistrationDelivery) => void
}

export function passwordServerAppCreate(options: PasswordServerAppCreateOptions) {
  const app = new Hono()
  const systemContext = realmSystemContextCreate("system")
  const sessionCreate = options.sessionCreate ?? sessionPasswordCreate()

  app.post("/realms/:realmId/password/register", async (context) => {
    const tenant = passwordTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return passwordErrorResponseCreate(context, tenant)
    const body = await passwordRequestJsonRead(context)
    if (!body.success) return passwordErrorResponseCreate(context, body)
    const input = v.safeParse(passwordRegistrationRequestSchema, body.data)
    if (!input.success)
      return passwordErrorResponseCreate(context, {
        errorMessage: "The registration request is invalid.",
        op: "passwordRegister",
      })
    return passwordResultResponseCreate(
      context,
      passwordRegister({
        context: tenant.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        onVerificationToken: options.onVerificationToken,
      }),
    )
  })

  app.post("/realms/:realmId/password/login", async (context) => {
    const tenant = passwordTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return passwordErrorResponseCreate(context, tenant)
    const body = await passwordRequestJsonRead(context)
    if (!body.success) return passwordErrorResponseCreate(context, body)
    const input = v.safeParse(passwordLoginRequestSchema, body.data)
    if (!input.success)
      return passwordErrorResponseCreate(context, { errorMessage: "The credentials are invalid.", op: "passwordLogin" })
    return passwordResultResponseCreate(
      context,
      passwordLogin({
        context: tenant.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        organizationId: input.output.organizationId,
        deviceMetadata: passwordDeviceMetadataGet(context),
        sessionCreate,
      }),
    )
  })

  app.post("/realms/:realmId/password/verify-email", async (context) => {
    const tenant = passwordTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return passwordErrorResponseCreate(context, tenant)
    const body = await passwordRequestJsonRead(context)
    if (!body.success) return passwordErrorResponseCreate(context, body)
    const input = v.safeParse(passwordEmailVerificationRequestSchema, body.data)
    if (!input.success)
      return passwordErrorResponseCreate(context, {
        errorMessage: "The verification token is invalid.",
        op: "passwordEmailVerify",
      })
    return passwordResultResponseCreate(
      context,
      passwordEmailVerify({
        context: tenant.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/password/recovery/request", async (context) => {
    const tenant = passwordTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return passwordErrorResponseCreate(context, tenant)
    const body = await passwordRequestJsonRead(context)
    if (!body.success) return passwordErrorResponseCreate(context, body)
    const input = v.safeParse(passwordRecoveryRequestSchema, body.data)
    if (!input.success)
      return passwordErrorResponseCreate(context, {
        errorMessage: "The recovery request is invalid.",
        op: "passwordRecoveryRequest",
      })
    return passwordResultResponseCreate(
      context,
      passwordRecoveryRequest({
        context: tenant.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        onRecoveryToken: options.onRecoveryToken,
      }),
    )
  })

  app.post("/realms/:realmId/password/recovery/complete", async (context) => {
    const tenant = passwordTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return passwordErrorResponseCreate(context, tenant)
    const body = await passwordRequestJsonRead(context)
    if (!body.success) return passwordErrorResponseCreate(context, body)
    const input = v.safeParse(passwordRecoveryCompleteRequestSchema, body.data)
    if (!input.success)
      return passwordErrorResponseCreate(context, {
        errorMessage: "The recovery token is invalid.",
        op: "passwordRecoveryComplete",
      })
    return passwordResultResponseCreate(
      context,
      passwordRecoveryComplete({
        context: tenant.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/users/:userId/password", async (context) => {
    const tenant = passwordTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return passwordErrorResponseCreate(context, tenant)
    const body = await passwordRequestJsonRead(context)
    if (!body.success) return passwordErrorResponseCreate(context, body)
    const input = v.safeParse(passwordChangeRequestSchema, body.data)
    if (!input.success)
      return passwordErrorResponseCreate(context, {
        errorMessage: "The password change request is invalid.",
        op: "passwordChange",
      })
    return passwordResultResponseCreate(
      context,
      passwordChange({
        context: tenant.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.get("/realms/:realmId/password-policy", (context) => {
    const tenant = passwordTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return passwordErrorResponseCreate(context, tenant)
    return passwordResultResponseCreate(
      context,
      passwordPolicyGet({
        context: tenant.data,
        database: options.database,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.get("/system/realms/:realmId/password-policy", (context) => {
    const authorization = passwordSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return passwordErrorResponseCreate(context, authorization)
    return passwordResultResponseCreate(
      context,
      passwordPolicyGet({
        context: systemContext,
        database: options.database,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.patch("/system/realms/:realmId/password-policy", async (context) => {
    const authorization = passwordSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return passwordErrorResponseCreate(context, authorization)
    const body = await passwordRequestJsonRead(context)
    if (!body.success) return passwordErrorResponseCreate(context, body)
    const input = v.safeParse(passwordPolicySetRequestSchema, body.data)
    if (!input.success)
      return passwordErrorResponseCreate(context, {
        errorMessage: "The password policy is invalid.",
        op: "passwordPolicySet",
      })
    return passwordResultResponseCreate(
      context,
      passwordPolicySet({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  return app
}

function passwordTenantContextResolve(
  database: StorageDatabase,
  host: string | undefined,
  requestUrl: string,
  realmId: string,
) {
  const tenant = realmTenantContextResolve({ database, host: passwordRequestHostGet(host, requestUrl) })
  if (!tenant.success) return tenant
  if (tenant.data.realmId !== realmId)
    return {
      errorMessage: "The realm is not available in this tenant context.",
      op: "passwordTenantContextResolve",
      success: false as const,
    }
  return tenant
}

function passwordRequestHostGet(host: string | undefined, requestUrl: string): string {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  return resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : (resolvedHost.split(":")[0] ?? "")
}

function passwordDeviceMetadataGet(context: {
  req: { header: (name: string) => string | undefined }
}): SessionDeviceMetadata {
  const forwardedFor = context.req.header("x-forwarded-for")?.split(",", 1)[0]?.trim()
  return {
    ...(context.req.header("user-agent") === undefined ? {} : { userAgent: context.req.header("user-agent") }),
    ...(forwardedFor === undefined || forwardedFor.length === 0 ? {} : { ipAddress: forwardedFor }),
    ...(context.req.header("x-device-fingerprint") === undefined
      ? {}
      : { fingerprint: context.req.header("x-device-fingerprint") }),
    ...(context.req.header("x-device-description") === undefined
      ? {}
      : { description: context.req.header("x-device-description") }),
  }
}

function passwordErrorResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { errorMessage: string; op: string },
) {
  const code = passwordErrorCodeGet(result)
  return context.json(
    httpErrorResponseCreate(code, result.errorMessage),
    httpErrorStatusGet(code) as ContentfulStatusCode,
  )
}

function passwordErrorCodeGet(result: { errorMessage: string; op: string }): string {
  const message = result.errorMessage.toLowerCase()
  if (message.includes("credentials") || message.includes("current password")) return "unauthorized"
  if (result.op.includes("Authorization") || result.op.includes("Authenticate") || message.includes("authorization"))
    return "unauthorized"
  if (message.includes("not found") || message.includes("not available")) return "not_found"
  if (message.includes("already") || message.includes("not active")) return "conflict"
  if (message.includes("invalid") || message.includes("required") || message.includes("policy")) return "bad_request"
  return "internal_server_error"
}

function passwordResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; op?: string; success: boolean },
  status = 200,
) {
  if (!result.success) return passwordErrorResponseCreate(context, result as { errorMessage: string; op: string })
  return context.json(result.data, status as ContentfulStatusCode)
}

async function passwordRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return { errorMessage: "The request body is invalid.", op: "passwordRequestJsonRead", success: false as const }
  }
}

function passwordSystemAuthorizationGet(
  authorization: string | undefined,
  configuredSecret: Secret | string | undefined,
) {
  const token = passwordBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return {
      errorMessage: "System authorization is required.",
      op: "passwordSystemAuthorizationGet",
      success: false as const,
    }
  return { data: undefined, success: true as const }
}

function passwordBearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? null
}
