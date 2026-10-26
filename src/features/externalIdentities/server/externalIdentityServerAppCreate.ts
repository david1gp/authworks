import { Hono } from "hono"
import * as v from "valibot"
import type { Result } from "#result"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { organizationContextAuthorize } from "../../organizations/actions/organizationContextAuthorize.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionAuthenticate } from "../../sessions/actions/sessionAuthenticate.js"
import { sessionReturnPathValidate } from "../../sessions/domain/sessionReturnPathValidate.js"
import { sessionBrowserModeHeaderName } from "../../sessions/public/sessionBrowserModeHeaderName.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { sessionBrowserCredentialResponseCreate } from "../../sessions/server/sessionBrowserCredentialResponseCreate.js"
import { sessionBrowserModeRequested } from "../../sessions/server/sessionBrowserModeRequested.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import { externalIdentityCallback } from "../actions/externalIdentityCallback.js"
import { externalIdentityLinkComplete } from "../actions/externalIdentityLinkComplete.js"
import { externalIdentityLinkStart } from "../actions/externalIdentityLinkStart.js"
import { externalIdentityList } from "../actions/externalIdentityList.js"
import { externalIdentityProviderCreate } from "../actions/externalIdentityProviderCreate.js"
import { externalIdentityProviderDisable } from "../actions/externalIdentityProviderDisable.js"
import { externalIdentityProviderGet } from "../actions/externalIdentityProviderGet.js"
import { externalIdentityProviderList } from "../actions/externalIdentityProviderList.js"
import { externalIdentityProviderUpdate } from "../actions/externalIdentityProviderUpdate.js"
import { externalIdentityStart } from "../actions/externalIdentityStart.js"
import { externalIdentityUnlink } from "../actions/externalIdentityUnlink.js"
import type { ExternalIdentityProviderPorts } from "../domain/externalIdentityProviderPort.js"
import { externalIdentityProviderPortCreate } from "../domain/externalIdentityProviderPortCreate.js"
import { externalIdentitySecretHashCreate } from "../domain/externalIdentitySecretHashCreate.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityCallbackResponse } from "../public/externalIdentityCallbackResponseSchema.js"
import { externalIdentityLinkCompleteRequestSchema } from "../public/externalIdentityLinkCompleteRequestSchema.js"
import { externalIdentityProviderCreateRequestSchema } from "../public/externalIdentityProviderCreateRequestSchema.js"
import { externalIdentityProviderUpdateRequestSchema } from "../public/externalIdentityProviderUpdateRequestSchema.js"
import { externalIdentityStartRequestSchema } from "../public/externalIdentityStartRequestSchema.js"
import { externalIdentityLinkBrowserResponseCreate } from "./externalIdentityLinkBrowserResponseCreate.js"

type ExternalIdentityServerAppCreateOptions = {
  readonly accountUiOrigin?: string
  readonly allowDevelopmentFallback?: boolean
  readonly browserMode?: boolean
  readonly database: StorageDatabase
  readonly profilePictureImport?: (input: {
    readonly pictureUrl: string
    readonly realmId: string
    readonly userId: string
  }) => Promise<Result<void>>
  readonly providerPorts?: ExternalIdentityProviderPorts
  readonly publicOrigin?: string
  readonly systemSecret?: Secret | string
}

export function externalIdentityServerAppCreate(options: ExternalIdentityServerAppCreateOptions) {
  const app = new Hono<ExternalIdentityServerEnv>()
  const systemContext = realmSystemContextCreate("system")
  const providerPorts = options.providerPorts ?? externalIdentityProviderPortCreate()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    minimumAssurance: "authenticated",
    publicOrigin: options.publicOrigin,
  })
  const providerWriteMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    minimumAssurance: "multi_factor",
    publicOrigin: options.publicOrigin,
  })
  const externalIdentityCallbackRouteHandle = async (
    context: ExternalIdentityRouteContext,
    input: {
      readonly code: string
      readonly error?: string
      readonly interactionHandle?: string
      readonly linkContext?: { readonly messageNonce: string; readonly providerId: string }
      readonly realmId: string
      readonly providerId: string
      readonly state: string
    },
  ) => {
    const browserMode =
      sessionBrowserModeRequested(context, options.browserMode) ||
      (options.browserMode === true && context.req.header("accept")?.includes("text/html") === true)
    // A provider-side denial (user cancelled, invalid request) carries no code. Model it as
    // a failed callback so login flows keep their existing redirects below.
    const providerError = input.error !== undefined && input.error.length > 0 ? input.error : undefined
    const callback: Result<ExternalIdentityCallbackResponse> =
      providerError !== undefined
        ? {
            code: "external-identities.invalid",
            errorMessage: "The external identity callback is invalid.",
            op: "externalIdentityCallback",
            success: false,
          }
        : await externalIdentityCallback({
            allowDevelopmentFallback: options.allowDevelopmentFallback === true,
            code: input.code,
            database: options.database,
            deviceMetadata: externalIdentityDeviceMetadataGet(context),
            encryptionSecret: options.systemSecret,
            realmId: input.realmId,
            providerId: input.providerId,
            providerPorts,
            profilePictureImport: options.profilePictureImport,
            state: input.state,
          })
    if (browserMode && callback.success && callback.data.kind === "link_confirmation") {
      const targetOrigin = externalIdentityBrowserOriginResolve(options.accountUiOrigin)
      if (!targetOrigin.success) return externalIdentityErrorResponseCreate(context, targetOrigin)
      return externalIdentityLinkBrowserResponseCreate({ callback: callback.data, targetOrigin: targetOrigin.data })
    }
    // Link popups have no login page to fall back to: report the failure to the opener so
    // the dialog shows the error instead of hanging on "connecting" forever.
    if (browserMode && input.linkContext !== undefined && !callback.success) {
      const targetOrigin = externalIdentityBrowserOriginResolve(options.accountUiOrigin)
      if (targetOrigin.success)
        return externalIdentityLinkBrowserResponseCreate({
          callback: {
            errorMessage:
              providerError !== undefined
                ? externalIdentityProviderDeniedMessageCreate(providerError)
                : "The external account linking could not be completed. Check the provider configuration and try again.",
            kind: "link_failure",
            messageNonce: input.linkContext.messageNonce,
            providerId: input.linkContext.providerId,
          },
          targetOrigin: targetOrigin.data,
        })
    }
    if (browserMode && input.interactionHandle !== undefined) {
      const resumePath = externalIdentityInteractionResumePathCreate(input.interactionHandle, options.publicOrigin)
      if (!resumePath.success) return externalIdentityErrorResponseCreate(context, resumePath)
      if (callback.success && callback.data.kind === "authenticated" && callback.data.session !== undefined) {
        const browser = sessionBrowserCredentialResponseCreate(context, callback)
        if (!browser.success) return externalIdentityErrorResponseCreate(context, browser)
        return context.redirect(resumePath.data, 302)
      }
      return externalIdentityLoginRedirectCreate(
        context,
        input.interactionHandle,
        resumePath.data,
        options.publicOrigin,
        externalIdentityChallengeTokenGet(callback),
      )
    }
    if (browserMode) {
      // Top-level browser navigation without an OIDC interaction (direct hosted-login sign-in).
      // Never render raw JSON: the session cookie is set and the browser is redirected into the UI.
      if (callback.success && callback.data.kind === "authenticated" && callback.data.session !== undefined) {
        const browser = sessionBrowserCredentialResponseCreate(context, callback)
        if (!browser.success) return externalIdentityErrorResponseCreate(context, browser)
        return context.redirect("/account", 302)
      }
      // An organization or realm policy can force MFA, so a direct IdP sign-in can yield a
      // challenge without a session. Thread the challenge token through the login redirect so
      // the hosted login can complete verification instead of dropping the sign-in.
      const challengeToken = externalIdentityChallengeTokenGet(callback)
      if (challengeToken !== undefined)
        return context.redirect(`/login/mfa?mfa_challenge=${encodeURIComponent(challengeToken)}`, 302)
      if (callback.success && callback.data.kind === "authenticated") return context.redirect("/login", 302)
      return context.redirect(`/login/idp/${encodeURIComponent(input.providerId)}/failure`, 302)
    }
    return externalIdentityResultResponseCreate(context, callback)
  }

  app.get(
    "/realms/:realmId/external-identity-providers",
    async (context, next) => {
      if (!externalIdentitySessionRequestIsAuthenticated(options.database, context)) return next()
      return protectedMiddleware(context, next)
    },
    (context) => {
      const actor = context.get("authorizationActor") as AuthorizationActorContext | undefined
      if (actor !== undefined) {
        const realmId = context.req.param("realmId")
        const requestedOrganizationId = context.req.query("organizationId")
        if (requestedOrganizationId !== undefined && requestedOrganizationId.length > 0) {
          const tenantAllowed = externalIdentityOrganizationProviderListAuthorize({
            actor,
            database: options.database,
            organizationId: requestedOrganizationId,
            realmId,
          })
          if (!tenantAllowed.success) return externalIdentityErrorResponseCreate(context, tenantAllowed)
          const query = listQueryFromSearchParams(context.req.query())
          if (!query.success) return externalIdentityErrorResponseCreate(context, query)
          return externalIdentityResultResponseCreate(
            context,
            externalIdentityProviderList({
              administration: true,
              database: options.database,
              includeDisabled: true,
              organizationId: requestedOrganizationId,
              query: query.data,
              realmId,
            }),
          )
        }
        const authorized = realmAdministratorContextAuthorize({
          actor,
          database: options.database,
          permission: authorizationPermissionDefinitions.realmRead,
          realmId,
        })
        if (!authorized.success) return externalIdentityErrorResponseCreate(context, authorized)
        const query = listQueryFromSearchParams(context.req.query())
        if (!query.success) return externalIdentityErrorResponseCreate(context, query)
        return externalIdentityResultResponseCreate(
          context,
          externalIdentityProviderList({
            administration: true,
            database: options.database,
            includeDisabled: true,
            realmId,
            organizationId: requestedOrganizationId,
            query: query.data,
          }),
        )
      }
      const tenant = externalIdentityTenantContextResolve(
        options.database,
        context.req.header("host"),
        context.req.url,
        context.req.param("realmId"),
      )
      if (!tenant.success) return externalIdentityErrorResponseCreate(context, tenant)
      const query = listQueryFromSearchParams(context.req.query())
      if (!query.success) return externalIdentityErrorResponseCreate(context, query)
      return externalIdentityResultResponseCreate(
        context,
        externalIdentityProviderList({
          database: options.database,
          realmId: context.req.param("realmId"),
          organizationId: context.req.query("organizationId"),
          query: query.data,
        }),
      )
    },
  )

  app.get("/system/realms/:realmId/external-identity-providers", (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    const query = listQueryFromSearchParams(context.req.query())
    if (!query.success) return externalIdentityErrorResponseCreate(context, query)
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderList({
        database: options.database,
        includeDisabled: true,
        realmId: context.req.param("realmId"),
        organizationId: context.req.query("organizationId"),
        query: query.data,
      }),
    )
  })

  app.post("/system/realms/:realmId/external-identity-providers", async (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    const body = await externalIdentityJsonRead(context)
    if (!body.success) return externalIdentityErrorResponseCreate(context, body)
    const input = v.safeParse(externalIdentityProviderCreateRequestSchema, body.data)
    if (!input.success)
      return externalIdentityErrorResponseCreate(context, {
        code: "external-identities.invalid",
        errorMessage: "The provider request is invalid.",
        op: "externalIdentityProviderCreate",
      })
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderCreate({
        allowDevelopmentFallback: options.allowDevelopmentFallback === true,
        context: systemContext,
        database: options.database,
        encryptionSecret: options.systemSecret,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.post("/realms/:realmId/external-identity-providers", providerWriteMiddleware, async (context) => {
    const authorized = realmAdministratorContextAuthorize({
      actor: context.get("authorizationActor") as AuthorizationActorContext,
      database: options.database,
      minimumAssurance: "multi_factor",
      permission: authorizationPermissionDefinitions.realmWrite,
      realmId: context.req.param("realmId"),
    })
    if (!authorized.success) return externalIdentityErrorResponseCreate(context, authorized)
    const body = await externalIdentityJsonRead(context)
    if (!body.success) return externalIdentityErrorResponseCreate(context, body)
    const input = v.safeParse(externalIdentityProviderCreateRequestSchema, body.data)
    if (!input.success)
      return externalIdentityErrorResponseCreate(context, {
        code: "external-identities.invalid",
        errorMessage: "The provider request is invalid.",
        op: "externalIdentityProviderCreate",
      })
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderCreate({
        allowDevelopmentFallback: options.allowDevelopmentFallback === true,
        context: realmSystemContextCreate(authorized.data.actorId),
        database: options.database,
        encryptionSecret: options.systemSecret,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.get("/system/realms/:realmId/external-identity-providers/:providerId", (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    const result = externalIdentityProviderGet({
      database: options.database,
      includeDisabled: true,
      realmId: context.req.param("realmId"),
      providerId: context.req.param("providerId"),
    })
    return externalIdentityResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.provider.updatedAt) : undefined,
    )
  })

  app.get("/realms/:realmId/external-identity-providers/:providerId", protectedMiddleware, (context) => {
    const authorized = realmAdministratorContextAuthorize({
      actor: context.get("authorizationActor") as AuthorizationActorContext,
      database: options.database,
      permission: authorizationPermissionDefinitions.realmRead,
      realmId: context.req.param("realmId"),
    })
    if (!authorized.success) return externalIdentityErrorResponseCreate(context, authorized)
    const result = externalIdentityProviderGet({
      database: options.database,
      includeDisabled: true,
      realmId: context.req.param("realmId"),
      providerId: context.req.param("providerId"),
    })
    return externalIdentityResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.provider.updatedAt) : undefined,
    )
  })

  app.patch("/system/realms/:realmId/external-identity-providers/:providerId", async (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    const body = await externalIdentityJsonRead(context)
    if (!body.success) return externalIdentityErrorResponseCreate(context, body)
    const input = v.safeParse(externalIdentityProviderUpdateRequestSchema, body.data)
    if (!input.success)
      return externalIdentityErrorResponseCreate(context, {
        code: "external-identities.invalid",
        errorMessage: "The provider update is invalid.",
        op: "externalIdentityProviderUpdate",
      })
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderUpdate({
        allowDevelopmentFallback: options.allowDevelopmentFallback === true,
        context: systemContext,
        database: options.database,
        encryptionSecret: options.systemSecret,
        input: input.output,
        realmId: context.req.param("realmId"),
        providerId: context.req.param("providerId"),
      }),
    )
  })

  app.patch("/realms/:realmId/external-identity-providers/:providerId", providerWriteMiddleware, async (context) => {
    const authorized = realmAdministratorContextAuthorize({
      actor: context.get("authorizationActor") as AuthorizationActorContext,
      database: options.database,
      minimumAssurance: "multi_factor",
      permission: authorizationPermissionDefinitions.realmWrite,
      realmId: context.req.param("realmId"),
    })
    if (!authorized.success) return externalIdentityErrorResponseCreate(context, authorized)
    const body = await externalIdentityJsonRead(context)
    if (!body.success) return externalIdentityErrorResponseCreate(context, body)
    const input = v.safeParse(externalIdentityProviderUpdateRequestSchema, body.data)
    if (!input.success)
      return externalIdentityErrorResponseCreate(context, {
        code: "external-identities.invalid",
        errorMessage: "The provider update is invalid.",
        op: "externalIdentityProviderUpdate",
      })
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderUpdate({
        allowDevelopmentFallback: options.allowDevelopmentFallback === true,
        context: realmSystemContextCreate(authorized.data.actorId),
        database: options.database,
        encryptionSecret: options.systemSecret,
        input: input.output,
        realmId: context.req.param("realmId"),
        providerId: context.req.param("providerId"),
      }),
    )
  })

  app.post("/system/realms/:realmId/external-identity-providers/:providerId/disable", (context) => {
    const authorization = externalIdentitySystemAuthorizationGet(
      context.req.header("authorization"),
      options.systemSecret,
    )
    if (!authorization.success) return externalIdentityErrorResponseCreate(context, authorization)
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderDisable({
        context: systemContext,
        database: options.database,
        realmId: context.req.param("realmId"),
        providerId: context.req.param("providerId"),
      }),
    )
  })

  app.post("/realms/:realmId/external-identity-providers/:providerId/disable", providerWriteMiddleware, (context) => {
    const authorized = realmAdministratorContextAuthorize({
      actor: context.get("authorizationActor") as AuthorizationActorContext,
      database: options.database,
      minimumAssurance: "multi_factor",
      permission: authorizationPermissionDefinitions.realmWrite,
      realmId: context.req.param("realmId"),
    })
    if (!authorized.success) return externalIdentityErrorResponseCreate(context, authorized)
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderDisable({
        context: realmSystemContextCreate(authorized.data.actorId),
        database: options.database,
        realmId: context.req.param("realmId"),
        providerId: context.req.param("providerId"),
      }),
    )
  })

  app.post("/realms/:realmId/external-identity/:providerId/start", async (context) => {
    const tenant = externalIdentityTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return externalIdentityErrorResponseCreate(context, tenant)
    const body = await externalIdentityJsonRead(context)
    if (!body.success) return externalIdentityErrorResponseCreate(context, body)
    const input = v.safeParse(externalIdentityStartRequestSchema, {
      ...(typeof body.data === "object" && body.data !== null ? body.data : {}),
      ...(context.req.query("interaction") === undefined ? {} : { interaction: context.req.query("interaction") }),
    })
    if (!input.success)
      return externalIdentityErrorResponseCreate(context, {
        code: "external-identities.invalid",
        errorMessage: "The external identity start request is invalid.",
        op: "externalIdentityStart",
      })
    return externalIdentityResultResponseCreate(
      context,
      await externalIdentityStart({
        allowDevelopmentFallback: options.allowDevelopmentFallback === true,
        database: options.database,
        encryptionSecret: options.systemSecret,
        input: input.output,
        realmId: context.req.param("realmId"),
        providerId: context.req.param("providerId"),
        providerPorts,
      }),
    )
  })

  app.get("/realms/:realmId/external-identity/:providerId/callback", async (context) => {
    const tenant = externalIdentityTenantContextResolve(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.param("realmId"),
    )
    if (!tenant.success) return externalIdentityErrorResponseCreate(context, tenant)
    const state = context.req.query("state") ?? ""
    const transaction = externalIdentityRepositoryCreate(
      options.database.db,
    ).externalIdentityOAuthTransactionGetByState(context.req.param("realmId"), externalIdentitySecretHashCreate(state))
    const interactionHandle = transaction.success ? (transaction.data?.interactionHandle ?? undefined) : undefined
    const linkContext =
      transaction.success && transaction.data?.intent === "link"
        ? { messageNonce: transaction.data.stateHash, providerId: context.req.param("providerId") }
        : undefined
    return externalIdentityCallbackRouteHandle(context, {
      code: context.req.query("code") ?? "",
      error: context.req.query("error"),
      interactionHandle,
      linkContext,
      realmId: context.req.param("realmId"),
      providerId: context.req.param("providerId"),
      state,
    })
  })

  app.get("/idps/callback", async (context) => {
    const state = context.req.query("state") ?? ""
    const transaction = externalIdentityRepositoryCreate(
      options.database.db,
    ).externalIdentityOAuthTransactionGetByStateHash(externalIdentitySecretHashCreate(state))
    if (!transaction.success) return externalIdentityErrorResponseCreate(context, transaction)
    if (transaction.data === null) {
      if (
        options.browserMode === true &&
        (context.req.header("accept")?.includes("text/html") === true ||
          context.req.header(sessionBrowserModeHeaderName) === "true")
      )
        return context.redirect("/login", 302)
      return externalIdentityErrorResponseCreate(context, {
        code: "external-identities.invalid",
        errorMessage: "The external identity callback is invalid.",
        op: "externalIdentityCallback",
        success: false,
      })
    }
    return externalIdentityCallbackRouteHandle(context, {
      code: context.req.query("code") ?? "",
      error: context.req.query("error"),
      interactionHandle: transaction.data.interactionHandle ?? undefined,
      linkContext:
        transaction.data.intent === "link"
          ? { messageNonce: transaction.data.stateHash, providerId: transaction.data.providerId }
          : undefined,
      realmId: transaction.data.realmId,
      providerId: transaction.data.providerId,
      state,
    })
  })

  app.post(
    "/realms/:realmId/users/:userId/external-identities/:providerId/link/start",
    protectedMiddleware,
    async (context) => {
      const body = await externalIdentityJsonRead(context)
      if (!body.success) return externalIdentityErrorResponseCreate(context, body)
      const input = v.safeParse(externalIdentityStartRequestSchema, body.data)
      if (!input.success)
        return externalIdentityErrorResponseCreate(context, {
          code: "external-identities.invalid",
          errorMessage: "The external identity link request is invalid.",
          op: "externalIdentityLinkStart",
        })
      const callbackOrigin = externalIdentityBrowserOriginResolve(options.accountUiOrigin)
      if (!callbackOrigin.success) return externalIdentityErrorResponseCreate(context, callbackOrigin)
      return externalIdentityResultResponseCreate(
        context,
        await externalIdentityLinkStart({
          allowDevelopmentFallback: options.allowDevelopmentFallback === true,
          database: options.database,
          encryptionSecret: options.systemSecret,
          input: input.output,
          realmId: context.req.param("realmId"),
          providerId: context.req.param("providerId"),
          providerPorts,
          callbackOrigin: callbackOrigin.data,
          session: context.get("session"),
          userId: context.req.param("userId"),
        }),
      )
    },
  )

  app.post(
    "/realms/:realmId/users/:userId/external-identities/:providerId/link/complete",
    protectedMiddleware,
    async (context) => {
      const body = await externalIdentityJsonRead(context)
      if (!body.success) return externalIdentityErrorResponseCreate(context, body)
      const input = v.safeParse(externalIdentityLinkCompleteRequestSchema, body.data)
      if (!input.success)
        return externalIdentityErrorResponseCreate(context, {
          code: "external-identities.invalid",
          errorMessage: "Explicit link confirmation is required.",
          op: "externalIdentityLinkComplete",
        })
      return externalIdentityResultResponseCreate(
        context,
        externalIdentityLinkComplete({
          database: options.database,
          input: input.output,
          realmId: context.req.param("realmId"),
          providerId: context.req.param("providerId"),
          session: context.get("session"),
          userId: context.req.param("userId"),
        }),
      )
    },
  )

  app.get("/realms/:realmId/users/:userId/external-identities", protectedMiddleware, (context) =>
    externalIdentityListRoute(context, options.database),
  )

  app.delete(
    "/realms/:realmId/users/:userId/external-identities/:providerId/:externalSubject",
    protectedMiddleware,
    (context) =>
      externalIdentityResultResponseCreate(
        context,
        externalIdentityUnlink({
          database: options.database,
          externalSubject: context.req.param("externalSubject"),
          realmId: context.req.param("realmId"),
          providerId: context.req.param("providerId"),
          session: context.get("session"),
          userId: context.req.param("userId"),
        }),
      ),
  )

  app.post("/realms/:realmId/me/external-identities/:providerId/link/start", protectedMiddleware, async (context) => {
    const subject = externalIdentitySubjectIdResolve(context, context.req.param("realmId"))
    if (!subject.success) return externalIdentityErrorResponseCreate(context, subject)
    const body = await externalIdentityJsonRead(context)
    if (!body.success) return externalIdentityErrorResponseCreate(context, body)
    const input = v.safeParse(externalIdentityStartRequestSchema, body.data)
    if (!input.success)
      return externalIdentityErrorResponseCreate(context, {
        code: "external-identities.invalid",
        errorMessage: "The external identity link request is invalid.",
        op: "externalIdentityLinkStart",
      })
    const callbackOrigin = externalIdentityBrowserOriginResolve(options.accountUiOrigin)
    if (!callbackOrigin.success) return externalIdentityErrorResponseCreate(context, callbackOrigin)
    return externalIdentityResultResponseCreate(
      context,
      await externalIdentityLinkStart({
        allowDevelopmentFallback: options.allowDevelopmentFallback === true,
        database: options.database,
        encryptionSecret: options.systemSecret,
        input: input.output,
        realmId: context.req.param("realmId"),
        providerId: context.req.param("providerId"),
        providerPorts,
        callbackOrigin: callbackOrigin.data,
        session: context.get("session"),
        userId: subject.data,
      }),
    )
  })

  app.post(
    "/realms/:realmId/me/external-identities/:providerId/link/complete",
    protectedMiddleware,
    async (context) => {
      const subject = externalIdentitySubjectIdResolve(context, context.req.param("realmId"))
      if (!subject.success) return externalIdentityErrorResponseCreate(context, subject)
      const body = await externalIdentityJsonRead(context)
      if (!body.success) return externalIdentityErrorResponseCreate(context, body)
      const input = v.safeParse(externalIdentityLinkCompleteRequestSchema, body.data)
      if (!input.success)
        return externalIdentityErrorResponseCreate(context, {
          code: "external-identities.invalid",
          errorMessage: "Explicit link confirmation is required.",
          op: "externalIdentityLinkComplete",
        })
      return externalIdentityResultResponseCreate(
        context,
        externalIdentityLinkComplete({
          database: options.database,
          input: input.output,
          realmId: context.req.param("realmId"),
          providerId: context.req.param("providerId"),
          session: context.get("session"),
          userId: subject.data,
        }),
      )
    },
  )

  app.get("/realms/:realmId/me/external-identities", protectedMiddleware, (context) => {
    const subject = externalIdentitySubjectIdResolve(context, context.req.param("realmId"))
    if (!subject.success) return externalIdentityErrorResponseCreate(context, subject)
    return externalIdentityListRoute(context, options.database, subject.data)
  })

  app.get("/realms/:realmId/me/external-identity-providers", protectedMiddleware, (context) => {
    const subject = externalIdentitySubjectIdResolve(context, context.req.param("realmId"))
    if (!subject.success) return externalIdentityErrorResponseCreate(context, subject)
    const query = listQueryFromSearchParams(context.req.query())
    if (!query.success) return externalIdentityErrorResponseCreate(context, query)
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityProviderList({
        database: options.database,
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.delete("/realms/:realmId/me/external-identities/:providerId/:externalSubject", protectedMiddleware, (context) => {
    const subject = externalIdentitySubjectIdResolve(context, context.req.param("realmId"))
    if (!subject.success) return externalIdentityErrorResponseCreate(context, subject)
    return externalIdentityResultResponseCreate(
      context,
      externalIdentityUnlink({
        database: options.database,
        externalSubject: context.req.param("externalSubject"),
        realmId: context.req.param("realmId"),
        providerId: context.req.param("providerId"),
        session: context.get("session"),
        userId: subject.data,
      }),
    )
  })

  return app
}

/**
 * Authorizes an organization-scoped provider listing: an active owner/admin of the given organization
 * may read the external identity providers available to it. Realm-wide listings stay realm-admin only.
 */
function externalIdentityOrganizationProviderListAuthorize(options: {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly organizationId: string
  readonly realmId: string
}): Result<void> {
  const op = "externalIdentityOrganizationProviderListAuthorize"
  if (options.actor.realmId !== options.realmId)
    return {
      code: "external-identities.forbidden",
      errorMessage: "The actor is not available in this tenant context.",
      op,
      success: false as const,
    }
  if (options.actor.kind !== "user" && options.actor.kind !== "bootstrap_admin")
    return {
      code: "external-identities.forbidden",
      errorMessage: "The actor is not authorized to list providers for this organization.",
      op,
      success: false as const,
    }
  if (options.actor.kind === "bootstrap_admin") return { data: undefined, success: true as const }
  const repository = organizationRepositoryCreate(options.database.db)
  const organization = repository.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return {
      code: "external-identities.not-found",
      errorMessage: "The organization was not found.",
      op,
      success: false as const,
    }
  return organizationContextAuthorize({
    context: { actor: options.actor, actorId: options.actor.actorId, kind: "tenant", realmId: options.realmId },
    database: options.database,
    organization: organization.data,
    repository,
    requiredPermission: "organization.read",
  })
}

type ExternalIdentityServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    cookieAuthenticated: boolean
    session: Session
  }
}

function externalIdentityTenantContextResolve(
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
      op: "externalIdentityTenantContextResolve",
      success: false as const,
    }
  return tenant
}

function externalIdentitySessionRequestIsAuthenticated(
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

function externalIdentitySystemAuthorizationGet(
  authorization: string | undefined,
  configuredSecret: Secret | string | undefined,
) {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1]
  if (configuredSecret === undefined || token === undefined || !secretMatches(token, configuredSecret))
    return {
      code: "external-identities.authentication-required",
      errorMessage: "System authorization is required.",
      op: "externalIdentitySystemAuthorizationGet",
      success: false as const,
    }
  return { data: undefined, success: true as const }
}

function externalIdentityDeviceMetadataGet(context: { req: { header: (name: string) => string | undefined } }) {
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

async function externalIdentityJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return {
      code: "external-identities.invalid",
      errorMessage: "The request body is invalid.",
      op: "externalIdentityJsonRead",
      success: false as const,
    }
  }
}

function externalIdentityErrorResponseCreate(
  context: ExternalIdentityRouteContext,
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  return httpResultResponseCreate(context, {
    ...result,
    success: false,
    code: result.code ?? "external-identities.invalid",
  } as Result<unknown>)
}

function externalIdentityResultResponseCreate<T>(
  context: ExternalIdentityRouteContext,
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
  lastModified?: Date,
) {
  if (!result.success)
    return externalIdentityErrorResponseCreate(context, {
      code: result.code,
      errorMessage: result.errorMessage ?? "The external identity request failed.",
      op: result.op ?? "externalIdentity",
      success: false,
    })
  return httpResultResponseCreate(context, result as Result<T>, status, lastModified)
}

function externalIdentityListRoute(context: ExternalIdentityRouteContext, database: StorageDatabase, userId?: string) {
  const query = listQueryFromSearchParams(context.req.query())
  if (!query.success) return externalIdentityErrorResponseCreate(context, query)
  return externalIdentityResultResponseCreate(
    context,
    externalIdentityList({
      database,
      query: query.data,
      realmId: context.req.param("realmId"),
      session: context.get("session"),
      userId: userId ?? context.req.param("userId"),
    }),
  )
}

function externalIdentitySubjectIdResolve(context: ExternalIdentityRouteContext, realmId: string): Result<string> {
  const session = context.get("session")
  const actor = context.get("authorizationActor")
  if (
    session.realmId !== realmId ||
    actor.kind !== "user" ||
    actor.realmId !== realmId ||
    session.subjectType !== "user" ||
    actor.actorId !== session.subjectId
  )
    return {
      code: "external-identities.forbidden",
      errorMessage: "The authenticated user is not available in this realm.",
      op: "externalIdentitySubjectIdResolve",
      success: false,
    }
  return { data: session.subjectId, success: true }
}

type ExternalIdentityRouteContext = {
  readonly get: {
    (key: "authorizationActor"): AuthorizationActorContext
    (key: "session"): import("../../sessions/public/sessionSchema.js").Session
  }
  readonly header: (name: string, value: string, options?: { readonly append?: boolean }) => void
  readonly json: (body: unknown, status?: number) => Response
  readonly redirect: (location: string, status?: 301 | 302 | 303 | 307 | 308) => Response
  readonly req: {
    readonly header: (name: string) => string | undefined
    readonly param: (name: string) => string
    readonly query: {
      (): Record<string, string>
      (name: string): string | undefined
    }
    readonly url: string
  }
}

function externalIdentityInteractionResumePathCreate(interactionHandle: string, publicOrigin: string | undefined) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(interactionHandle) || publicOrigin === undefined)
    return {
      code: "external-identities.invalid",
      errorMessage: "The external identity callback is invalid.",
      op: "externalIdentityInteractionResumePathCreate",
      success: false as const,
    }
  return sessionReturnPathValidate(
    `/oauth2/authorize?interaction=${encodeURIComponent(interactionHandle)}`,
    publicOrigin,
  )
}

function externalIdentityProviderDeniedMessageCreate(error: string): string {
  const code = /^[A-Za-z0-9_.-]{1,64}$/.test(error) ? error : "unknown_error"
  if (code === "access_denied")
    return "The provider request was denied before completing. Try again and approve the request."
  return `The provider could not complete the request (${code}). Try again.`
}

function externalIdentityChallengeTokenGet(callback: Result<ExternalIdentityCallbackResponse>): string | undefined {
  if (!callback.success || callback.data.kind !== "authenticated") return undefined
  const challenge = callback.data.challenge
  if (challenge === undefined || callback.data.session !== undefined) return undefined
  return externalIdentityChallengeTokenPattern.test(challenge.token) ? challenge.token : undefined
}

const externalIdentityChallengeTokenPattern = /^[A-Za-z0-9_-]{43,128}$/

function externalIdentityLoginRedirectCreate(
  context: ExternalIdentityRouteContext,
  interactionHandle: string,
  resumePath: string,
  publicOrigin: string | undefined,
  challengeToken?: string,
) {
  if (publicOrigin === undefined)
    return externalIdentityErrorResponseCreate(context, {
      code: "external-identities.invalid",
      errorMessage: "The external identity callback is invalid.",
      op: "externalIdentityLoginRedirectCreate",
      success: false,
    })
  const params = `interaction=${encodeURIComponent(interactionHandle)}&return_to=${encodeURIComponent(resumePath)}`
  if (challengeToken !== undefined) {
    const challenged = sessionReturnPathValidate(
      `/login/mfa?${params}&mfa_challenge=${encodeURIComponent(challengeToken)}`,
      publicOrigin,
    )
    if (challenged.success) return context.redirect(challenged.data, 302)
  }
  const loginPath = `/login?${params}`
  const validated = sessionReturnPathValidate(loginPath, publicOrigin)
  if (!validated.success) return externalIdentityErrorResponseCreate(context, validated)
  return context.redirect(validated.data, 302)
}

function externalIdentityBrowserOriginResolve(value: string | undefined) {
  if (value === undefined)
    return {
      code: "external-identities.invalid",
      errorMessage: "A trusted account UI origin is required for the browser callback.",
      op: "externalIdentityBrowserOriginResolve",
      success: false as const,
    }
  try {
    const origin = new URL(value)
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username !== "" ||
      origin.password !== "" ||
      origin.search !== "" ||
      origin.hash !== ""
    )
      throw new Error("invalid origin")
    return { data: origin.origin, success: true as const }
  } catch (_error) {
    return {
      code: "external-identities.invalid",
      errorMessage: "The trusted account UI origin is invalid.",
      op: "externalIdentityBrowserOriginResolve",
      success: false as const,
    }
  }
}
