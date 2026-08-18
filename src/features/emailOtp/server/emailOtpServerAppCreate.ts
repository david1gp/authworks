import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import type { Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import { emailOtpStart } from "../actions/emailOtpStart.js"
import { emailOtpVerify } from "../actions/emailOtpVerify.js"
import type { EmailOtpDelivery } from "../public/emailOtpDeliverySchema.js"
import type { EmailOtpSecurityNotification } from "../public/emailOtpSecurityNotificationSchema.js"
import { emailOtpStartRequestSchema } from "../public/emailOtpStartRequestSchema.js"
import { emailOtpVerifyRequestSchema } from "../public/emailOtpVerifyRequestSchema.js"

type EmailOtpServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly onDelivery?: (delivery: EmailOtpDelivery) => void | Promise<void>
  readonly onSecurityNotification?: (notification: EmailOtpSecurityNotification) => void | Promise<void>
}

export function emailOtpServerAppCreate(options: EmailOtpServerAppCreateOptions) {
  const app = new Hono()

  app.post("/realms/:realmId/email-otp/start", async (context) => {
    const tenant = emailOtpTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success)
      return emailOtpErrorResponseCreate(
        context,
        resultErrorCodedCreate("emailOtpTenantContextResolve", tenant.errorMessage, "email-otp.not-found"),
      )
    const body = await emailOtpRequestJsonRead(context)
    if (!body.success) return emailOtpErrorResponseCreate(context, body)
    const input = v.safeParse(emailOtpStartRequestSchema, body.data)
    if (!input.success)
      return emailOtpErrorResponseCreate(
        context,
        resultErrorCodedCreate("emailOtpStart", "The email OTP request is invalid.", "email-otp.invalid"),
      )
    return emailOtpResultResponseCreate(
      context,
      emailOtpStart({
        context: tenant.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        onDelivery: options.onDelivery,
        onSecurityNotification: options.onSecurityNotification,
      }),
    )
  })

  app.post("/realms/:realmId/email-otp/verify", async (context) => {
    const tenant = emailOtpTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success)
      return emailOtpErrorResponseCreate(
        context,
        resultErrorCodedCreate("emailOtpTenantContextResolve", tenant.errorMessage, "email-otp.not-found"),
      )
    const body = await emailOtpRequestJsonRead(context)
    if (!body.success) return emailOtpErrorResponseCreate(context, body)
    const input = v.safeParse(emailOtpVerifyRequestSchema, body.data)
    if (!input.success)
      return emailOtpErrorResponseCreate(
        context,
        resultErrorCodedCreate("emailOtpVerify", "The email OTP code is invalid.", "email-otp.invalid"),
      )
    return emailOtpResultResponseCreate(
      context,
      emailOtpVerify({
        context: tenant.data,
        database: options.database,
        deviceMetadata: emailOtpDeviceMetadataGet(context),
        input: input.output,
        realmId: context.req.param("realmId"),
        onSecurityNotification: options.onSecurityNotification,
      }),
    )
  })

  return app
}

function emailOtpTenantContextResolve(
  database: StorageDatabase,
  host: string | undefined,
  requestUrl: string,
  realmId: string,
) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : (resolvedHost.split(":")[0] ?? "")
  const tenant = realmTenantContextResolve({ database, host: normalizedHost })
  if (!tenant.success) return tenant
  if (tenant.data.realmId !== realmId)
    return {
      code: "email-otp.not-found",
      errorMessage: "The realm is not available in this tenant context.",
      op: "emailOtpTenantContextResolve",
      success: false as const,
    }
  return tenant
}

function emailOtpDeviceMetadataGet(context: {
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

function emailOtpErrorResponseCreate(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  return httpResultResponseCreate(context, {
    ...result,
    code: result.code ?? "email-otp.invalid",
    success: false,
  } as Result<unknown>)
}

function emailOtpResultResponseCreate<T>(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
) {
  if (!result.success)
    return emailOtpErrorResponseCreate(
      context,
      result as { errorMessage: string; op: string; code?: string; success: false },
    )
  return httpResultResponseCreate(context, result as Result<T>, status)
}

async function emailOtpRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return resultErrorCodedCreate("emailOtpRequestJsonRead", "The request body is invalid.", "email-otp.invalid")
  }
}
