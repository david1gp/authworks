import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import type { Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { realmBootstrapAdminAuthenticate } from "../../realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { organizationBrandingGet } from "../actions/organizationBrandingGet.js"
import { organizationBrandingSet } from "../actions/organizationBrandingSet.js"
import { organizationCreate } from "../actions/organizationCreate.js"
import { organizationDomainClaim } from "../actions/organizationDomainClaim.js"
import { organizationDomainDiscover } from "../actions/organizationDomainDiscover.js"
import { organizationDomainList } from "../actions/organizationDomainList.js"
import { organizationDomainRemove } from "../actions/organizationDomainRemove.js"
import { organizationDomainVerify } from "../actions/organizationDomainVerify.js"
import { organizationGet } from "../actions/organizationGet.js"
import { organizationInvitationAccept } from "../actions/organizationInvitationAccept.js"
import { organizationInvitationCreate } from "../actions/organizationInvitationCreate.js"
import { organizationInvitationDecline } from "../actions/organizationInvitationDecline.js"
import { organizationInvitationList } from "../actions/organizationInvitationList.js"
import { organizationInvitationMeAccept } from "../actions/organizationInvitationMeAccept.js"
import { organizationInvitationMeDecline } from "../actions/organizationInvitationMeDecline.js"
import { organizationInvitationMeInspect } from "../actions/organizationInvitationMeInspect.js"
import { organizationInvitationMeList } from "../actions/organizationInvitationMeList.js"
import { organizationInvitationRevoke } from "../actions/organizationInvitationRevoke.js"
import { organizationLifecycleSet } from "../actions/organizationLifecycleSet.js"
import { organizationList } from "../actions/organizationList.js"
import { organizationLoginPolicyGet } from "../actions/organizationLoginPolicyGet.js"
import { organizationLoginPolicySet } from "../actions/organizationLoginPolicySet.js"
import { organizationMeList } from "../actions/organizationMeList.js"
import { organizationMembershipCreate } from "../actions/organizationMembershipCreate.js"
import { organizationMembershipList } from "../actions/organizationMembershipList.js"
import { organizationMembershipRemove } from "../actions/organizationMembershipRemove.js"
import { organizationMembershipUpdate } from "../actions/organizationMembershipUpdate.js"
import { organizationMeSwitch } from "../actions/organizationMeSwitch.js"
import { organizationRealmLoginPolicyGet } from "../actions/organizationRealmLoginPolicyGet.js"
import { organizationRealmLoginPolicySet } from "../actions/organizationRealmLoginPolicySet.js"
import { organizationRoleList } from "../actions/organizationRoleList.js"
import { organizationSwitch } from "../actions/organizationSwitch.js"
import { organizationUpdate } from "../actions/organizationUpdate.js"
import { organizationDomainDnsVerificationPortCreate } from "../domain/organizationDomainDnsVerificationPortCreate.js"
import { organizationBrandingSetRequestSchema } from "../public/organizationBrandingSetRequestSchema.js"
import { organizationCreateRequestSchema } from "../public/organizationCreateRequestSchema.js"
import { organizationDomainClaimRequestSchema } from "../public/organizationDomainClaimRequestSchema.js"
import { organizationInvitationAcceptRequestSchema } from "../public/organizationInvitationAcceptRequestSchema.js"
import { organizationInvitationCreateRequestSchema } from "../public/organizationInvitationCreateRequestSchema.js"
import type { OrganizationInvitationDelivery } from "../public/organizationInvitationDeliverySchema.js"
import { organizationInvitationMeAcceptRequestSchema } from "../public/organizationInvitationMeAcceptRequestSchema.js"
import { organizationInvitationMeDeclineRequestSchema } from "../public/organizationInvitationMeDeclineRequestSchema.js"
import { organizationInvitationMeInspectRequestSchema } from "../public/organizationInvitationMeInspectRequestSchema.js"
import { organizationLifecycleRequestSchema } from "../public/organizationLifecycleRequestSchema.js"
import { organizationLoginPolicySetRequestSchema } from "../public/organizationLoginPolicySetRequestSchema.js"
import { organizationMembershipCreateRequestSchema } from "../public/organizationMembershipCreateRequestSchema.js"
import { organizationMembershipUpdateRequestSchema } from "../public/organizationMembershipUpdateRequestSchema.js"
import { organizationMeSwitchRequestSchema } from "../public/organizationMeSwitchRequestSchema.js"
import { organizationSwitchRequestSchema } from "../public/organizationSwitchRequestSchema.js"
import { organizationUpdateRequestSchema } from "../public/organizationUpdateRequestSchema.js"

type OrganizationServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly domainVerificationPort?: ReturnType<typeof organizationDomainDnsVerificationPortCreate>
  readonly onInvitationDelivery?: (delivery: OrganizationInvitationDelivery) => void | Promise<void>
  readonly publicOrigin?: string
  readonly systemSecret?: Secret | string
}

type OrganizationServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    session: Session
  }
}

export function organizationServerAppCreate(options: OrganizationServerAppCreateOptions) {
  const app = new Hono<OrganizationServerEnv>()
  const systemContext = realmSystemContextCreate("system")
  const domainVerificationPort = options.domainVerificationPort ?? organizationDomainDnsVerificationPortCreate()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    publicOrigin: options.publicOrigin,
  })

  app.get("/organization-discovery", (context) =>
    organizationResultResponseCreate(
      context,
      organizationDomainDiscover({
        database: options.database,
        domain: context.req.query("domain") ?? organizationRequestHostGet(context.req.header("host"), context.req.url),
      }),
    ),
  )
  app.get("/api/v2/bootstrap", (context) =>
    organizationResultResponseCreate(
      context,
      organizationDomainDiscover({
        database: options.database,
        domain: context.req.query("domain") ?? organizationRequestHostGet(context.req.header("host"), context.req.url),
      }),
    ),
  )

  app.get("/system/organization-roles", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(context, organizationRoleList(query.data))
  })

  app.get("/organization-roles", (context) => {
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(context, organizationRoleList(query.data))
  })

  app.get("/system/realms/:realmId/organizations", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(
      context,
      organizationList({
        context: systemContext,
        database: options.database,
        realmId: context.req.param("realmId"),
        query: query.data,
      }),
    )
  })

  app.post("/system/realms/:realmId/organizations", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationCreateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate("organizationCreate", "The organization request is invalid.", "organizations.invalid"),
      )
    return organizationResultResponseCreate(
      context,
      organizationCreate({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.get("/system/realms/:realmId/organizations/:organizationId", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const result = organizationGet({
      context: systemContext,
      database: options.database,
      realmId: context.req.param("realmId"),
      organizationId: context.req.param("organizationId"),
    })
    return organizationResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.organization.updatedAt) : undefined,
    )
  })

  app.patch("/system/realms/:realmId/organizations/:organizationId", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationUpdateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate("organizationUpdate", "The organization update is invalid.", "organizations.invalid"),
      )
    return organizationResultResponseCreate(
      context,
      organizationUpdate({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.get("/system/realms/:realmId/login-policy", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationRealmLoginPolicyGet({ database: options.database, realmId: context.req.param("realmId") }),
    )
  })

  app.patch("/system/realms/:realmId/login-policy", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationLoginPolicySetRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationRealmLoginPolicySet",
          "The login policy is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationRealmLoginPolicySet({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.get("/system/realms/:realmId/organizations/:organizationId/branding", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const result = organizationBrandingGet({
      database: options.database,
      realmId: context.req.param("realmId"),
      organizationId: context.req.param("organizationId"),
    })
    return organizationResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.updatedAt) : undefined,
    )
  })

  app.put("/system/realms/:realmId/organizations/:organizationId/branding", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationBrandingSetRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate("organizationBrandingSet", "The branding is invalid.", "organizations.invalid"),
      )
    return organizationResultResponseCreate(
      context,
      organizationBrandingSet({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.get("/system/realms/:realmId/organizations/:organizationId/login-policy", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationLoginPolicyGet({
        database: options.database,
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.patch("/system/realms/:realmId/organizations/:organizationId/login-policy", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationLoginPolicySetRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate("organizationLoginPolicySet", "The login policy is invalid.", "organizations.invalid"),
      )
    return organizationResultResponseCreate(
      context,
      organizationLoginPolicySet({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.get("/system/realms/:realmId/organizations/:organizationId/domains", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(
      context,
      organizationDomainList({
        database: options.database,
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
        query: query.data,
      }),
    )
  })

  app.post("/system/realms/:realmId/organizations/:organizationId/domains", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationDomainClaimRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate("organizationDomainClaim", "The domain claim is invalid.", "organizations.invalid"),
      )
    return organizationResultResponseCreate(
      context,
      organizationDomainClaim({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
      }),
      201,
    )
  })

  app.post("/system/realms/:realmId/organizations/:organizationId/domains/:domain/verify", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      await organizationDomainVerify({
        context: systemContext,
        database: options.database,
        dnsPort: domainVerificationPort,
        domain: context.req.param("domain"),
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.delete("/system/realms/:realmId/organizations/:organizationId/domains/:domain", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationDomainRemove({
        context: systemContext,
        database: options.database,
        domain: context.req.param("domain"),
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.post("/system/realms/:realmId/organizations/:organizationId/lifecycle", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationLifecycleRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationLifecycleSet",
          "The organization lifecycle request is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationLifecycleSet({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.get("/system/realms/:realmId/organizations/:organizationId/memberships", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(
      context,
      organizationMembershipList({
        context: systemContext,
        database: options.database,
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
        query: query.data,
      }),
    )
  })

  app.post("/system/realms/:realmId/organizations/:organizationId/memberships", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationMembershipCreateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationMembershipCreate",
          "The organization membership request is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationMembershipCreate({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
      }),
      201,
    )
  })

  app.patch("/system/realms/:realmId/organizations/:organizationId/memberships/:membershipId", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationMembershipUpdateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationMembershipUpdate",
          "The organization membership update is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationMembershipUpdate({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        membershipId: context.req.param("membershipId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.delete("/system/realms/:realmId/organizations/:organizationId/memberships/:membershipId", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationMembershipRemove({
        context: systemContext,
        database: options.database,
        realmId: context.req.param("realmId"),
        membershipId: context.req.param("membershipId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.get("/system/realms/:realmId/organizations/:organizationId/invitations", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(
      context,
      organizationInvitationList({
        context: systemContext,
        database: options.database,
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
        query: query.data,
      }),
    )
  })

  app.post("/system/realms/:realmId/organizations/:organizationId/invitations", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationInvitationCreateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationInvitationCreate",
          "The organization invitation request is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationInvitationCreate({
        context: systemContext,
        database: options.database,
        input: input.output,
        onInvitationDelivery: options.onInvitationDelivery,
        realmId: context.req.param("realmId"),
        organizationId: context.req.param("organizationId"),
      }),
      201,
    )
  })

  app.post("/system/realms/:realmId/organizations/:organizationId/invitations/:invitationId/revoke", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationInvitationRevoke({
        context: systemContext,
        database: options.database,
        realmId: context.req.param("realmId"),
        invitationId: context.req.param("invitationId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  organizationAdministratorRoutesRegister(app, options, domainVerificationPort)

  app.get("/realms/:realmId/me/organizations", protectedMiddleware, (context) => {
    const subject = organizationSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return organizationErrorResponseCreate(context, subject)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(
      context,
      organizationMeList({
        context: subject.data,
        database: options.database,
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/me/organizations/switch", protectedMiddleware, async (context) => {
    const subject = organizationSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return organizationErrorResponseCreate(context, subject)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationMeSwitchRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationMeSwitch",
          "The organization switch request is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationMeSwitch({
        context: subject.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        sessionId: context.get("session").id,
      }),
    )
  })

  app.get("/realms/:realmId/me/invitations", protectedMiddleware, (context) => {
    const subject = organizationSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return organizationErrorResponseCreate(context, subject)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(
      context,
      organizationInvitationMeList({
        context: subject.data,
        database: options.database,
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.get("/realms/:realmId/me/invitations/:token", protectedMiddleware, (context) => {
    const subject = organizationSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return organizationErrorResponseCreate(context, subject)
    return organizationResultResponseCreate(
      context,
      organizationInvitationMeInspect({
        context: subject.data,
        database: options.database,
        input: { token: context.req.param("token") },
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/me/invitations/inspect", protectedMiddleware, async (context) => {
    const subject = organizationSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return organizationErrorResponseCreate(context, subject)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationInvitationMeInspectRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationInvitationMeInspect",
          "The organization invitation token is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationInvitationMeInspect({
        context: subject.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/me/invitations/accept", protectedMiddleware, async (context) => {
    const subject = organizationSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return organizationErrorResponseCreate(context, subject)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationInvitationMeAcceptRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationInvitationMeAccept",
          "The organization invitation acceptance is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationInvitationMeAccept({
        context: subject.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/me/invitations/decline", protectedMiddleware, async (context) => {
    const subject = organizationSubjectContextResolve(context, context.req.param("realmId"))
    if (!subject.success) return organizationErrorResponseCreate(context, subject)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationInvitationMeDeclineRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationInvitationMeDecline",
          "The organization invitation decline is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationInvitationMeDecline({
        context: subject.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/organizations/invitations/accept", async (context) => {
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationInvitationAcceptRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationInvitationAccept",
          "The invitation acceptance is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationInvitationAccept({ database: options.database, input: input.output }),
    )
  })

  app.post("/organizations/invitations/decline", async (context) => {
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationInvitationAcceptRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationInvitationDecline",
          "The invitation decline is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationInvitationDecline({ database: options.database, input: input.output }),
    )
  })

  app.post("/system/realms/:realmId/organizations/switch", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationSwitchRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationSwitch",
          "The organization switch request is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationSwitch({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/organizations/switch", async (context) => {
    const tenant = organizationTenantContextResolve(options.database, context.req.header("host"), context.req.url)
    if (!tenant.success) return organizationErrorResponseCreate(context, tenant)
    const authenticated = realmBootstrapAdminAuthenticate({
      context: tenant.data,
      database: options.database,
      secret: organizationBearerTokenGet(context.req.header("authorization")) ?? "",
    })
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationSwitchRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationSwitch",
          "The organization switch request is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationSwitch({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: authenticated.data.realmId,
      }),
    )
  })

  return app
}

function organizationAdministratorRoutesRegister(
  app: Hono<OrganizationServerEnv>,
  options: OrganizationServerAppCreateOptions,
  domainVerificationPort: ReturnType<typeof organizationDomainDnsVerificationPortCreate>,
) {
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    publicOrigin: options.publicOrigin,
  })

  app.get("/realms/:realmId/organization-roles", protectedMiddleware, (context) => {
    const authenticated = organizationAdminPermissionAuthorize(
      context,
      options.database,
      context.req.param("realmId"),
      "organization.read",
    )
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(context, organizationRoleList(query.data))
  })

  app.get("/realms/:realmId/organizations", protectedMiddleware, (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(
      context,
      organizationList({
        context: authenticated.data,
        database: options.database,
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/organizations", protectedMiddleware, async (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationCreateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate("organizationCreate", "The organization request is invalid.", "organizations.invalid"),
      )
    return organizationResultResponseCreate(
      context,
      organizationCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.get("/realms/:realmId/organizations/:organizationId", protectedMiddleware, (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const result = organizationGet({
      context: authenticated.data,
      database: options.database,
      organizationId: context.req.param("organizationId"),
      realmId: context.req.param("realmId"),
    })
    return organizationResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.organization.updatedAt) : undefined,
    )
  })

  app.patch("/realms/:realmId/organizations/:organizationId", protectedMiddleware, async (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationUpdateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate("organizationUpdate", "The organization update is invalid.", "organizations.invalid"),
      )
    return organizationResultResponseCreate(
      context,
      organizationUpdate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/organizations/:organizationId/lifecycle", protectedMiddleware, async (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationLifecycleRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationLifecycleSet",
          "The organization lifecycle request is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationLifecycleSet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.get("/realms/:realmId/login-policy", protectedMiddleware, (context) => {
    const authenticated = organizationAdminPermissionAuthorize(
      context,
      options.database,
      context.req.param("realmId"),
      "organization.read",
    )
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    return organizationResultResponseCreate(
      context,
      organizationRealmLoginPolicyGet({
        context: authenticated.data,
        database: options.database,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.patch("/realms/:realmId/login-policy", protectedMiddleware, async (context) => {
    const authenticated = organizationAdminPermissionAuthorize(
      context,
      options.database,
      context.req.param("realmId"),
      "organization.manage",
    )
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationLoginPolicySetRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationRealmLoginPolicySet",
          "The login policy is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationRealmLoginPolicySet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.get("/realms/:realmId/organizations/:organizationId/branding", protectedMiddleware, (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const result = organizationBrandingGet({
      context: authenticated.data,
      database: options.database,
      organizationId: context.req.param("organizationId"),
      realmId: context.req.param("realmId"),
    })
    return organizationResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.updatedAt) : undefined,
    )
  })

  app.put("/realms/:realmId/organizations/:organizationId/branding", protectedMiddleware, async (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationBrandingSetRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate("organizationBrandingSet", "The branding is invalid.", "organizations.invalid"),
      )
    return organizationResultResponseCreate(
      context,
      organizationBrandingSet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.get("/realms/:realmId/organizations/:organizationId/login-policy", protectedMiddleware, (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    return organizationResultResponseCreate(
      context,
      organizationLoginPolicyGet({
        context: authenticated.data,
        database: options.database,
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.patch("/realms/:realmId/organizations/:organizationId/login-policy", protectedMiddleware, async (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationLoginPolicySetRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate("organizationLoginPolicySet", "The login policy is invalid.", "organizations.invalid"),
      )
    return organizationResultResponseCreate(
      context,
      organizationLoginPolicySet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.get("/realms/:realmId/organizations/:organizationId/domains", protectedMiddleware, (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(
      context,
      organizationDomainList({
        context: authenticated.data,
        database: options.database,
        organizationId: context.req.param("organizationId"),
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/organizations/:organizationId/domains", protectedMiddleware, async (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationDomainClaimRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate("organizationDomainClaim", "The domain claim is invalid.", "organizations.invalid"),
      )
    return organizationResultResponseCreate(
      context,
      organizationDomainClaim({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.post(
    "/realms/:realmId/organizations/:organizationId/domains/:domain/verify",
    protectedMiddleware,
    async (context) => {
      const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
      if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
      return organizationResultResponseCreate(
        context,
        await organizationDomainVerify({
          context: authenticated.data,
          database: options.database,
          dnsPort: domainVerificationPort,
          domain: context.req.param("domain"),
          organizationId: context.req.param("organizationId"),
          realmId: context.req.param("realmId"),
        }),
      )
    },
  )

  app.delete("/realms/:realmId/organizations/:organizationId/domains/:domain", protectedMiddleware, (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    return organizationResultResponseCreate(
      context,
      organizationDomainRemove({
        context: authenticated.data,
        database: options.database,
        domain: context.req.param("domain"),
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.get("/realms/:realmId/organizations/:organizationId/memberships", protectedMiddleware, (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(
      context,
      organizationMembershipList({
        context: authenticated.data,
        database: options.database,
        organizationId: context.req.param("organizationId"),
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/organizations/:organizationId/memberships", protectedMiddleware, async (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationMembershipCreateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationMembershipCreate",
          "The organization membership request is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationMembershipCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.patch(
    "/realms/:realmId/organizations/:organizationId/memberships/:membershipId",
    protectedMiddleware,
    async (context) => {
      const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
      if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
      const body = await organizationRequestJsonRead(context)
      if (!body.success) return organizationErrorResponseCreate(context, body)
      const input = v.safeParse(organizationMembershipUpdateRequestSchema, body.data)
      if (!input.success)
        return organizationErrorResponseCreate(
          context,
          resultErrorCodedCreate(
            "organizationMembershipUpdate",
            "The organization membership update is invalid.",
            "organizations.invalid",
          ),
        )
      return organizationResultResponseCreate(
        context,
        organizationMembershipUpdate({
          context: authenticated.data,
          database: options.database,
          input: input.output,
          membershipId: context.req.param("membershipId"),
          organizationId: context.req.param("organizationId"),
          realmId: context.req.param("realmId"),
        }),
      )
    },
  )

  app.delete(
    "/realms/:realmId/organizations/:organizationId/memberships/:membershipId",
    protectedMiddleware,
    (context) => {
      const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
      if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
      return organizationResultResponseCreate(
        context,
        organizationMembershipRemove({
          context: authenticated.data,
          database: options.database,
          membershipId: context.req.param("membershipId"),
          organizationId: context.req.param("organizationId"),
          realmId: context.req.param("realmId"),
        }),
      )
    },
  )

  app.get("/realms/:realmId/organizations/:organizationId/invitations", protectedMiddleware, (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const query = organizationListQueryRead(context.req.url)
    if (!query.success) return organizationErrorResponseCreate(context, query)
    return organizationResultResponseCreate(
      context,
      organizationInvitationList({
        context: authenticated.data,
        database: options.database,
        organizationId: context.req.param("organizationId"),
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/organizations/:organizationId/invitations", protectedMiddleware, async (context) => {
    const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationInvitationCreateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(
        context,
        resultErrorCodedCreate(
          "organizationInvitationCreate",
          "The organization invitation request is invalid.",
          "organizations.invalid",
        ),
      )
    return organizationResultResponseCreate(
      context,
      organizationInvitationCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        onInvitationDelivery: options.onInvitationDelivery,
        organizationId: context.req.param("organizationId"),
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.post(
    "/realms/:realmId/organizations/:organizationId/invitations/:invitationId/revoke",
    protectedMiddleware,
    (context) => {
      const authenticated = organizationAdminContextResolve(context, context.req.param("realmId"))
      if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
      return organizationResultResponseCreate(
        context,
        organizationInvitationRevoke({
          context: authenticated.data,
          database: options.database,
          invitationId: context.req.param("invitationId"),
          organizationId: context.req.param("organizationId"),
          realmId: context.req.param("realmId"),
        }),
      )
    },
  )
}

function organizationAdminContextResolve(
  context: { readonly get: (key: "authorizationActor") => AuthorizationActorContext },
  realmId: string,
): Result<RealmTenantContext> {
  const actor = context.get("authorizationActor")
  if (actor.realmId !== realmId)
    return resultErrorCodedCreate(
      "organizationAdminContextResolve",
      "The actor is not available in this tenant context.",
      "organizations.tenant-mismatch",
    )
  if (actor.kind !== "user" && actor.kind !== "bootstrap_admin")
    return resultErrorCodedCreate(
      "organizationAdminContextResolve",
      "The actor is not authorized for organization administration.",
      "organizations.forbidden",
    )
  return { data: { actor, actorId: actor.actorId, kind: "tenant", realmId }, success: true }
}

function organizationAdminPermissionAuthorize(
  context: { readonly get: (key: "authorizationActor") => AuthorizationActorContext },
  database: StorageDatabase,
  realmId: string,
  permission: "organization.read" | "organization.manage" | "organization.members.manage",
): Result<RealmTenantContext> {
  return realmAdministratorContextAuthorize({ actor: context.get("authorizationActor"), database, permission, realmId })
}

function organizationErrorResponseCreate(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: Result<unknown>,
) {
  return httpResultResponseCreate(context, result)
}

function organizationResultResponseCreate<T>(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: Result<T>,
  status = 200,
  lastModified?: Date,
) {
  return httpResultResponseCreate(context, result, status, lastModified)
}

async function organizationRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return resultErrorCodedCreate(
      "organizationRequestJsonRead",
      "The request body is invalid.",
      "organizations.invalid",
    )
  }
}

function organizationSystemAuthorizationGet(
  authorization: string | undefined,
  configuredSecret: Secret | string | undefined,
) {
  const token = organizationBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return resultErrorCodedCreate(
      "organizationSystemAuthorizationGet",
      "System authorization is required.",
      "organizations.unauthorized",
    )
  return { data: undefined, success: true as const }
}

function organizationBearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? null
}

function organizationListQueryRead(requestUrl: string): Result<ListQuery> {
  const parsed = listQueryFromSearchParams(new URL(requestUrl).searchParams)
  if (!parsed.success)
    return resultErrorCodedCreate("organizationListQueryRead", "The list query is invalid.", "organizations.invalid")
  return parsed
}

function organizationSubjectContextResolve(
  context: { readonly get: (key: "authorizationActor") => AuthorizationActorContext },
  realmId: string,
): Result<RealmTenantContext> {
  const op = "organizationSubjectContextResolve"
  const actor = context.get("authorizationActor")
  if (actor.kind !== "user" || actor.realmId !== realmId)
    return resultErrorCodedCreate(
      op,
      "The authenticated user is not available in this realm.",
      "organizations.forbidden",
    )
  return { data: { actor, actorId: actor.actorId, kind: "tenant", realmId }, success: true }
}

function organizationTenantContextResolve(database: StorageDatabase, host: string | undefined, requestUrl: string) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : resolvedHost.split(":")[0]
  return realmTenantContextResolve({ database, host: normalizedHost ?? "" })
}

function organizationRequestHostGet(host: string | undefined, requestUrl: string): string {
  const value = host ?? new URL(requestUrl).hostname
  return value.startsWith("[") ? value.slice(1, value.indexOf("]")) : (value.split(":")[0] ?? "")
}
