import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { emailOtpStart } from "../actions/emailOtpStart.js"
import { emailOtpVerify } from "../actions/emailOtpVerify.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import type { EmailOtpDelivery } from "../public/emailOtpDeliverySchema.js"
import { emailOtpStartRequestSchema } from "../public/emailOtpStartRequestSchema.js"
import type { EmailOtpSecurityNotification } from "../public/emailOtpSecurityNotificationSchema.js"
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
    if (!tenant.success) return emailOtpErrorResponseCreate(context, tenant.errorMessage, "not_found")
    const body = await emailOtpRequestJsonRead(context)
    if (!body.success) return emailOtpErrorResponseCreate(context, body.errorMessage, "bad_request")
    const input = v.safeParse(emailOtpStartRequestSchema, body.data)
    if (!input.success) return emailOtpErrorResponseCreate(context, "The email OTP request is invalid.", "bad_request")
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
    if (!tenant.success) return emailOtpErrorResponseCreate(context, tenant.errorMessage, "not_found")
    const body = await emailOtpRequestJsonRead(context)
    if (!body.success) return emailOtpErrorResponseCreate(context, body.errorMessage, "bad_request")
    const input = v.safeParse(emailOtpVerifyRequestSchema, body.data)
    if (!input.success) return emailOtpErrorResponseCreate(context, "The email OTP code is invalid.", "unauthorized")
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
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  message: string,
  code: string,
) {
  return context.json(httpErrorResponseCreate(code, message), httpErrorStatusGet(code) as ContentfulStatusCode)
}

function emailOtpResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; success: boolean },
  status = 200,
) {
  if (!result.success) {
    const message = result.errorMessage ?? "The email OTP request failed."
    const code = message.includes("code") || message.includes("session") ? "unauthorized" : "internal_server_error"
    return emailOtpErrorResponseCreate(context, message, code)
  }
  return context.json(result.data, status as ContentfulStatusCode)
}

async function emailOtpRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return { errorMessage: "The request body is invalid.", success: false as const }
  }
}
