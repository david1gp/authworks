import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { instanceSystemContextCreate } from "../../instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../instances/domain/instanceTenantContextCreate.js"
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

type PasswordServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
  readonly onRecoveryToken?: (delivery: PasswordRecoveryDelivery) => void
  readonly onVerificationToken?: (delivery: PasswordRegistrationDelivery) => void
}

export function passwordServerAppCreate(options: PasswordServerAppCreateOptions) {
  const app = new Hono()
  const systemContext = instanceSystemContextCreate("system")

  app.post("/instances/:instanceId/password/register", async (context) => {
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
        context: instanceTenantContextCreate(context.req.param("instanceId"), "anonymous"),
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        onVerificationToken: options.onVerificationToken,
      }),
    )
  })

  app.post("/instances/:instanceId/password/login", async (context) => {
    const body = await passwordRequestJsonRead(context)
    if (!body.success) return passwordErrorResponseCreate(context, body)
    const input = v.safeParse(passwordLoginRequestSchema, body.data)
    if (!input.success)
      return passwordErrorResponseCreate(context, { errorMessage: "The credentials are invalid.", op: "passwordLogin" })
    return passwordResultResponseCreate(
      context,
      passwordLogin({
        context: instanceTenantContextCreate(context.req.param("instanceId"), "anonymous"),
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  app.post("/instances/:instanceId/password/verify-email", async (context) => {
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
        context: instanceTenantContextCreate(context.req.param("instanceId"), "anonymous"),
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  app.post("/instances/:instanceId/password/recovery/request", async (context) => {
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
        context: instanceTenantContextCreate(context.req.param("instanceId"), "anonymous"),
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        onRecoveryToken: options.onRecoveryToken,
      }),
    )
  })

  app.post("/instances/:instanceId/password/recovery/complete", async (context) => {
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
        context: instanceTenantContextCreate(context.req.param("instanceId"), "anonymous"),
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  app.post("/instances/:instanceId/users/:userId/password", async (context) => {
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
        context: instanceTenantContextCreate(context.req.param("instanceId"), "anonymous"),
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.get("/instances/:instanceId/password-policy", (context) =>
    passwordResultResponseCreate(
      context,
      passwordPolicyGet({
        context: instanceTenantContextCreate(context.req.param("instanceId"), "anonymous"),
        database: options.database,
        instanceId: context.req.param("instanceId"),
      }),
    ),
  )

  app.get("/system/instances/:instanceId/password-policy", (context) => {
    const authorization = passwordSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return passwordErrorResponseCreate(context, authorization)
    return passwordResultResponseCreate(
      context,
      passwordPolicyGet({
        context: systemContext,
        database: options.database,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  app.patch("/system/instances/:instanceId/password-policy", async (context) => {
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
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  return app
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
