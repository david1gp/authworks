import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import type { Result } from "#result"
import { resultErrorDetailsParse } from "../../../platform/errors/resultErrorDetailsParse.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { trustedProxyIpResolve } from "../../../platform/http/trustedProxyIpResolve.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import { sessionBrowserCredentialResponseCreate } from "../../sessions/server/sessionBrowserCredentialResponseCreate.js"
import { sessionBrowserModeRequested } from "../../sessions/server/sessionBrowserModeRequested.js"
import { whatsappOtpResend } from "../actions/whatsappOtpResend.js"
import { whatsappOtpStart } from "../actions/whatsappOtpStart.js"
import { whatsappOtpVerify } from "../actions/whatsappOtpVerify.js"
import type { WhatsappOtpDelivery } from "../public/whatsappOtpDeliverySchema.js"
import { whatsappOtpResendRequestSchema } from "../public/whatsappOtpResendRequestSchema.js"
import type { WhatsappOtpSecurityNotification } from "../public/whatsappOtpSecurityNotificationSchema.js"
import { whatsappOtpStartRequestSchema } from "../public/whatsappOtpStartRequestSchema.js"
import { whatsappOtpVerifyRequestSchema } from "../public/whatsappOtpVerifyRequestSchema.js"
import type { WhatsappOtpDeliveryPort } from "../domain/whatsappOtpDeliveryPort.js"
import type { WhatsappOtpAvailabilityPort } from "../domain/whatsappOtpAvailabilityPort.js"
import type { WhatsappOtpAvailabilityResponse } from "../public/whatsappOtpAvailabilityResponseSchema.js"

type WhatsappOtpRouteContext = {
  json: (body: unknown, status?: ContentfulStatusCode) => Response
  req: {
    header: (name: string) => string | undefined
    param: (name: string) => string
    query: (name: string) => string | undefined
    raw: Request
    url: string
  }
}

type WhatsappOtpServerAppCreateOptions = {
  readonly browserMode?: boolean
  readonly clientIpResolve?: (context: WhatsappOtpRouteContext) => string | undefined
  readonly database: StorageDatabase
  readonly delivery?: WhatsappOtpDeliveryPort
  readonly onDelivery?: (delivery: WhatsappOtpDelivery) => void | Promise<void>
  readonly onSecurityNotification?: (notification: WhatsappOtpSecurityNotification) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly trustedProxyAddresses?: readonly string[]
  readonly availability: WhatsappOtpAvailabilityPort
}

export function whatsappOtpServerAppCreate(options: WhatsappOtpServerAppCreateOptions) {
  const app = new Hono()

  app.get("/realms/:realmId/whatsapp-otp/availability", (context) => {
    const tenant = whatsappOtpTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return whatsappOtpErrorResponseCreate(context, tenant)
    const organizationId = context.req.query("organizationId")
    const availability = options.availability.whatsappOtpAvailabilityGet({
      ...(organizationId === undefined ? {} : { organizationId }),
      realmId: context.req.param("realmId"),
    })
    return whatsappOtpAvailabilityResponseCreate(context, availability)
  })

  app.post("/realms/:realmId/whatsapp-otp/start", async (context) => {
    const tenant = whatsappOtpTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return whatsappOtpErrorResponseCreate(context, tenant)
    const body = await whatsappOtpRequestJsonRead(context)
    if (!body.success) return whatsappOtpErrorResponseCreate(context, body)
    const input = v.safeParse(whatsappOtpStartRequestSchema, body.data)
    if (!input.success)
      return whatsappOtpErrorResponseCreate(
        context,
        resultErrorCodedCreate("whatsappOtpStart", "The WhatsApp OTP request is invalid.", "whatsapp-otp.invalid"),
      )
    return whatsappOtpResultResponseCreate(
      context,
      whatsappOtpStart({
        clientIp: whatsappOtpTrustedClientIpGet(context, options),
        context: tenant.data,
        database: options.database,
        delivery: options.delivery,
        input: input.output,
        onDelivery: options.onDelivery,
        onSecurityNotification: options.onSecurityNotification,
        rateLimitSecret: options.rateLimitSecret,
        realmId: context.req.param("realmId"),
        availability: options.availability,
      }),
    )
  })

  app.post("/realms/:realmId/whatsapp-otp/resend", async (context) => {
    const tenant = whatsappOtpTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return whatsappOtpErrorResponseCreate(context, tenant)
    const body = await whatsappOtpRequestJsonRead(context)
    if (!body.success) return whatsappOtpErrorResponseCreate(context, body)
    const input = v.safeParse(whatsappOtpResendRequestSchema, body.data)
    if (!input.success)
      return whatsappOtpErrorResponseCreate(
        context,
        resultErrorCodedCreate("whatsappOtpResend", "The WhatsApp OTP request is invalid.", "whatsapp-otp.invalid"),
      )
    return whatsappOtpResultResponseCreate(
      context,
      whatsappOtpResend({
        clientIp: whatsappOtpTrustedClientIpGet(context, options),
        context: tenant.data,
        database: options.database,
        availability: options.availability,
        delivery: options.delivery,
        input: input.output,
        onDelivery: options.onDelivery,
        onSecurityNotification: options.onSecurityNotification,
        rateLimitSecret: options.rateLimitSecret,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/whatsapp-otp/verify", async (context) => {
    const tenant = whatsappOtpTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return whatsappOtpErrorResponseCreate(context, tenant)
    const body = await whatsappOtpRequestJsonRead(context)
    if (!body.success) return whatsappOtpErrorResponseCreate(context, body)
    const input = v.safeParse(whatsappOtpVerifyRequestSchema, body.data)
    if (!input.success)
      return whatsappOtpErrorResponseCreate(
        context,
        resultErrorCodedCreate("whatsappOtpVerify", "The WhatsApp OTP code is invalid.", "whatsapp-otp.invalid"),
      )
    const clientIp = whatsappOtpTrustedClientIpGet(context, options)
    const verified = whatsappOtpVerify({
      clientIp,
      context: tenant.data,
      database: options.database,
      availability: options.availability,
      deviceMetadata: whatsappOtpDeviceMetadataGet(context, clientIp),
      input: input.output,
      onSecurityNotification: options.onSecurityNotification,
      rateLimitSecret: options.rateLimitSecret,
      realmId: context.req.param("realmId"),
    })
    return whatsappOtpResultResponseCreate(
      context,
      sessionBrowserModeRequested(context, options.browserMode)
        ? sessionBrowserCredentialResponseCreate(context, verified)
        : verified,
    )
  })

  return app
}

function whatsappOtpTenantContextResolve(
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
      code: "whatsapp-otp.not-found",
      errorMessage: "The realm is not available in this tenant context.",
      op: "whatsappOtpTenantContextResolve",
      success: false as const,
    }
  return tenant
}

function whatsappOtpTrustedClientIpGet(
  context: WhatsappOtpRouteContext,
  options: Pick<WhatsappOtpServerAppCreateOptions, "clientIpResolve" | "trustedProxyAddresses">,
): string {
  return trustedProxyIpResolve({
    directAddress: options.clientIpResolve?.(context),
    forwardedFor: context.req.header("x-forwarded-for"),
    trustedProxyAddresses: options.trustedProxyAddresses,
  })
}

function whatsappOtpDeviceMetadataGet(context: WhatsappOtpRouteContext, ipAddress: string): SessionDeviceMetadata {
  return {
    ...(context.req.header("user-agent") === undefined ? {} : { userAgent: context.req.header("user-agent") }),
    ipAddress,
    ...(context.req.header("x-device-fingerprint") === undefined
      ? {}
      : { fingerprint: context.req.header("x-device-fingerprint") }),
    ...(context.req.header("x-device-description") === undefined
      ? {}
      : { description: context.req.header("x-device-description") }),
  }
}

function whatsappOtpErrorResponseCreate(
  context: WhatsappOtpRouteContext,
  result: {
    errorData?: string | null
    errorMessage: string
    op: string
    code?: string
    statusCode?: number
    success: false
  },
) {
  const errorData = whatsappOtpPublicErrorDataCreate(result)
  return httpResultResponseCreate(context, {
    code: result.code ?? "whatsapp-otp.invalid",
    ...(errorData === undefined ? {} : { errorData }),
    errorMessage: result.errorMessage,
    op: result.op,
    ...(result.statusCode === undefined ? {} : { statusCode: result.statusCode }),
    success: false,
  })
}

function whatsappOtpResultResponseCreate<T>(
  context: WhatsappOtpRouteContext,
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
) {
  if (!result.success)
    return whatsappOtpErrorResponseCreate(
      context,
      result as {
        errorData?: string | null
        errorMessage: string
        op: string
        code?: string
        statusCode?: number
        success: false
      },
    )
  return httpResultResponseCreate(context, result as Result<T>, status)
}

function whatsappOtpAvailabilityResponseCreate(
  context: WhatsappOtpRouteContext,
  result: {
    data?: WhatsappOtpAvailabilityResponse
    errorMessage?: string
    op?: string
    code?: string
    success: boolean
  },
) {
  if (!result.success) {
    if (result.code === "organizations.login-method-disabled" || result.code === "organizations.not-found")
      return httpResultResponseCreate(context, { data: { available: false }, success: true })
    return whatsappOtpErrorResponseCreate(
      context,
      result as {
        errorData?: string | null
        errorMessage: string
        op: string
        code?: string
        statusCode?: number
        success: false
      },
    )
  }
  return httpResultResponseCreate(context, result as Result<WhatsappOtpAvailabilityResponse>)
}

function whatsappOtpPublicErrorDataCreate(result: {
  errorData?: string | null
  errorMessage: string
  op: string
  success: false
}): string | undefined {
  const details = resultErrorDetailsParse(result)
  const retryAfterSeconds = details?.retryAfterSeconds
  if (typeof retryAfterSeconds !== "number" || !Number.isSafeInteger(retryAfterSeconds) || retryAfterSeconds <= 0)
    return undefined
  return JSON.stringify({ retryAfterSeconds })
}

async function whatsappOtpRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return resultErrorCodedCreate("whatsappOtpRequestJsonRead", "The request body is invalid.", "whatsapp-otp.invalid")
  }
}
