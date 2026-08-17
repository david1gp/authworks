import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { instanceBootstrapAdminAuthenticate } from "../../instances/actions/instanceBootstrapAdminAuthenticate.js"
import { instanceTenantContextResolve } from "../../instances/actions/instanceTenantContextResolve.js"
import { instanceSystemContextCreate } from "../../instances/domain/instanceSystemContextCreate.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { oidcAuthorizationCodeRedeem } from "../actions/oidcAuthorizationCodeRedeem.js"
import { oidcAuthorizationRequestAuthorize } from "../actions/oidcAuthorizationRequestAuthorize.js"
import { oidcAuthorizationRequestConsent } from "../actions/oidcAuthorizationRequestConsent.js"
import { oidcConsentList } from "../actions/oidcConsentList.js"
import { oidcConsentRevoke } from "../actions/oidcConsentRevoke.js"
import { oidcClientCreate } from "../actions/oidcClientCreate.js"
import { oidcClientGet } from "../actions/oidcClientGet.js"
import { oidcClientLifecycleSet } from "../actions/oidcClientLifecycleSet.js"
import { oidcClientList } from "../actions/oidcClientList.js"
import { oidcClientSecretRotate } from "../actions/oidcClientSecretRotate.js"
import { oidcClientUpdate } from "../actions/oidcClientUpdate.js"
import { oidcDiscoveryGet } from "../actions/oidcDiscoveryGet.js"
import { oidcJwksGet } from "../actions/oidcJwksGet.js"
import { oidcSigningKeyCreate } from "../actions/oidcSigningKeyCreate.js"
import { oidcSigningKeyLifecycleSet } from "../actions/oidcSigningKeyLifecycleSet.js"
import { oidcSigningKeyList } from "../actions/oidcSigningKeyList.js"
import { oidcTokenIssue } from "../actions/oidcTokenIssue.js"
import { oidcTokenRevoke } from "../actions/oidcTokenRevoke.js"
import { oidcUserInfoGet } from "../actions/oidcUserInfoGet.js"
import { oidcLogout } from "../actions/oidcLogout.js"
import { oidcAuthorizationCodeRedeemRequestSchema } from "../public/oidcAuthorizationCodeRedeemRequestSchema.js"
import { oidcAuthorizationRequestSchema } from "../public/oidcAuthorizationRequestSchema.js"
import { oidcAuthorizationConsentRequestSchema } from "../public/oidcAuthorizationConsentRequestSchema.js"
import { oidcAuthorizationConsentRequiredSchema } from "../public/oidcAuthorizationConsentRequiredSchema.js"
import type { OidcAuthorizationConsentResponse } from "../public/oidcAuthorizationConsentResponseSchema.js"
import { oidcConsentRevokeRequestSchema } from "../public/oidcConsentRevokeRequestSchema.js"
import { oidcLogoutRequestSchema } from "../public/oidcLogoutRequestSchema.js"
import { oidcClientCreateRequestSchema } from "../public/oidcClientCreateRequestSchema.js"
import { oidcClientLifecycleRequestSchema } from "../public/oidcClientLifecycleRequestSchema.js"
import { oidcClientUpdateRequestSchema } from "../public/oidcClientUpdateRequestSchema.js"
import { oidcSigningKeyLifecycleRequestSchema } from "../public/oidcSigningKeyLifecycleRequestSchema.js"
import { oidcTokenRequestSchema } from "../public/oidcTokenRequestSchema.js"
import { oidcTokenRevokeRequestSchema } from "../public/oidcTokenRevokeRequestSchema.js"

type OidcServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
}

type OidcRequestContext = ReturnType<typeof instanceSystemContextCreate> | InstanceTenantContext

export function oidcServerAppCreate(options: OidcServerAppCreateOptions) {
  const app = new Hono()
  oidcManagementRoutesRegister(app, options, "/system/instances/:instanceId/oidc", (context) =>
    oidcSystemAuthenticate(context.req.header("authorization"), options.systemSecret),
  )
  oidcManagementRoutesRegister(app, options, "/instances/:instanceId/oidc", (context) =>
    oidcTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    ),
  )

  app.get("/.well-known/openid-configuration", (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcErrorResponseCreate(context, instance)
    const discovery = oidcDiscoveryGet({ database: options.database, instanceId: instance.data.instanceId })
    if (!discovery.success) return oidcErrorResponseCreate(context, discovery)
    return context.json(discovery.data)
  })

  app.get("/.well-known/jwks.json", (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcErrorResponseCreate(context, instance)
    const jwks = oidcJwksGet({ database: options.database, instanceId: instance.data.instanceId })
    if (!jwks.success) return oidcErrorResponseCreate(context, jwks)
    return context.json(jwks.data)
  })

  app.get("/oauth2/authorize", (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcErrorResponseCreate(context, instance)
    const input = v.safeParse(oidcAuthorizationRequestSchema, oidcAuthorizationRequestInputCreate(context))
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC authorization request is invalid.",
        op: "oidcAuthorizationRequestAuthorize",
      })
    const authorization = oidcAuthorizationRequestAuthorize({
      database: options.database,
      encryptionSecret: options.systemSecret,
      input: input.output,
      instanceId: instance.data.instanceId,
      sessionToken: oidcBearerTokenGet(context.req.header("authorization")) ?? "",
    })
    if (!authorization.success) {
      if (authorization.op === "oidcAuthorizationConsentRequired")
        return oidcAuthorizationConsentRequiredResponseCreate(context, authorization)
      if (authorization.op === "oidcAuthorizationInteractionRequired")
        return context.json({ error: "interaction_required", error_description: authorization.errorMessage }, 400)
      return oidcErrorResponseCreate(context, authorization)
    }
    if (context.req.header("accept")?.includes("application/json")) return context.json(authorization.data)
    const redirect = new URL(authorization.data.redirect_uri)
    redirect.searchParams.set("code", authorization.data.code)
    redirect.searchParams.set("state", authorization.data.state)
    return context.redirect(redirect.toString(), 302)
  })

  app.post("/oauth2/consent", async (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcErrorResponseCreate(context, instance)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcAuthorizationConsentRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC consent request is invalid.",
        op: "oidcAuthorizationRequestConsent",
      })
    const consent = oidcAuthorizationRequestConsent({
      database: options.database,
      encryptionSecret: options.systemSecret,
      input: input.output,
      instanceId: instance.data.instanceId,
      sessionToken: oidcBearerTokenGet(context.req.header("authorization")) ?? "",
    })
    if (!consent.success) return oidcErrorResponseCreate(context, consent)
    if (context.req.header("accept")?.includes("application/json")) return context.json(consent.data)
    return oidcConsentRedirectCreate(context, consent.data)
  })

  app.post("/oauth2/consent/revoke", async (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcErrorResponseCreate(context, instance)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcConsentRevokeRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The consent request is invalid.",
        op: "oidcConsentRevoke",
      })
    return oidcResultResponseCreate(
      context,
      oidcConsentRevoke({
        database: options.database,
        instanceId: instance.data.instanceId,
        clientId: input.output.client_id,
        sessionToken: oidcBearerTokenGet(context.req.header("authorization")) ?? "",
      }),
    )
  })

  const oidcLogoutRoute = (context: {
    req: {
      header: (name: string) => string | undefined
      query: (name: string) => string | undefined
      url: string
    }
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    redirect: (location: string, status?: 301 | 302 | 303 | 307 | 308) => Response
  }) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcErrorResponseCreate(context, instance)
    const input = v.safeParse(oidcLogoutRequestSchema, {
      ...(context.req.query("client_id") === undefined ? {} : { client_id: context.req.query("client_id") }),
      ...(context.req.query("id_token_hint") === undefined
        ? {}
        : { id_token_hint: context.req.query("id_token_hint") }),
      ...(context.req.query("post_logout_redirect_uri") === undefined
        ? {}
        : { post_logout_redirect_uri: context.req.query("post_logout_redirect_uri") }),
      ...(context.req.query("state") === undefined ? {} : { state: context.req.query("state") }),
    })
    if (!input.success)
      return oidcErrorResponseCreate(context, { errorMessage: "The logout request is invalid.", op: "oidcLogout" })
    const loggedOut = oidcLogout({
      database: options.database,
      encryptionSecret: options.systemSecret,
      input: input.output,
      instanceId: instance.data.instanceId,
      sessionToken: oidcBearerTokenGet(context.req.header("authorization")) ?? undefined,
    })
    if (!loggedOut.success) return oidcErrorResponseCreate(context, loggedOut)
    if (context.req.header("accept")?.includes("application/json")) return context.json(loggedOut.data)
    if (loggedOut.data.post_logout_redirect_uri !== undefined) {
      const redirect = new URL(loggedOut.data.post_logout_redirect_uri)
      if (loggedOut.data.state !== undefined) redirect.searchParams.set("state", loggedOut.data.state)
      return context.redirect(redirect.toString(), 302)
    }
    return new Response(null, { status: 204 })
  }
  app.get("/oauth2/logout", oidcLogoutRoute)
  app.get("/oidc/logout", oidcLogoutRoute)

  app.post("/oauth2/authorization-code/redeem", async (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcErrorResponseCreate(context, instance)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcAuthorizationCodeRedeemRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The authorization code request is invalid.",
        op: "oidcAuthorizationCodeRedeem",
      })
    return oidcResultResponseCreate(
      context,
      oidcAuthorizationCodeRedeem({
        database: options.database,
        encryptionSecret: options.systemSecret,
        input: input.output,
        instanceId: instance.data.instanceId,
      }),
    )
  })

  app.post("/oauth2/token", async (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success)
      return oidcTokenErrorResponseCreate(context, "invalid_request", "The token request is invalid.")
    const body = await oidcTokenFormRead(context)
    if (!body.success) return oidcTokenErrorResponseCreate(context, "invalid_request", body.errorMessage)
    if (
      body.data.grant_type !== undefined &&
      body.data.grant_type !== "authorization_code" &&
      body.data.grant_type !== "refresh_token"
    )
      return oidcTokenErrorResponseCreate(context, "unsupported_grant_type", "The grant type is not supported.")
    const credentials = oidcTokenClientCredentialsResolve(context.req.header("authorization"), body.data)
    if (!credentials.success) return oidcTokenErrorResponseCreate(context, "invalid_client", credentials.errorMessage)
    const input = v.safeParse(oidcTokenRequestSchema, {
      ...body.data,
      client_id: credentials.clientId,
      ...(credentials.clientSecret === undefined ? {} : { client_secret: credentials.clientSecret }),
    })
    if (!input.success) return oidcTokenErrorResponseCreate(context, "invalid_request", "The token request is invalid.")
    const token = oidcTokenIssue({
      database: options.database,
      encryptionSecret: options.systemSecret,
      input: input.output,
      instanceId: instance.data.instanceId,
    })
    if (!token.success) return oidcTokenErrorResponseCreate(context, oidcTokenErrorCodeGet(token), token.errorMessage)
    context.header("cache-control", "no-store")
    context.header("pragma", "no-cache")
    return context.json(token.data)
  })

  app.get("/oauth2/userinfo", (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcUserInfoErrorResponseCreate(context)
    const token = oidcBearerTokenGet(context.req.header("authorization"))
    if (token === null) return oidcUserInfoErrorResponseCreate(context)
    const userInfo = oidcUserInfoGet({
      database: options.database,
      instanceId: instance.data.instanceId,
      token,
    })
    if (!userInfo.success) return oidcUserInfoErrorResponseCreate(context)
    context.header("cache-control", "no-store")
    return context.json(userInfo.data)
  })

  app.post("/oauth2/userinfo", (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success) return oidcUserInfoErrorResponseCreate(context)
    const token = oidcBearerTokenGet(context.req.header("authorization"))
    if (token === null) return oidcUserInfoErrorResponseCreate(context)
    const userInfo = oidcUserInfoGet({
      database: options.database,
      instanceId: instance.data.instanceId,
      token,
    })
    if (!userInfo.success) return oidcUserInfoErrorResponseCreate(context)
    context.header("cache-control", "no-store")
    return context.json(userInfo.data)
  })

  app.post("/oauth2/revoke", async (context) => {
    const instance = oidcPublicInstanceResolve(options.database, context.req.header("host"), context.req.url)
    if (!instance.success)
      return oidcTokenErrorResponseCreate(
        context,
        "invalid_request",
        "The revocation request is invalid.",
        "oauth2/revoke",
      )
    const body = await oidcTokenFormRead(context, "revocation")
    if (!body.success)
      return oidcTokenErrorResponseCreate(context, "invalid_request", body.errorMessage, "oauth2/revoke")
    const credentials = oidcTokenClientCredentialsResolve(context.req.header("authorization"), body.data)
    if (!credentials.success)
      return oidcTokenErrorResponseCreate(context, "invalid_client", credentials.errorMessage, "oauth2/revoke")
    const input = v.safeParse(oidcTokenRevokeRequestSchema, {
      ...body.data,
      client_id: credentials.clientId,
      ...(credentials.clientSecret === undefined ? {} : { client_secret: credentials.clientSecret }),
    })
    if (!input.success)
      return oidcTokenErrorResponseCreate(
        context,
        "invalid_request",
        "The revocation request is invalid.",
        "oauth2/revoke",
      )
    const revoked = oidcTokenRevoke({
      database: options.database,
      input: input.output,
      instanceId: instance.data.instanceId,
    })
    if (!revoked.success)
      return oidcTokenErrorResponseCreate(
        context,
        oidcTokenRevokeErrorCodeGet(revoked),
        revoked.errorMessage,
        "oauth2/revoke",
      )
    context.header("cache-control", "no-store")
    context.header("pragma", "no-cache")
    return new Response(null, { status: 200 })
  })
  return app
}

function oidcManagementRoutesRegister(
  app: Hono,
  options: OidcServerAppCreateOptions,
  prefix: string,
  authenticate: (context: {
    req: { header: (name: string) => string | undefined; url: string }
  }) => { data: OidcRequestContext; success: true } | { errorMessage: string; op: string; success: false },
) {
  app.get(`${prefix}/clients`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcClientList({
        context: authenticated.data,
        database: options.database,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.get(`${prefix}/consents/:userId`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcConsentList({
        context: authenticated.data,
        database: options.database,
        instanceId: oidcParamGet(context, "instanceId"),
        userId: oidcParamGet(context, "userId"),
      }),
    )
  })

  app.post(`${prefix}/consents/:userId/:clientId/revoke`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcConsentRevoke({
        context: authenticated.data,
        database: options.database,
        instanceId: oidcParamGet(context, "instanceId"),
        clientId: oidcParamGet(context, "clientId"),
        userId: oidcParamGet(context, "userId"),
      }),
    )
  })

  app.post(`${prefix}/clients`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcClientCreateRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC client request is invalid.",
        op: "oidcClientCreate",
      })
    return oidcResultResponseCreate(
      context,
      oidcClientCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
      201,
    )
  })

  app.get(`${prefix}/clients/:clientId`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcClientGet({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.patch(`${prefix}/clients/:clientId`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcClientUpdateRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC client update is invalid.",
        op: "oidcClientUpdate",
      })
    return oidcResultResponseCreate(
      context,
      oidcClientUpdate({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        input: input.output,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.post(`${prefix}/clients/:clientId/lifecycle`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcClientLifecycleRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC client lifecycle request is invalid.",
        op: "oidcClientLifecycleSet",
      })
    return oidcResultResponseCreate(
      context,
      oidcClientLifecycleSet({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        input: input.output,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.post(`${prefix}/clients/:clientId/secret/rotate`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcClientSecretRotate({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.get(`${prefix}/signing-keys`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcSigningKeyList({
        context: authenticated.data,
        database: options.database,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
    )
  })

  app.post(`${prefix}/signing-keys`, (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    return oidcResultResponseCreate(
      context,
      oidcSigningKeyCreate({
        context: authenticated.data,
        database: options.database,
        encryptionSecret: options.systemSecret,
        instanceId: oidcParamGet(context, "instanceId"),
      }),
      201,
    )
  })

  app.post(`${prefix}/signing-keys/:signingKeyId/lifecycle`, async (context) => {
    const authenticated = authenticate(context)
    if (!authenticated.success) return oidcErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const input = v.safeParse(oidcSigningKeyLifecycleRequestSchema, body.data)
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The signing key lifecycle request is invalid.",
        op: "oidcSigningKeyLifecycleSet",
      })
    return oidcResultResponseCreate(
      context,
      oidcSigningKeyLifecycleSet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        instanceId: oidcParamGet(context, "instanceId"),
        signingKeyId: oidcParamGet(context, "signingKeyId"),
      }),
    )
  })
}

function oidcSystemAuthenticate(authorization: string | undefined, configuredSecret: Secret | string | undefined) {
  const token = oidcBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return { errorMessage: "System authorization is required.", op: "oidcSystemAuthorization", success: false as const }
  return { data: instanceSystemContextCreate(), success: true as const }
}

function oidcTenantAuthenticate(
  database: StorageDatabase,
  host: string | undefined,
  requestUrl: string,
  authorization: string | undefined,
) {
  const tenant = oidcPublicInstanceResolve(database, host, requestUrl)
  if (!tenant.success) return tenant
  return instanceBootstrapAdminAuthenticate({
    context: { ...tenant.data, actor: { ...tenant.data.actor, kind: "anonymous" }, actorId: "anonymous" },
    database,
    secret: oidcBearerTokenGet(authorization) ?? "",
  })
}

function oidcPublicInstanceResolve(database: StorageDatabase, host: string | undefined, requestUrl: string) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : resolvedHost.split(":")[0]
  return instanceTenantContextResolve({ database, host: normalizedHost ?? "" })
}

function oidcBearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer\s+(\S+)$/i.exec(authorization)
  return match?.[1] ?? null
}

function oidcAuthorizationRequestInputCreate(context: {
  req: { query: (name: string) => string | undefined }
}): Record<string, string> {
  const nonce = context.req.query("nonce")
  const prompt = context.req.query("prompt")
  return {
    client_id: context.req.query("client_id") ?? "",
    code_challenge: context.req.query("code_challenge") ?? "",
    code_challenge_method: context.req.query("code_challenge_method") ?? "",
    ...(nonce === undefined ? {} : { nonce }),
    ...(prompt === undefined ? {} : { prompt }),
    redirect_uri: context.req.query("redirect_uri") ?? "",
    response_type: context.req.query("response_type") ?? "",
    scope: context.req.query("scope") ?? "",
    state: context.req.query("state") ?? "",
  }
}

function oidcParamGet(context: { req: { param: (name: string) => string | undefined } }, name: string): string {
  return context.req.param(name) ?? ""
}

function oidcErrorResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { errorMessage: string; op: string },
) {
  const code = oidcErrorCodeGet(result)
  return context.json(
    httpErrorResponseCreate(code, result.errorMessage),
    httpErrorStatusGet(code) as ContentfulStatusCode,
  )
}

function oidcAuthorizationConsentRequiredResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { errorData?: string | null },
) {
  if (result.errorData === undefined || result.errorData === null)
    return context.json({ error: { code: "bad_request", message: "User consent is required." } }, 400)
  try {
    const parsed = v.safeParse(oidcAuthorizationConsentRequiredSchema, JSON.parse(result.errorData))
    if (!parsed.success)
      return context.json({ error: { code: "bad_request", message: "User consent is required." } }, 400)
    return context.json(parsed.output, 200)
  } catch (_error) {
    return context.json({ error: { code: "bad_request", message: "User consent is required." } }, 400)
  }
}

function oidcConsentRedirectCreate(
  context: { redirect: (location: string, status?: 301 | 302 | 303 | 307 | 308) => Response },
  response: OidcAuthorizationConsentResponse,
) {
  const redirect = new URL(response.redirect_uri)
  if (response.approved && response.code !== undefined) {
    redirect.searchParams.set("code", response.code)
  } else {
    redirect.searchParams.set("error", response.error ?? "access_denied")
  }
  redirect.searchParams.set("state", response.state)
  return context.redirect(redirect.toString(), 302)
}

function oidcTokenErrorResponseCreate(
  context: {
    header: (name: string, value: string) => void
    json: (body: unknown, status?: ContentfulStatusCode) => Response
  },
  code:
    | "invalid_client"
    | "invalid_grant"
    | "invalid_request"
    | "invalid_scope"
    | "server_error"
    | "unsupported_grant_type",
  message: string,
  realm = "oauth2/token",
) {
  context.header("cache-control", "no-store")
  context.header("pragma", "no-cache")
  if (code === "invalid_client") context.header("www-authenticate", `Basic realm="${realm}"`)
  return context.json(
    { error: code, error_description: message },
    (code === "invalid_client" ? 401 : code === "server_error" ? 500 : 400) as ContentfulStatusCode,
  )
}

function oidcUserInfoErrorResponseCreate(context: {
  header: (name: string, value: string) => void
  json: (body: unknown, status?: ContentfulStatusCode) => Response
}) {
  context.header("www-authenticate", 'Bearer error="invalid_token", error_description="The access token is invalid."')
  context.header("cache-control", "no-store")
  return context.json({ error: "invalid_token", error_description: "The access token is invalid." }, 401)
}

function oidcTokenRevokeErrorCodeGet(result: { errorMessage: string; op: string }) {
  if (result.op === "oidcTokenRevokeInvalidClient") return "invalid_client" as const
  if (result.op === "oidcTokenRevoke") return "invalid_request" as const
  return "server_error" as const
}

function oidcTokenErrorCodeGet(result: { errorMessage: string; op: string }) {
  if (result.op === "oidcTokenInvalidClient") return "invalid_client" as const
  if (result.op === "oidcTokenInvalidScope") return "invalid_scope" as const
  if (result.op === "oidcTokenInvalidRequest") return "invalid_request" as const
  if (result.op === "oidcTokenInvalidGrant") return "invalid_grant" as const
  return "server_error" as const
}

function oidcErrorCodeGet(result: { errorMessage: string; op: string }): string {
  const message = result.errorMessage.toLowerCase()
  const op = result.op.toLowerCase()
  if (op.includes("oidclogout") || op.includes("oidcauthorizationinteractionrequired")) return "bad_request"
  if (
    op.includes("systemauthorization") ||
    op.includes("authenticate") ||
    message.includes("authentication") ||
    message.includes("session authorization") ||
    message.includes("credentials")
  )
    return "unauthorized"
  if (message.includes("not authorized") || message.includes("forbidden")) return "forbidden"
  if (message.includes("not found") || message.includes("not available") || message.includes("tenant host"))
    return "not_found"
  if (
    message.includes("already") ||
    message.includes("removed") ||
    message.includes("inactive") ||
    message.includes("do not have")
  )
    return "conflict"
  if (
    message.includes("invalid") ||
    message.includes("empty") ||
    message.includes("unique") ||
    message.includes("must")
  )
    return "bad_request"
  return "internal_server_error"
}

function oidcResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; op?: string; success: boolean },
  status = 200,
) {
  if (!result.success) return oidcErrorResponseCreate(context, result as { errorMessage: string; op: string })
  return context.json(result.data, status as ContentfulStatusCode)
}

async function oidcRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return { errorMessage: "The request body is invalid.", op: "oidcRequestJsonRead", success: false as const }
  }
}

async function oidcTokenFormRead(
  context: {
    req: { header: (name: string) => string | undefined; text: () => Promise<string> }
  },
  requestName = "token",
) {
  const contentType = context.req.header("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
  if (contentType !== "application/x-www-form-urlencoded")
    return { errorMessage: `The ${requestName} request must use form encoding.`, success: false as const }
  try {
    const values: Record<string, string> = {}
    for (const [key, value] of new URLSearchParams(await context.req.text()).entries()) {
      if (Object.hasOwn(values, key))
        return { errorMessage: `The ${requestName} request contains duplicate parameters.`, success: false as const }
      values[key] = value
    }
    return { data: values, success: true as const }
  } catch (_error) {
    return { errorMessage: `The ${requestName} request is invalid.`, success: false as const }
  }
}

function oidcTokenClientCredentialsResolve(
  authorization: string | undefined,
  body: Record<string, string>,
):
  | { readonly clientId: string; readonly clientSecret?: string; readonly success: true }
  | { readonly errorMessage: string; readonly success: false } {
  const bodyClientId = body.client_id
  const bodyClientSecret = body.client_secret
  if (authorization === undefined) {
    if (bodyClientId === undefined) return { errorMessage: "Client authentication failed.", success: false }
    return {
      clientId: bodyClientId,
      ...(bodyClientSecret === undefined ? {} : { clientSecret: bodyClientSecret }),
      success: true,
    }
  }
  const basic = /^Basic\s+(\S+)$/i.exec(authorization)
  if (basic === null) return { errorMessage: "Client authentication failed.", success: false }
  try {
    const decoded = Buffer.from(basic[1] ?? "", "base64").toString("utf8")
    const separator = decoded.indexOf(":")
    if (separator < 1 || bodyClientSecret !== undefined)
      return { errorMessage: "Client authentication failed.", success: false }
    const clientId = decoded.slice(0, separator)
    const clientSecret = decoded.slice(separator + 1)
    if (bodyClientId !== undefined && bodyClientId !== clientId)
      return { errorMessage: "Client authentication failed.", success: false }
    return { clientId, clientSecret, success: true }
  } catch (_error) {
    return { errorMessage: "Client authentication failed.", success: false }
  }
}
