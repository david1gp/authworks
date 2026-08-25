import { Hono } from "hono"
import * as v from "valibot"
import type { Result } from "#result"
import { resultErrorDetailsParse } from "../../../platform/errors/resultErrorDetailsParse.js"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { trustedProxyIpResolve } from "../../../platform/http/trustedProxyIpResolve.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { sessionAuthenticate } from "../../sessions/actions/sessionAuthenticate.js"
import { sessionPasswordCreate } from "../../sessions/actions/sessionPasswordCreate.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { sessionBrowserCredentialResponseCreate } from "../../sessions/server/sessionBrowserCredentialResponseCreate.js"
import { sessionBrowserModeRequested } from "../../sessions/server/sessionBrowserModeRequested.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import { passwordChange } from "../actions/passwordChange.js"
import { passwordCredentialReplace } from "../actions/passwordCredentialReplace.js"
import { passwordEmailVerify } from "../actions/passwordEmailVerify.js"
import { passwordLogin } from "../actions/passwordLogin.js"
import { passwordPolicyGet } from "../actions/passwordPolicyGet.js"
import { passwordPolicySet } from "../actions/passwordPolicySet.js"
import { passwordRecoveryComplete } from "../actions/passwordRecoveryComplete.js"
import { passwordRecoveryRequest } from "../actions/passwordRecoveryRequest.js"
import { passwordRegister } from "../actions/passwordRegister.js"
import { passwordWhatsappVerify } from "../actions/passwordWhatsappVerify.js"
import type { PasswordWhatsappDeliveryPort } from "../domain/passwordWhatsappDeliveryPort.js"
import { passwordWhatsappAvailabilityDenyByDefaultCreate } from "../domain/passwordWhatsappAvailabilityDenyByDefaultCreate.js"
import type { PasswordSessionCreate } from "../domain/passwordSessionCreate.js"
import type { PasswordWhatsappAvailabilityPort } from "../domain/passwordWhatsappAvailabilityPort.js"
import { passwordChangeRequestSchema } from "../public/passwordChangeRequestSchema.js"
import { passwordCredentialReplaceRequestSchema } from "../public/passwordCredentialReplaceRequestSchema.js"
import { passwordEmailVerificationRequestSchema } from "../public/passwordEmailVerificationRequestSchema.js"
import { passwordLoginRequestSchema } from "../public/passwordLoginRequestSchema.js"
import type { PasswordLoginResponse } from "../public/passwordLoginResponseSchema.js"
import { passwordMeChangeRequestSchema } from "../public/passwordMeChangeRequestSchema.js"
import { passwordPolicySetRequestSchema } from "../public/passwordPolicySetRequestSchema.js"
import { passwordRecoveryCompleteRequestSchema } from "../public/passwordRecoveryCompleteRequestSchema.js"
import type { PasswordRecoveryDelivery } from "../public/passwordRecoveryDeliverySchema.js"
import { passwordRecoveryRequestSchema } from "../public/passwordRecoveryRequestSchema.js"
import type { PasswordRegistrationDelivery } from "../public/passwordRegistrationDeliverySchema.js"
import { passwordRegistrationRequestSchema } from "../public/passwordRegistrationRequestSchema.js"
import { passwordWhatsappVerificationRequestSchema } from "../public/passwordWhatsappVerificationRequestSchema.js"

type PasswordServerAppCreateOptions = {
  readonly browserMode?: boolean
  readonly database: StorageDatabase
  readonly publicOrigin?: string
  readonly systemSecret?: Secret | string
  readonly clientIpResolve?: (context: PasswordRouteContext) => string | undefined
  readonly rateLimitSecret?: Secret | string
  readonly trustedProxyAddresses?: readonly string[]
  readonly whatsappDelivery?: PasswordWhatsappDeliveryPort
  readonly whatsappAvailability?: PasswordWhatsappAvailabilityPort
  readonly onRecoveryToken?: (delivery: PasswordRecoveryDelivery) => void
  readonly sessionCreate?: PasswordSessionCreate
  readonly onVerificationToken?: (delivery: PasswordRegistrationDelivery) => void
}

type PasswordServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    cookieAuthenticated: boolean
    session: Session
  }
}

export function passwordServerAppCreate(options: PasswordServerAppCreateOptions) {
  const app = new Hono<PasswordServerEnv>()
  const systemContext = realmSystemContextCreate("system")
  const sessionCreate = options.sessionCreate ?? sessionPasswordCreate()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    minimumAssurance: "authenticated",
    publicOrigin: options.publicOrigin,
  })
  const policyWriteMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    minimumAssurance: "multi_factor",
    publicOrigin: options.publicOrigin,
  })

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
    if (input.output.verificationMethod === "whatsapp") {
      const whatsappInput = { ...input.output, verificationMethod: "whatsapp" as const }
      return passwordResultResponseCreate(
        context,
        passwordRegister({
          clientIp: passwordTrustedClientIpGet(context, options),
          context: tenant.data,
          database: options.database,
          input: whatsappInput,
          onVerificationToken: options.onVerificationToken,
          rateLimitSecret: options.rateLimitSecret ?? options.systemSecret,
          realmId: context.req.param("realmId"),
          whatsappAvailability: options.whatsappAvailability ?? passwordWhatsappAvailabilityDenyByDefaultCreate(),
          whatsappDelivery: options.whatsappDelivery,
        }),
      )
    }
    const emailInput = {
      ...input.output,
      verificationMethod: input.output.verificationMethod === "email" ? ("email" as const) : undefined,
    }
    return passwordResultResponseCreate(
      context,
      passwordRegister({
        context: tenant.data,
        database: options.database,
        input: emailInput,
        realmId: context.req.param("realmId"),
        onVerificationToken: options.onVerificationToken,
        clientIp: passwordTrustedClientIpGet(context, options),
        rateLimitSecret: options.rateLimitSecret ?? options.systemSecret,
        whatsappDelivery: options.whatsappDelivery,
      }),
    )
  })

  app.post("/realms/:realmId/password/verify-whatsapp", async (context) => {
    const tenant = passwordTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return passwordErrorResponseCreate(context, tenant)
    const body = await passwordRequestJsonRead(context)
    if (!body.success) return passwordErrorResponseCreate(context, body)
    const input = v.safeParse(passwordWhatsappVerificationRequestSchema, body.data)
    if (!input.success)
      return passwordErrorResponseCreate(context, {
        errorMessage: "The WhatsApp verification code is invalid.",
        op: "passwordWhatsappVerify",
      })
    return passwordResultResponseCreate(
      context,
      passwordWhatsappVerify({
        clientIp: passwordTrustedClientIpGet(context, options),
        context: tenant.data,
        database: options.database,
        input: input.output,
        rateLimitSecret: options.rateLimitSecret ?? options.systemSecret,
        realmId: context.req.param("realmId"),
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
    const loggedIn = passwordLogin({
      context: tenant.data,
      database: options.database,
      input: input.output,
      realmId: context.req.param("realmId"),
      organizationId: input.output.organizationId,
      deviceMetadata: passwordDeviceMetadataGet(context),
      sessionCreate,
    })
    if (!sessionBrowserModeRequested(context, options.browserMode))
      return passwordResultResponseCreate(context, loggedIn)
    return passwordBrowserLoginResponseCreate(context, loggedIn)
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

  app.post("/system/realms/:realmId/users/:userId/password", async (context) => {
    const authorization = passwordSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return passwordErrorResponseCreate(context, authorization)
    const body = await passwordRequestJsonRead(context)
    if (!body.success) return passwordErrorResponseCreate(context, body)
    const input = v.safeParse(passwordCredentialReplaceRequestSchema, body.data)
    if (!input.success)
      return passwordErrorResponseCreate(context, {
        errorMessage: "The password replacement request is invalid.",
        op: "passwordCredentialReplace",
      })
    return passwordResultResponseCreate(
      context,
      passwordCredentialReplace({
        context: systemContext,
        database: options.database,
        password: new Secret(input.output.password),
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.post("/realms/:realmId/me/password", protectedMiddleware, async (context) => {
    const subject = passwordSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return passwordErrorResponseCreate(context, subject)
    const body = await passwordRequestJsonRead(context)
    if (!body.success) return passwordErrorResponseCreate(context, body)
    const input = v.safeParse(passwordMeChangeRequestSchema, body.data)
    if (!input.success)
      return passwordErrorResponseCreate(context, {
        errorMessage: "The password change request is invalid.",
        op: "passwordMeChange",
      })
    return passwordResultResponseCreate(
      context,
      passwordChange({
        context: subject.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.get(
    "/realms/:realmId/password-policy",
    async (context, next) => {
      if (!passwordSessionRequestIsAuthenticated(options.database, context)) return next()
      return protectedMiddleware(context, next)
    },
    (context) => {
      const actor = context.get("authorizationActor")
      if (actor !== undefined) {
        const authorized = realmAdministratorContextAuthorize({
          actor,
          database: options.database,
          permission: authorizationPermissionDefinitions.realmRead,
          realmId: context.req.param("realmId"),
        })
        if (!authorized.success) return passwordErrorResponseCreate(context, authorized)
        return passwordResultResponseCreate(
          context,
          passwordPolicyGet({
            context: realmSystemContextCreate(authorized.data.actorId),
            database: options.database,
            realmId: context.req.param("realmId"),
          }),
        )
      }
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
    },
  )

  app.patch("/realms/:realmId/password-policy", policyWriteMiddleware, async (context) => {
    const authorized = realmAdministratorContextAuthorize({
      actor: context.get("authorizationActor"),
      database: options.database,
      minimumAssurance: "multi_factor",
      permission: authorizationPermissionDefinitions.realmWrite,
      realmId: context.req.param("realmId"),
    })
    if (!authorized.success) return passwordErrorResponseCreate(context, authorized)
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
        context: realmSystemContextCreate(authorized.data.actorId),
        database: options.database,
        input: input.output,
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

function passwordSessionRequestIsAuthenticated(
  database: StorageDatabase,
  context: { req: { header: (name: string) => string | undefined; param: (name: string) => string } },
): boolean {
  const authorization = context.req.header("authorization")
  if (authorization !== undefined) {
    const token = /^Bearer (.+)$/.exec(authorization)?.[1]
    return token === undefined
      ? false
      : sessionAuthenticate({ database, realmId: context.req.param("realmId"), token }).success
  }
  return /(?:^|;)\s*session=[^;]+/.test(context.req.header("cookie") ?? "")
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

function passwordTrustedClientIpGet(
  context: PasswordRouteContext,
  options: Pick<PasswordServerAppCreateOptions, "clientIpResolve" | "trustedProxyAddresses">,
): string {
  return trustedProxyIpResolve({
    directAddress: options.clientIpResolve?.(context),
    forwardedFor: context.req.header("x-forwarded-for"),
    trustedProxyAddresses: options.trustedProxyAddresses,
  })
}

function passwordErrorResponseCreate(
  context: PasswordRouteContext,
  result: {
    errorData?: string | null
    errorMessage: string
    op: string
    code?: string
    statusCode?: number
    success?: false
  },
) {
  const errorData = passwordPublicErrorDataCreate(result)
  return httpResultResponseCreate(context, {
    code: result.code ?? "passwords.invalid",
    ...(errorData === undefined ? {} : { errorData }),
    errorMessage: result.errorMessage,
    op: result.op,
    ...(result.statusCode === undefined ? {} : { statusCode: result.statusCode }),
    success: false,
  })
}

function passwordResultResponseCreate<T>(
  context: PasswordRouteContext,
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
) {
  if (!result.success)
    return passwordErrorResponseCreate(
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

function passwordPublicErrorDataCreate(result: {
  errorData?: string | null
  errorMessage: string
  op: string
  success?: false
}): string | undefined {
  const details = resultErrorDetailsParse({ ...result, success: false })
  const retryAfterSeconds = details?.retryAfterSeconds
  if (typeof retryAfterSeconds !== "number" || !Number.isSafeInteger(retryAfterSeconds) || retryAfterSeconds <= 0)
    return undefined
  return JSON.stringify({ retryAfterSeconds })
}

function passwordBrowserLoginResponseCreate(context: PasswordRouteContext, result: Result<PasswordLoginResponse>) {
  const browser = sessionBrowserCredentialResponseCreate(context, result)
  if (!browser.success) return passwordErrorResponseCreate(context, browser)
  return httpResultResponseCreate(context, {
    data: {
      authentication: browser.data.authentication,
      ...(browser.data.challenge === undefined ? {} : { challenge: browser.data.challenge }),
    },
    success: true,
  })
}

type PasswordRouteContext = {
  readonly header: (name: string, value: string) => void
  readonly json: (body: unknown, status?: number) => Response
  readonly req: {
    readonly header: (name: string) => string | undefined
    readonly raw: Request
  }
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

function passwordSubjectContextResolve(
  context: { readonly get: (key: "authorizationActor") => AuthorizationActorContext },
  realmId: string,
): Result<RealmTenantContext> {
  const actor = context.get("authorizationActor")
  if (actor.kind !== "user" || actor.realmId !== realmId)
    return {
      code: "passwords.forbidden",
      errorMessage: "The authenticated user is not available in this realm.",
      op: "passwordSubjectContextResolve",
      success: false,
    }
  return { data: { actor, actorId: actor.actorId, kind: "tenant", realmId }, success: true }
}

function passwordBearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? null
}
