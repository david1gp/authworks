import type { Next } from "hono"
import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { realmBootstrapAdminAuthenticate } from "../../realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { sessionAuthenticate } from "../../sessions/actions/sessionAuthenticate.js"
import { sessionBrowserCookieExtract } from "../../sessions/domain/sessionBrowserCookieExtract.js"
import { sessionBrowserCookieSerialize } from "../../sessions/domain/sessionBrowserCookieSerialize.js"
import { sessionCsrfTokenValidate } from "../../sessions/domain/sessionCsrfTokenValidate.js"
import { sessionRequestOriginValidate } from "../../sessions/domain/sessionRequestOriginValidate.js"
import { sessionReturnPathValidate } from "../../sessions/domain/sessionReturnPathValidate.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import { oidcAuthorizationCodeRedeem } from "../actions/oidcAuthorizationCodeRedeem.js"
import { oidcAuthorizationInteractionCreate } from "../actions/oidcAuthorizationInteractionCreate.js"
import { oidcAuthorizationInteractionResolve } from "../actions/oidcAuthorizationInteractionResolve.js"
import { oidcAuthorizationRequestAuthorize } from "../actions/oidcAuthorizationRequestAuthorize.js"
import { oidcAuthorizationRequestConsent } from "../actions/oidcAuthorizationRequestConsent.js"
import { oidcClientCreate } from "../actions/oidcClientCreate.js"
import { oidcClientGet } from "../actions/oidcClientGet.js"
import { oidcClientLifecycleSet } from "../actions/oidcClientLifecycleSet.js"
import { oidcClientList } from "../actions/oidcClientList.js"
import { oidcClientSecretRevoke } from "../actions/oidcClientSecretRevoke.js"
import { oidcClientSecretRotate } from "../actions/oidcClientSecretRotate.js"
import { oidcClientUpdate } from "../actions/oidcClientUpdate.js"
import { oidcConsentList } from "../actions/oidcConsentList.js"
import { oidcConsentRevoke } from "../actions/oidcConsentRevoke.js"
import { oidcDiscoveryGet } from "../actions/oidcDiscoveryGet.js"
import { oidcJwksGet } from "../actions/oidcJwksGet.js"
import { oidcLogout } from "../actions/oidcLogout.js"
import { oidcRefreshTokenFamiliesMeRevokeAll } from "../actions/oidcRefreshTokenFamiliesMeRevokeAll.js"
import { oidcRefreshTokenFamilyMeRevoke } from "../actions/oidcRefreshTokenFamilyMeRevoke.js"
import { oidcRefreshTokenMeList } from "../actions/oidcRefreshTokenMeList.js"
import { oidcSigningKeyCreate } from "../actions/oidcSigningKeyCreate.js"
import { oidcSigningKeyEnsureActive } from "../actions/oidcSigningKeyEnsureActive.js"
import { oidcSigningKeyLifecycleSet } from "../actions/oidcSigningKeyLifecycleSet.js"
import { oidcSigningKeyList } from "../actions/oidcSigningKeyList.js"
import { oidcTokenIssue } from "../actions/oidcTokenIssue.js"
import { oidcTokenRevoke } from "../actions/oidcTokenRevoke.js"
import { oidcUserInfoGet } from "../actions/oidcUserInfoGet.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { oidcAuthorizationCodeRedeemRequestSchema } from "../public/oidcAuthorizationCodeRedeemRequestSchema.js"
import { oidcAuthorizationConsentRequestSchema } from "../public/oidcAuthorizationConsentRequestSchema.js"
import { oidcAuthorizationConsentRequiredSchema } from "../public/oidcAuthorizationConsentRequiredSchema.js"
import type { OidcAuthorizationConsentResponse } from "../public/oidcAuthorizationConsentResponseSchema.js"
import { oidcAuthorizationRequestSchema } from "../public/oidcAuthorizationRequestSchema.js"
import { oidcClientCreateRequestSchema } from "../public/oidcClientCreateRequestSchema.js"
import { oidcClientLifecycleRequestSchema } from "../public/oidcClientLifecycleRequestSchema.js"
import { oidcClientUpdateRequestSchema } from "../public/oidcClientUpdateRequestSchema.js"
import { oidcConsentRevokeRequestSchema } from "../public/oidcConsentRevokeRequestSchema.js"
import { oidcLogoutRequestSchema } from "../public/oidcLogoutRequestSchema.js"
import { oidcSigningKeyLifecycleRequestSchema } from "../public/oidcSigningKeyLifecycleRequestSchema.js"
import { oidcTokenRequestSchema } from "../public/oidcTokenRequestSchema.js"
import { oidcTokenRevokeRequestSchema } from "../public/oidcTokenRevokeRequestSchema.js"

type OidcServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly publicOrigin?: string
  readonly systemSecret?: Secret | string
}

type OidcRequestContext = ReturnType<typeof realmSystemContextCreate> | RealmTenantContext

type OidcServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
  }
}

export function oidcServerAppCreate(options: OidcServerAppCreateOptions) {
  const app = new Hono<OidcServerEnv>()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    minimumAssurance: "authenticated",
    publicOrigin: options.publicOrigin,
  })
  const tenantManagementMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    fallback: (context, next) => oidcTenantBootstrapFallback(options.database, context, next),
    publicOrigin: options.publicOrigin,
  })
  app.get("/realms/:realmId/me/consents", protectedMiddleware, (context) => {
    const subject = oidcSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return oidcManagementErrorResponseCreate(context, subject)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return oidcManagementErrorResponseCreate(context, query)
    return oidcManagementResultResponseCreate(
      context,
      oidcConsentList({
        context: subject.data,
        database: options.database,
        realmId: context.req.param("realmId"),
        query: query.data,
        userId: subject.data.actorId,
      }),
    )
  })

  app.post("/realms/:realmId/me/consents/:clientId/revoke", protectedMiddleware, (context) => {
    const subject = oidcSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return oidcManagementErrorResponseCreate(context, subject)
    return oidcManagementResultResponseCreate(
      context,
      oidcConsentRevoke({
        context: subject.data,
        database: options.database,
        realmId: context.req.param("realmId"),
        clientId: context.req.param("clientId"),
        userId: subject.data.actorId,
      }),
    )
  })
  app.get("/realms/:realmId/me/refresh-tokens", protectedMiddleware, (context) => {
    const subject = oidcSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return oidcManagementErrorResponseCreate(context, subject)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return oidcManagementErrorResponseCreate(context, query)
    return oidcManagementResultResponseCreate(
      context,
      oidcRefreshTokenMeList({
        database: options.database,
        query: query.data,
        realmId: context.req.param("realmId"),
        userId: subject.data.actorId,
      }),
    )
  })

  app.post("/realms/:realmId/me/refresh-tokens/revoke-all", protectedMiddleware, (context) => {
    const subject = oidcSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return oidcManagementErrorResponseCreate(context, subject)
    return oidcManagementResultResponseCreate(
      context,
      oidcRefreshTokenFamiliesMeRevokeAll({
        database: options.database,
        realmId: context.req.param("realmId"),
        userId: subject.data.actorId,
      }),
    )
  })
  app.post("/realms/:realmId/me/refresh-tokens/:familyId/revoke", protectedMiddleware, (context) => {
    const subject = oidcSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return oidcManagementErrorResponseCreate(context, subject)
    return oidcManagementResultResponseCreate(
      context,
      oidcRefreshTokenFamilyMeRevoke({
        database: options.database,
        familyId: context.req.param("familyId"),
        realmId: context.req.param("realmId"),
        userId: subject.data.actorId,
      }),
    )
  })
  oidcManagementRoutesRegister(app, options, "/system/realms/:realmId/oidc", (context) =>
    oidcSystemAuthenticate(context.req.header("authorization"), options.systemSecret),
  )
  oidcManagementRoutesRegister(
    app,
    options,
    "/realms/:realmId/oidc",
    (context) => oidcTenantAuthenticate(context),
    tenantManagementMiddleware,
    true,
  )

  app.get("/.well-known/openid-configuration", (context) => {
    const realm = oidcPublicRealmResolve(options.database, context.req.header("host"), context.req.url)
    if (!realm.success) return oidcErrorResponseCreate(context, realm)
    const discovery = oidcDiscoveryGet({ database: options.database, realmId: realm.data.realmId })
    if (!discovery.success) return oidcErrorResponseCreate(context, discovery)
    return context.json(discovery.data)
  })

  app.get("/.well-known/jwks.json", (context) => {
    const realm = oidcPublicRealmResolve(options.database, context.req.header("host"), context.req.url)
    if (!realm.success) return oidcErrorResponseCreate(context, realm)
    const jwks = oidcJwksGet({ database: options.database, realmId: realm.data.realmId })
    if (!jwks.success) return oidcErrorResponseCreate(context, jwks)
    return context.json(jwks.data)
  })

  app.get("/oauth2/authorize", (context) => {
    const realm = oidcPublicRealmResolve(options.database, context.req.header("host"), context.req.url)
    if (!realm.success) return oidcErrorResponseCreate(context, realm)
    const interactionHandle = context.req.query("interaction")
    if (interactionHandle !== undefined)
      return oidcAuthorizationInteractionResume(context, options, realm.data.realmId, interactionHandle)
    const input = v.safeParse(oidcAuthorizationRequestSchema, oidcAuthorizationRequestInputCreate(context))
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC authorization request is invalid.",
        op: "oidcAuthorizationRequestAuthorize",
      })
    const browser = oidcBrowserSessionResolve(context, options.database, realm.data.realmId)
    if (!browser.success && oidcHtmlRequestIsBrowser(context) && context.req.header("authorization") === undefined) {
      const interaction = oidcAuthorizationInteractionCreate({
        database: options.database,
        encryptionSecret: options.systemSecret,
        input: input.output,
        publicOrigin: options.publicOrigin ?? oidcRequestOriginGet(context),
        realmId: realm.data.realmId,
      })
      if (!interaction.success) return oidcErrorResponseCreate(context, interaction)
      return oidcLoginRedirectCreate(context, interaction.data, options.publicOrigin ?? oidcRequestOriginGet(context))
    }
    const authorization = oidcAuthorizationRequestAuthorize({
      database: options.database,
      encryptionSecret: options.systemSecret,
      input: input.output,
      realmId: realm.data.realmId,
      sessionToken: browser.success
        ? browser.data.token
        : (oidcBearerTokenGet(context.req.header("authorization")) ?? ""),
    })
    if (!authorization.success) {
      if (authorization.op === "oidcAuthorizationConsentRequired" && oidcHtmlRequestIsBrowser(context)) {
        const interaction = oidcAuthorizationInteractionCreate({
          database: options.database,
          encryptionSecret: options.systemSecret,
          input: input.output,
          publicOrigin: options.publicOrigin ?? oidcRequestOriginGet(context),
          realmId: realm.data.realmId,
        })
        if (!interaction.success) return oidcErrorResponseCreate(context, interaction)
        if (!browser.success) return oidcErrorResponseCreate(context, browser)
        const bound = oidcInteractionBind(options.database, realm.data.realmId, interaction.data.handle, browser.data)
        if (!bound.success) return oidcErrorResponseCreate(context, bound)
        const requestId = oidcAuthorizationRequestIdGet(authorization)
        if (requestId === undefined) return oidcErrorResponseCreate(context, authorization)
        const attached = oidcInteractionAuthorizationRequestSet(
          options.database,
          realm.data.realmId,
          interaction.data.handle,
          requestId,
        )
        if (!attached.success) return oidcErrorResponseCreate(context, attached)
        return oidcConsentRedirectCreateHosted(
          context,
          {
            binding: interaction.data.binding,
            handle: interaction.data.handle,
            resumePath: interaction.data.resumePath,
          },
          options.publicOrigin ?? oidcRequestOriginGet(context),
        )
      }
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
    const realm = oidcPublicRealmResolve(options.database, context.req.header("host"), context.req.url)
    if (!realm.success) return oidcErrorResponseCreate(context, realm)
    const body = oidcHtmlRequestIsBrowser(context)
      ? await oidcConsentFormRead(context)
      : await oidcRequestJsonRead(context)
    if (!body.success) return oidcErrorResponseCreate(context, body)
    const consentBody = body.data as {
      readonly decision?: string
      readonly interaction?: string
      readonly request_id?: string
    }
    const interactionHandle = oidcHtmlRequestIsBrowser(context) ? consentBody.interaction : undefined
    const interaction =
      interactionHandle === undefined
        ? undefined
        : oidcAuthorizationInteractionResolve({
            binding: oidcInteractionBindingGet(context),
            database: options.database,
            encryptionSecret: options.systemSecret,
            handle: interactionHandle,
            publicOrigin: options.publicOrigin ?? oidcRequestOriginGet(context),
            realmId: realm.data.realmId,
          })
    if (interaction !== undefined && !interaction.success) return oidcErrorResponseCreate(context, interaction)
    const browser = oidcBrowserSessionResolve(context, options.database, realm.data.realmId)
    if (oidcHtmlRequestIsBrowser(context) && !browser.success) {
      if (interaction?.success)
        return oidcLoginRedirectCreate(
          context,
          {
            binding: oidcInteractionBindingGet(context) ?? "",
            handle: interactionHandle ?? "",
            resumePath: interaction.data.interaction.resumePath,
          },
          options.publicOrigin ?? oidcRequestOriginGet(context),
        )
      return oidcErrorResponseCreate(context, browser)
    }
    if (context.req.header("authorization") === undefined && oidcSessionCookiePresent(context)) {
      const csrf = oidcBrowserUnsafeRequestValidate(context, options.publicOrigin ?? oidcRequestOriginGet(context))
      if (!csrf.success) return oidcErrorResponseCreate(context, csrf)
    }
    const input = v.safeParse(
      oidcAuthorizationConsentRequestSchema,
      interaction?.success
        ? {
            decision: consentBody.decision,
            request_id: interaction.data.interaction.authorizationRequestId ?? "",
          }
        : consentBody,
    )
    if (!input.success)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC consent request is invalid.",
        op: "oidcAuthorizationRequestConsent",
      })
    const consent = oidcAuthorizationRequestConsent({
      database: options.database,
      encryptionSecret: options.systemSecret,
      input: input.output,
      realmId: realm.data.realmId,
      sessionToken: browser.success
        ? browser.data.token
        : (oidcBearerTokenGet(context.req.header("authorization")) ?? ""),
    })
    if (!consent.success) return oidcErrorResponseCreate(context, consent)
    if (interaction?.success) {
      const completed = oidcInteractionComplete(options.database, realm.data.realmId, interactionHandle ?? "")
      if (!completed.success) return oidcErrorResponseCreate(context, completed)
      oidcInteractionCookieClear(context)
    }
    if (context.req.header("accept")?.includes("application/json")) return context.json(consent.data)
    return oidcConsentRedirectCreate(context, consent.data)
  })

  app.post("/oauth2/consent/revoke", async (context) => {
    const realm = oidcPublicRealmResolve(options.database, context.req.header("host"), context.req.url)
    if (!realm.success) return oidcErrorResponseCreate(context, realm)
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
        realmId: realm.data.realmId,
        clientId: input.output.client_id,
        sessionToken: oidcBearerTokenGet(context.req.header("authorization")) ?? "",
      }),
    )
  })

  const oidcLogoutRoute = (context: {
    header: (name: string, value: string, options?: { readonly append?: boolean }) => void
    req: {
      header: (name: string) => string | undefined
      query: (name: string) => string | undefined
      url: string
    }
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    redirect: (location: string, status?: 301 | 302 | 303 | 307 | 308) => Response
  }) => {
    const realm = oidcPublicRealmResolve(options.database, context.req.header("host"), context.req.url)
    if (!realm.success) return oidcErrorResponseCreate(context, realm)
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
      realmId: realm.data.realmId,
      sessionToken: oidcBrowserSessionTokenGet(context),
    })
    if (!loggedOut.success) return oidcErrorResponseCreate(context, loggedOut)
    if (context.req.header("authorization") === undefined && oidcSessionCookiePresent(context))
      oidcSessionCookieClear(context)
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
    const realm = oidcPublicRealmResolve(options.database, context.req.header("host"), context.req.url)
    if (!realm.success) return oidcErrorResponseCreate(context, realm)
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
        realmId: realm.data.realmId,
      }),
    )
  })

  app.post("/oauth2/token", async (context) => {
    const stage = oidcTokenStageReporterCreate()
    const realm = oidcPublicRealmResolve(options.database, context.req.header("host"), context.req.url)
    if (!realm.success) {
      stage.report("unexpected")
      return oidcTokenErrorResponseCreate(context, "invalid_request", "The token request is invalid.")
    }
    const body = await oidcTokenFormRead(context)
    if (!body.success) {
      stage.report("request_parse")
      return oidcTokenErrorResponseCreate(context, "invalid_request", body.errorMessage)
    }
    const authorizationCodeRequest = body.data.grant_type === "authorization_code"
    if (
      body.data.grant_type !== undefined &&
      body.data.grant_type !== "authorization_code" &&
      body.data.grant_type !== "refresh_token" &&
      body.data.grant_type !== "client_credentials"
    )
      return oidcTokenErrorResponseCreate(context, "unsupported_grant_type", "The grant type is not supported.")
    const credentials = oidcTokenClientCredentialsResolve(context.req.header("authorization"), body.data)
    if (!credentials.success) {
      if (authorizationCodeRequest) stage.report("client_auth")
      return oidcTokenErrorResponseCreate(context, "invalid_client", credentials.errorMessage)
    }
    const input = v.safeParse(oidcTokenRequestSchema, {
      ...body.data,
      client_id: credentials.clientId,
      ...(credentials.clientSecret === undefined ? {} : { client_secret: credentials.clientSecret }),
    })
    if (!input.success) {
      if (authorizationCodeRequest) stage.report("token_schema")
      return oidcTokenErrorResponseCreate(context, "invalid_request", "The token request is invalid.")
    }
    const token = oidcTokenIssue({
      database: options.database,
      encryptionSecret: options.systemSecret,
      input: input.output,
      ...(authorizationCodeRequest ? { onStage: stage.report } : {}),
      realmId: realm.data.realmId,
    })
    if (!token.success) {
      if (authorizationCodeRequest && !stage.reported()) stage.report("unexpected")
      return oidcTokenErrorResponseCreate(context, oidcTokenErrorCodeResolve(token), token.errorMessage)
    }
    context.header("cache-control", "no-store")
    context.header("pragma", "no-cache")
    return context.json(token.data)
  })

  app.get("/oauth2/userinfo", (context) => {
    const realm = oidcPublicRealmResolve(options.database, context.req.header("host"), context.req.url)
    if (!realm.success) return oidcUserInfoErrorResponseCreate(context)
    const token = oidcBearerTokenGet(context.req.header("authorization"))
    if (token === null) return oidcUserInfoErrorResponseCreate(context)
    const userInfo = oidcUserInfoGet({
      database: options.database,
      realmId: realm.data.realmId,
      token,
    })
    if (!userInfo.success) return oidcUserInfoErrorResponseCreate(context)
    context.header("cache-control", "no-store")
    return context.json(userInfo.data)
  })

  app.post("/oauth2/userinfo", (context) => {
    const realm = oidcPublicRealmResolve(options.database, context.req.header("host"), context.req.url)
    if (!realm.success) return oidcUserInfoErrorResponseCreate(context)
    const token = oidcBearerTokenGet(context.req.header("authorization"))
    if (token === null) return oidcUserInfoErrorResponseCreate(context)
    const userInfo = oidcUserInfoGet({
      database: options.database,
      realmId: realm.data.realmId,
      token,
    })
    if (!userInfo.success) return oidcUserInfoErrorResponseCreate(context)
    context.header("cache-control", "no-store")
    return context.json(userInfo.data)
  })

  app.post("/oauth2/revoke", async (context) => {
    const realm = oidcPublicRealmResolve(options.database, context.req.header("host"), context.req.url)
    if (!realm.success)
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
      realmId: realm.data.realmId,
    })
    if (!revoked.success)
      return oidcTokenErrorResponseCreate(
        context,
        oidcTokenRevokeErrorCodeResolve(revoked),
        revoked.errorMessage,
        "oauth2/revoke",
      )
    context.header("cache-control", "no-store")
    context.header("pragma", "no-cache")
    return new Response(null, { status: 200 })
  })
  return app
}

type OidcAuthenticatedSession =
  Extract<ReturnType<typeof sessionAuthenticate>, { success: true }> extends {
    readonly data: infer Data
  }
    ? Data
    : never

type OidcBrowserSession = OidcAuthenticatedSession & {
  readonly token: string
}

type OidcInteractionContext = {
  readonly header: (name: string, value: string, options?: { readonly append?: boolean }) => void
  readonly json: (body: unknown, status?: ContentfulStatusCode) => Response
  readonly redirect: (location: string, status?: 301 | 302 | 303 | 307 | 308) => Response
  readonly req: {
    readonly header: (name: string) => string | undefined
    readonly method: string
    readonly query: (name: string) => string | undefined
    readonly raw: Request
    readonly url: string
  }
}

function oidcAuthorizationInteractionResume(
  context: OidcInteractionContext,
  options: OidcServerAppCreateOptions,
  realmId: string,
  handle: string,
) {
  const publicOrigin = options.publicOrigin ?? oidcRequestOriginGet(context)
  const interaction = oidcAuthorizationInteractionResolve({
    binding: oidcInteractionBindingGet(context),
    database: options.database,
    encryptionSecret: options.systemSecret,
    handle,
    publicOrigin,
    realmId,
  })
  if (!interaction.success) return oidcErrorResponseCreate(context, interaction)
  const requestedResumePath = context.req.query("return_to")
  if (requestedResumePath !== undefined) {
    const validated = sessionReturnPathValidate(requestedResumePath, publicOrigin)
    if (!validated.success || validated.data !== interaction.data.interaction.resumePath)
      return oidcErrorResponseCreate(context, {
        errorMessage: "The OIDC interaction is invalid.",
        op: "oidcAuthorizationInteractionResume",
      })
  }
  const browser = oidcBrowserSessionResolve(context, options.database, realmId)
  if (!browser.success) {
    if (oidcHtmlRequestIsBrowser(context) && context.req.header("authorization") === undefined)
      return oidcLoginRedirectCreate(
        context,
        {
          binding: oidcInteractionBindingGet(context) ?? "",
          expiresAt: interaction.data.interaction.expiresAt,
          handle,
          resumePath: interaction.data.interaction.resumePath,
        },
        publicOrigin,
      )
    return oidcErrorResponseCreate(context, browser)
  }
  if (
    browser.data.actor.kind !== "user" ||
    (interaction.data.interaction.sessionId !== null &&
      interaction.data.interaction.sessionId !== browser.data.session.id) ||
    (interaction.data.interaction.userId !== null && interaction.data.interaction.userId !== browser.data.actor.actorId)
  )
    return oidcErrorResponseCreate(context, {
      errorMessage: "The OIDC interaction is invalid.",
      op: "oidcAuthorizationInteractionResume",
    })
  const bound = oidcInteractionBind(options.database, realmId, handle, browser.data)
  if (!bound.success) return oidcErrorResponseCreate(context, bound)
  if (interaction.data.interaction.authorizationRequestId !== null)
    return oidcConsentRedirectCreateHosted(
      context,
      {
        binding: oidcInteractionBindingGet(context) ?? "",
        expiresAt: interaction.data.interaction.expiresAt,
        handle,
        resumePath: interaction.data.interaction.resumePath,
      },
      publicOrigin,
    )

  const authorization = oidcAuthorizationRequestAuthorize({
    database: options.database,
    encryptionSecret: options.systemSecret,
    input: interaction.data.input,
    realmId,
    sessionToken: browser.data.token,
  })
  if (!authorization.success) {
    if (authorization.op !== "oidcAuthorizationConsentRequired") return oidcErrorResponseCreate(context, authorization)
    const requestId = oidcAuthorizationRequestIdGet(authorization)
    if (requestId === undefined) return oidcErrorResponseCreate(context, authorization)
    const attached = oidcInteractionAuthorizationRequestSet(options.database, realmId, handle, requestId)
    if (!attached.success) return oidcErrorResponseCreate(context, attached)
    return oidcConsentRedirectCreateHosted(
      context,
      {
        binding: oidcInteractionBindingGet(context) ?? "",
        expiresAt: interaction.data.interaction.expiresAt,
        handle,
        resumePath: interaction.data.interaction.resumePath,
      },
      publicOrigin,
    )
  }
  const completed = oidcInteractionComplete(options.database, realmId, handle)
  if (!completed.success) return oidcErrorResponseCreate(context, completed)
  oidcInteractionCookieClear(context)
  if (context.req.header("accept")?.includes("application/json")) return context.json(authorization.data)
  return oidcAuthorizationRedirectCreate(context, authorization.data)
}

function oidcBrowserSessionResolve(
  context: { req: { header: (name: string) => string | undefined } },
  database: StorageDatabase,
  realmId: string,
): Result<OidcBrowserSession> {
  const authorization = context.req.header("authorization")
  const token =
    authorization === undefined
      ? sessionBrowserCookieExtract(context.req.header("cookie"), "session")
      : resultCreate(oidcBearerTokenGet(authorization) ?? "")
  if (!token.success || token.data === undefined || token.data.length === 0)
    return resultErrorCreate("oidcBrowserSessionResolve", "Session authorization is required.")
  const tokenValue = token.data
  const authenticated = sessionAuthenticate({ database, realmId, token: tokenValue })
  if (!authenticated.success)
    return resultErrorCreate("oidcBrowserSessionResolve", "Session authorization is required.")
  return resultCreate({ ...authenticated.data, token: tokenValue })
}

function oidcBrowserSessionTokenGet(context: {
  req: { header: (name: string) => string | undefined }
}): string | undefined {
  const authorization = context.req.header("authorization")
  if (authorization !== undefined) return oidcBearerTokenGet(authorization) ?? undefined
  const cookie = sessionBrowserCookieExtract(context.req.header("cookie"), "session")
  return cookie.success ? cookie.data : undefined
}

function oidcHtmlRequestIsBrowser(context: { req: { header: (name: string) => string | undefined } }): boolean {
  const accept = context.req.header("accept") ?? ""
  return accept.includes("text/html") && !accept.includes("application/json")
}

function oidcRequestOriginGet(context: { req: { url: string } }): string {
  try {
    return new URL(context.req.url).origin
  } catch (_error) {
    return "http://127.0.0.1:3000"
  }
}

function oidcLoginRedirectCreate(
  context: OidcInteractionContext,
  interaction: {
    readonly binding: string
    readonly expiresAt?: number
    readonly handle: string
    readonly resumePath: string
  },
  publicOrigin: string,
) {
  const loginPath = `/login?interaction=${encodeURIComponent(interaction.handle)}&return_to=${encodeURIComponent(interaction.resumePath)}`
  const validated = sessionReturnPathValidate(loginPath, publicOrigin)
  if (!validated.success) return oidcErrorResponseCreate(context, validated)
  const cookie = sessionBrowserCookieSerialize("oidc-interaction", interaction.binding)
  if (!cookie.success) return oidcErrorResponseCreate(context, cookie)
  context.header("set-cookie", cookie.data)
  return context.redirect(validated.data, 302)
}

function oidcConsentRedirectCreateHosted(
  context: OidcInteractionContext,
  interaction: {
    readonly binding: string
    readonly expiresAt?: number
    readonly handle: string
    readonly resumePath: string
  },
  publicOrigin: string,
) {
  const consentPath = `/consent?interaction=${encodeURIComponent(interaction.handle)}&return_to=${encodeURIComponent(interaction.resumePath)}`
  const validated = sessionReturnPathValidate(consentPath, publicOrigin)
  if (!validated.success) return oidcErrorResponseCreate(context, validated)
  const cookie = sessionBrowserCookieSerialize("oidc-interaction", interaction.binding)
  if (!cookie.success) return oidcErrorResponseCreate(context, cookie)
  context.header("set-cookie", cookie.data)
  return context.redirect(validated.data, 302)
}

function oidcAuthorizationRedirectCreate(
  context: { redirect: (location: string, status?: 301 | 302 | 303 | 307 | 308) => Response },
  response: { readonly code: string; readonly redirect_uri: string; readonly state: string },
) {
  const redirect = new URL(response.redirect_uri)
  redirect.searchParams.set("code", response.code)
  redirect.searchParams.set("state", response.state)
  return context.redirect(redirect.toString(), 302)
}

function oidcInteractionBindingGet(context: {
  req: { header: (name: string) => string | undefined }
}): string | undefined {
  const binding = sessionBrowserCookieExtract(context.req.header("cookie"), "oidc-interaction")
  return binding.success && binding.data !== undefined ? binding.data : undefined
}

function oidcInteractionBind(
  database: StorageDatabase,
  realmId: string,
  handle: string,
  session: OidcBrowserSession,
): Result<void> {
  const existing = oidcRepositoryCreate(database.db).interactionGetByHandleHash(realmId, oidcHashCreate(handle))
  if (!existing.success) return existing
  if (existing.data === null) return resultErrorCreate("oidcInteractionBind", "The OIDC interaction is invalid.")
  if (
    (existing.data.sessionId !== null && existing.data.sessionId !== session.session.id) ||
    (existing.data.userId !== null && existing.data.userId !== session.actor.actorId)
  )
    return resultErrorCreate("oidcInteractionBind", "The OIDC interaction is invalid.")
  if (existing.data.sessionId !== null && existing.data.userId !== null) return resultCreate(undefined)
  const bound = oidcRepositoryCreate(database.db).interactionBind(
    realmId,
    existing.data.id,
    session.session.id,
    session.actor.actorId,
  )
  if (!bound.success) return bound
  if (bound.data === null) return resultErrorCreate("oidcInteractionBind", "The OIDC interaction is invalid.")
  return resultCreate(undefined)
}

function oidcInteractionAuthorizationRequestSet(
  database: StorageDatabase,
  realmId: string,
  handle: string,
  authorizationRequestId: string,
): Result<void> {
  const existing = oidcRepositoryCreate(database.db).interactionGetByHandleHash(realmId, oidcHashCreate(handle))
  if (!existing.success) return existing
  if (existing.data === null)
    return resultErrorCreate("oidcInteractionAuthorizationRequestSet", "The OIDC interaction is invalid.")
  if (existing.data.authorizationRequestId !== null && existing.data.authorizationRequestId !== authorizationRequestId)
    return resultErrorCreate("oidcInteractionAuthorizationRequestSet", "The OIDC interaction is invalid.")
  if (existing.data.authorizationRequestId !== null) return resultCreate(undefined)
  const attached = oidcRepositoryCreate(database.db).interactionAuthorizationRequestSet(
    realmId,
    existing.data.id,
    authorizationRequestId,
  )
  if (!attached.success) return attached
  if (attached.data === null)
    return resultErrorCreate("oidcInteractionAuthorizationRequestSet", "The OIDC interaction is invalid.")
  return resultCreate(undefined)
}

function oidcInteractionComplete(database: StorageDatabase, realmId: string, handle: string): Result<void> {
  const existing = oidcRepositoryCreate(database.db).interactionGetByHandleHash(realmId, oidcHashCreate(handle))
  if (!existing.success) return existing
  if (existing.data === null) return resultErrorCreate("oidcInteractionComplete", "The OIDC interaction is invalid.")
  const completed = oidcRepositoryCreate(database.db).interactionComplete(
    realmId,
    existing.data.id,
    database.runtime.now(),
  )
  if (!completed.success) return completed
  if (completed.data === null) return resultErrorCreate("oidcInteractionComplete", "The OIDC interaction is invalid.")
  return resultCreate(undefined)
}

function oidcInteractionCookieClear(context: OidcInteractionContext): void {
  const cookie = sessionBrowserCookieSerialize("oidc-interaction", "", { expires: new Date(0), maxAge: 0 })
  if (cookie.success) context.header("set-cookie", cookie.data, { append: true })
}

function oidcBrowserUnsafeRequestValidate(
  context: { req: { header: (name: string) => string | undefined; raw: Request } },
  publicOrigin: string,
): Result<void> {
  if (context.req.header("authorization") !== undefined || !oidcSessionCookiePresent(context))
    return resultCreate(undefined)
  const origin = sessionRequestOriginValidate(context.req.raw, publicOrigin)
  if (!origin.success || !origin.data)
    return resultErrorCreate("oidcBrowserUnsafeRequestValidate", "The request origin is invalid.")
  const csrfCookie = sessionBrowserCookieExtract(context.req.header("cookie"), "csrf")
  if (!csrfCookie.success || !sessionCsrfTokenValidate(context.req.header("x-csrf-token"), csrfCookie.data))
    return resultErrorCreate("oidcBrowserUnsafeRequestValidate", "The CSRF token is invalid.")
  return resultCreate(undefined)
}

function oidcSessionCookiePresent(context: { req: { header: (name: string) => string | undefined } }): boolean {
  const cookie = sessionBrowserCookieExtract(context.req.header("cookie"), "session")
  return cookie.success && cookie.data !== undefined
}

function oidcSessionCookieClear(context: {
  header: (name: string, value: string, options?: { readonly append?: boolean }) => void
}) {
  const cookie = sessionBrowserCookieSerialize("session", "", { expires: new Date(0), maxAge: 0 })
  if (cookie.success) context.header("set-cookie", cookie.data)
}

function oidcAuthorizationRequestIdGet(result: { errorData?: string | null }): string | undefined {
  if (result.errorData === undefined || result.errorData === null) return undefined
  try {
    const parsed = v.safeParse(oidcAuthorizationConsentRequiredSchema, JSON.parse(result.errorData))
    return parsed.success ? parsed.output.request_id : undefined
  } catch (_error) {
    return undefined
  }
}

async function oidcConsentFormRead(context: {
  req: { header: (name: string) => string | undefined; text: () => Promise<string> }
}) {
  if (
    context.req.header("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/x-www-form-urlencoded"
  )
    return {
      errorMessage: "The consent request must use form encoding.",
      op: "oidcConsentFormRead",
      success: false as const,
    }
  try {
    const data: Record<string, string> = {}
    for (const [key, value] of new URLSearchParams(await context.req.text()).entries()) {
      if (Object.hasOwn(data, key))
        return { errorMessage: "The consent request is invalid.", op: "oidcConsentFormRead", success: false as const }
      data[key] = value
    }
    return {
      data: {
        ...(data.decision === undefined ? {} : { decision: data.decision }),
        ...(data.interaction === undefined ? {} : { interaction: data.interaction }),
        ...(data.request_id === undefined ? {} : { request_id: data.request_id }),
      },
      success: true as const,
    }
  } catch (_error) {
    return { errorMessage: "The consent request is invalid.", op: "oidcConsentFormRead", success: false as const }
  }
}

function oidcSubjectContextResolve(
  context: { readonly get: (key: "authorizationActor") => AuthorizationActorContext },
  realmId: string,
): Result<RealmTenantContext> {
  const op = "oidcSubjectContextResolve"
  const actor = context.get("authorizationActor")
  if (actor.kind !== "user" || actor.realmId !== realmId)
    return resultErrorCodedCreate(op, "The authenticated user is not available in this realm.", "oidc.forbidden")
  return { data: { actor, actorId: actor.actorId, kind: "tenant", realmId }, success: true }
}

function oidcManagementRoutesRegister(
  app: Hono<OidcServerEnv>,
  options: OidcServerAppCreateOptions,
  prefix: string,
  authenticate: (context: {
    req: {
      header: (name: string) => string | undefined
      param: (name: string) => string | undefined
      url: string
    }
    get: (key: "authorizationActor") => AuthorizationActorContext
  }) => { data: OidcRequestContext; success: true } | { errorMessage: string; op: string; success: false },
  middleware?: ReturnType<typeof sessionProtectedMiddlewareCreate>,
  administrator = false,
) {
  const routeAuthenticate = (
    context: {
      get: (key: "authorizationActor") => AuthorizationActorContext
      req: {
        header: (name: string) => string | undefined
        param: (name: string) => string | undefined
        url: string
      }
    },
    permission: AuthorizationPermission,
    minimumAssurance?: "authenticated" | "multi_factor",
  ) => {
    const authenticated = authenticate(context)
    if (!authenticated.success || !administrator) return authenticated
    return realmAdministratorContextAuthorize({
      actor: context.get("authorizationActor"),
      database: options.database,
      minimumAssurance,
      permission,
      realmId: oidcParamGet(context, "realmId"),
    })
  }
  if (middleware !== undefined) app.use(`${prefix}/*`, middleware)

  app.get(`${prefix}/clients`, (context) => {
    const authenticated = routeAuthenticate(context, authorizationPermissionDefinitions.oidcRead)
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return oidcManagementErrorResponseCreate(context, query)
    return oidcManagementResultResponseCreate(
      context,
      oidcClientList({
        context: authenticated.data,
        database: options.database,
        realmId: oidcParamGet(context, "realmId"),
        query: query.data,
      }),
    )
  })

  app.get(`${prefix}/consents/:userId`, (context) => {
    const authenticated = routeAuthenticate(context, authorizationPermissionDefinitions.oidcRead)
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return oidcManagementErrorResponseCreate(context, query)
    return oidcManagementResultResponseCreate(
      context,
      oidcConsentList({
        context: authenticated.data,
        database: options.database,
        administrator,
        realmId: oidcParamGet(context, "realmId"),
        userId: oidcParamGet(context, "userId"),
        query: query.data,
      }),
    )
  })

  app.post(`${prefix}/consents/:userId/:clientId/revoke`, (context) => {
    const authenticated = routeAuthenticate(context, authorizationPermissionDefinitions.oidcWrite)
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    return oidcManagementResultResponseCreate(
      context,
      oidcConsentRevoke({
        context: authenticated.data,
        database: options.database,
        administrator,
        realmId: oidcParamGet(context, "realmId"),
        clientId: oidcParamGet(context, "clientId"),
        userId: oidcParamGet(context, "userId"),
      }),
    )
  })

  app.post(`${prefix}/clients`, async (context) => {
    const authenticated = routeAuthenticate(context, authorizationPermissionDefinitions.oidcWrite)
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcManagementErrorResponseCreate(context, body)
    const input = v.safeParse(oidcClientCreateRequestSchema, body.data)
    if (!input.success)
      return oidcManagementErrorResponseCreate(
        context,
        resultErrorCodedCreate("oidcClientCreate", "The OIDC client request is invalid.", "oidc.invalid"),
      )
    return oidcManagementResultResponseCreate(
      context,
      oidcClientCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: oidcParamGet(context, "realmId"),
      }),
      201,
    )
  })

  app.get(`${prefix}/clients/:clientId`, (context) => {
    const authenticated = routeAuthenticate(context, authorizationPermissionDefinitions.oidcRead)
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    const result = oidcClientGet({
      clientId: oidcParamGet(context, "clientId"),
      context: authenticated.data,
      database: options.database,
      realmId: oidcParamGet(context, "realmId"),
    })
    return oidcManagementResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.client.updatedAt) : undefined,
    )
  })

  app.patch(`${prefix}/clients/:clientId`, async (context) => {
    const authenticated = routeAuthenticate(context, authorizationPermissionDefinitions.oidcWrite)
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcManagementErrorResponseCreate(context, body)
    const input = v.safeParse(oidcClientUpdateRequestSchema, body.data)
    if (!input.success)
      return oidcManagementErrorResponseCreate(
        context,
        resultErrorCodedCreate("oidcClientUpdate", "The OIDC client update is invalid.", "oidc.invalid"),
      )
    return oidcManagementResultResponseCreate(
      context,
      oidcClientUpdate({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: oidcParamGet(context, "realmId"),
      }),
    )
  })

  app.post(`${prefix}/clients/:clientId/lifecycle`, async (context) => {
    const authenticated = routeAuthenticate(context, authorizationPermissionDefinitions.oidcWrite)
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcManagementErrorResponseCreate(context, body)
    const input = v.safeParse(oidcClientLifecycleRequestSchema, body.data)
    if (!input.success)
      return oidcManagementErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "oidcClientLifecycleSet",
          "The OIDC client lifecycle request is invalid.",
          "oidc.invalid",
        ),
      )
    return oidcManagementResultResponseCreate(
      context,
      oidcClientLifecycleSet({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: oidcParamGet(context, "realmId"),
      }),
    )
  })

  app.post(`${prefix}/clients/:clientId/secret/rotate`, (context) => {
    const authenticated = routeAuthenticate(
      context,
      authorizationPermissionDefinitions.oidcWrite,
      administrator ? "multi_factor" : undefined,
    )
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    return oidcManagementResultResponseCreate(
      context,
      oidcClientSecretRotate({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        realmId: oidcParamGet(context, "realmId"),
      }),
    )
  })

  app.post(`${prefix}/clients/:clientId/secret/revoke`, (context) => {
    const authenticated = routeAuthenticate(
      context,
      authorizationPermissionDefinitions.oidcWrite,
      administrator ? "multi_factor" : undefined,
    )
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    return oidcManagementResultResponseCreate(
      context,
      oidcClientSecretRevoke({
        clientId: oidcParamGet(context, "clientId"),
        context: authenticated.data,
        database: options.database,
        realmId: oidcParamGet(context, "realmId"),
      }),
    )
  })

  app.get(`${prefix}/signing-keys`, (context) => {
    const authenticated = routeAuthenticate(context, authorizationPermissionDefinitions.oidcRead)
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return oidcManagementErrorResponseCreate(context, query)
    return oidcManagementResultResponseCreate(
      context,
      oidcSigningKeyList({
        context: authenticated.data,
        database: options.database,
        realmId: oidcParamGet(context, "realmId"),
        query: query.data,
      }),
    )
  })

  app.post(`${prefix}/signing-keys`, (context) => {
    const authenticated = routeAuthenticate(
      context,
      authorizationPermissionDefinitions.oidcWrite,
      administrator ? "multi_factor" : undefined,
    )
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    return oidcManagementResultResponseCreate(
      context,
      oidcSigningKeyCreate({
        context: authenticated.data,
        database: options.database,
        encryptionSecret: options.systemSecret,
        realmId: oidcParamGet(context, "realmId"),
      }),
      201,
    )
  })

  app.post(`${prefix}/signing-keys/rotate`, (context) => {
    const authenticated = routeAuthenticate(
      context,
      authorizationPermissionDefinitions.oidcWrite,
      administrator ? "multi_factor" : undefined,
    )
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    return oidcManagementResultResponseCreate(
      context,
      oidcSigningKeyCreate({
        context: authenticated.data,
        database: options.database,
        encryptionSecret: options.systemSecret,
        realmId: oidcParamGet(context, "realmId"),
      }),
      201,
    )
  })

  app.post(`${prefix}/signing-keys/ensure-active`, (context) => {
    const authenticated = routeAuthenticate(
      context,
      authorizationPermissionDefinitions.oidcWrite,
      administrator ? "multi_factor" : undefined,
    )
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    return oidcManagementResultResponseCreate(
      context,
      oidcSigningKeyEnsureActive({
        context: authenticated.data,
        database: options.database,
        encryptionSecret: options.systemSecret,
        realmId: oidcParamGet(context, "realmId"),
      }),
    )
  })

  app.post(`${prefix}/signing-keys/:signingKeyId/lifecycle`, async (context) => {
    const authenticated = routeAuthenticate(
      context,
      authorizationPermissionDefinitions.oidcWrite,
      administrator ? "multi_factor" : undefined,
    )
    if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
    const body = await oidcRequestJsonRead(context)
    if (!body.success) return oidcManagementErrorResponseCreate(context, body)
    const input = v.safeParse(oidcSigningKeyLifecycleRequestSchema, body.data)
    if (!input.success)
      return oidcManagementErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "oidcSigningKeyLifecycleSet",
          "The signing key lifecycle request is invalid.",
          "oidc.invalid",
        ),
      )
    return oidcManagementResultResponseCreate(
      context,
      oidcSigningKeyLifecycleSet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: oidcParamGet(context, "realmId"),
        signingKeyId: oidcParamGet(context, "signingKeyId"),
      }),
    )
  })
}

function oidcSystemAuthenticate(authorization: string | undefined, configuredSecret: Secret | string | undefined) {
  const token = oidcBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return resultErrorCodedCreate("oidcSystemAuthorization", "System authorization is required.", "oidc.unauthorized")
  return { data: realmSystemContextCreate(), success: true as const }
}

function oidcTenantAuthenticate(context: {
  readonly get: (key: "authorizationActor") => AuthorizationActorContext
  readonly req: { param: (name: string) => string | undefined }
}) {
  const actor = context.get("authorizationActor")
  const realmId = context.req.param("realmId") ?? ""
  if (actor.realmId !== realmId)
    return resultErrorCodedCreate(
      "oidcTenantAuthenticate",
      "The actor is not available in this tenant context.",
      "oidc.tenant-mismatch",
    )
  if (actor.kind !== "user" && actor.kind !== "bootstrap_admin")
    return resultErrorCodedCreate(
      "oidcTenantAuthenticate",
      "The actor is not authorized for OIDC administration.",
      "oidc.forbidden",
    )
  return {
    data: { actor, actorId: actor.actorId, kind: "tenant" as const, realmId },
    success: true as const,
  }
}

function oidcTenantBootstrapFallback(
  database: StorageDatabase,
  context: {
    readonly json: (body: unknown, status?: ContentfulStatusCode) => Response
    readonly req: { header: (name: string) => string | undefined; url: string }
    readonly set: (key: "authorizationActor", value: AuthorizationActorContext) => void
  },
  next: Next,
) {
  const tenant = oidcPublicRealmResolve(database, context.req.header("host"), context.req.url)
  if (!tenant.success) return oidcManagementErrorResponseCreate(context, tenant)
  const authenticated = realmBootstrapAdminAuthenticate({
    context: tenant.data,
    database,
    secret: oidcBearerTokenGet(context.req.header("authorization")) ?? "",
  })
  if (!authenticated.success) return oidcManagementErrorResponseCreate(context, authenticated)
  context.set("authorizationActor", authenticated.data.actor)
  return next()
}

function oidcPublicRealmResolve(database: StorageDatabase, host: string | undefined, requestUrl: string) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : resolvedHost.split(":")[0]
  return realmTenantContextResolve({ database, host: normalizedHost ?? "" })
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
  result: { errorMessage: string; op: string; code?: string },
) {
  const code = oidcProtocolErrorCodeResolve(result)
  return context.json(
    { error: code, error_description: result.errorMessage },
    (code === "invalid_client" ? 401 : code === "server_error" ? 500 : 400) as ContentfulStatusCode,
  )
}

function oidcManagementErrorResponseCreate(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  const coded =
    result.code === undefined ? resultErrorCodedCreate(result.op, result.errorMessage, "oidc.invalid") : result
  return httpResultResponseCreate(context, coded as never)
}

function oidcAuthorizationConsentRequiredResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { errorData?: string | null },
) {
  if (result.errorData === undefined || result.errorData === null)
    return context.json({ error: "invalid_request", error_description: "User consent is required." }, 400)
  try {
    const parsed = v.safeParse(oidcAuthorizationConsentRequiredSchema, JSON.parse(result.errorData))
    if (!parsed.success)
      return context.json({ error: "invalid_request", error_description: "User consent is required." }, 400)
    return context.json(parsed.output, 200)
  } catch (_error) {
    return context.json({ error: "invalid_request", error_description: "User consent is required." }, 400)
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

function oidcTokenRevokeErrorCodeResolve(result: { errorMessage: string; op: string; code?: string }) {
  if (result.code === "oidc.invalid-timestamp" || result.code === "oidc.internal") return "server_error" as const
  if (result.code === "oidc.invalid-client") return "invalid_client" as const
  if (result.code === "oidc.invalid-request") return "invalid_request" as const
  if (result.op === "oidcTokenRevokeInvalidClient" || result.op === "machineClientCredentialsInvalidClient")
    return "invalid_client" as const
  if (result.op === "oidcTokenRevoke") return "invalid_request" as const
  return "server_error" as const
}

function oidcTokenErrorCodeResolve(result: { errorMessage: string; op: string; code?: string }) {
  if (result.code === "oidc.invalid-timestamp" || result.code === "oidc.internal") return "server_error" as const
  if (result.code === "oidc.invalid-client") return "invalid_client" as const
  if (result.code === "oidc.invalid-scope") return "invalid_scope" as const
  if (result.code === "oidc.invalid-request") return "invalid_request" as const
  if (result.code === "oidc.invalid-grant") return "invalid_grant" as const
  if (result.op === "oidcTokenInvalidClient") return "invalid_client" as const
  if (result.op === "oidcTokenInvalidScope") return "invalid_scope" as const
  if (result.op === "oidcTokenInvalidRequest") return "invalid_request" as const
  if (result.op === "oidcTokenInvalidGrant") return "invalid_grant" as const
  return "server_error" as const
}

function oidcProtocolErrorCodeResolve(result: { op: string; code?: string }) {
  if (result.code === "oidc.invalid-client") return "invalid_client" as const
  if (result.code === "oidc.invalid-grant") return "invalid_grant" as const
  if (result.code === "oidc.invalid-scope") return "invalid_scope" as const
  if (result.code === "oidc.invalid-token") return "invalid_token" as const
  if (result.code === "oidc.invalid-timestamp") return "server_error" as const
  if (result.code === "oidc.internal") return "server_error" as const
  if (result.code === "oidc.authorization-interaction-required") return "interaction_required" as const
  if (result.code === "oidc.invalid-request") return "invalid_request" as const
  if (result.op === "oidcAuthorizationInteractionRequired") return "interaction_required" as const
  if (result.op === "oidcLogout") return "invalid_request" as const
  if (result.op === "oidcAuthorizationCodeRedeem") return "invalid_grant" as const
  if (result.op === "oidcTokenIssue") return "server_error" as const
  return "invalid_request" as const
}

function oidcResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
) {
  if (!result.success)
    return oidcErrorResponseCreate(context, result as { errorMessage: string; op: string; code?: string })
  return context.json(result.data, status as ContentfulStatusCode)
}

function oidcManagementResultResponseCreate<T>(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
  lastModified?: Date,
) {
  if (!result.success)
    return oidcManagementErrorResponseCreate(context, result as { errorMessage: string; op: string; code?: string })
  return httpResultResponseCreate(context, result as never, status, lastModified)
}

type OidcTokenStage =
  | "request_parse"
  | "client_auth"
  | "code_lookup"
  | "code_state"
  | "redirect"
  | "pkce"
  | "session"
  | "user"
  | "membership"
  | "signing_key"
  | "token_schema"
  | "token_persistence"
  | "event_schema"
  | "event_persistence"
  | "unexpected"

function oidcTokenStageReporterCreate() {
  let emitted = false
  const report = (stage: OidcTokenStage) => {
    if (emitted) return
    emitted = true
    console.error(`oidc_token_stage=${stage}`)
  }
  return { report, reported: () => emitted }
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
    const clientId = oidcTokenClientCredentialDecode(decoded.slice(0, separator))
    const clientSecret = oidcTokenClientCredentialDecode(decoded.slice(separator + 1))
    if (clientId === null || clientSecret === null)
      return { errorMessage: "Client authentication failed.", success: false }
    if (bodyClientId !== undefined && bodyClientId !== clientId)
      return { errorMessage: "Client authentication failed.", success: false }
    return { clientId, clientSecret, success: true }
  } catch (_error) {
    return { errorMessage: "Client authentication failed.", success: false }
  }
}

function oidcTokenClientCredentialDecode(value: string): string | null {
  try {
    return decodeURIComponent(value.replaceAll("+", " "))
  } catch (_error) {
    return null
  }
}
