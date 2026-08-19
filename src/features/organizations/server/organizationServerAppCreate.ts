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
import { realmBootstrapAdminAuthenticate } from "../../realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { organizationCreate } from "../actions/organizationCreate.js"
import { organizationBrandingGet } from "../actions/organizationBrandingGet.js"
import { organizationBrandingSet } from "../actions/organizationBrandingSet.js"
import { organizationDomainClaim } from "../actions/organizationDomainClaim.js"
import { organizationDomainDiscover } from "../actions/organizationDomainDiscover.js"
import { organizationDomainList } from "../actions/organizationDomainList.js"
import { organizationDomainRemove } from "../actions/organizationDomainRemove.js"
import { organizationDomainVerify } from "../actions/organizationDomainVerify.js"
import { organizationRealmLoginPolicyGet } from "../actions/organizationRealmLoginPolicyGet.js"
import { organizationRealmLoginPolicySet } from "../actions/organizationRealmLoginPolicySet.js"
import { organizationLoginPolicyGet } from "../actions/organizationLoginPolicyGet.js"
import { organizationLoginPolicySet } from "../actions/organizationLoginPolicySet.js"
import { organizationDomainDnsVerificationPortCreate } from "../domain/organizationDomainDnsVerificationPortCreate.js"
import { organizationGet } from "../actions/organizationGet.js"
import { organizationInvitationAccept } from "../actions/organizationInvitationAccept.js"
import { organizationInvitationCreate } from "../actions/organizationInvitationCreate.js"
import { organizationInvitationDecline } from "../actions/organizationInvitationDecline.js"
import { organizationInvitationList } from "../actions/organizationInvitationList.js"
import { organizationInvitationRevoke } from "../actions/organizationInvitationRevoke.js"
import { organizationLifecycleSet } from "../actions/organizationLifecycleSet.js"
import { organizationList } from "../actions/organizationList.js"
import { organizationMembershipCreate } from "../actions/organizationMembershipCreate.js"
import { organizationMembershipList } from "../actions/organizationMembershipList.js"
import { organizationMembershipRemove } from "../actions/organizationMembershipRemove.js"
import { organizationMembershipUpdate } from "../actions/organizationMembershipUpdate.js"
import { organizationRoleList } from "../actions/organizationRoleList.js"
import { organizationSwitch } from "../actions/organizationSwitch.js"
import { organizationUpdate } from "../actions/organizationUpdate.js"
import { organizationCreateRequestSchema } from "../public/organizationCreateRequestSchema.js"
import { organizationInvitationAcceptRequestSchema } from "../public/organizationInvitationAcceptRequestSchema.js"
import { organizationInvitationCreateRequestSchema } from "../public/organizationInvitationCreateRequestSchema.js"
import { organizationLifecycleRequestSchema } from "../public/organizationLifecycleRequestSchema.js"
import { organizationMembershipCreateRequestSchema } from "../public/organizationMembershipCreateRequestSchema.js"
import { organizationMembershipUpdateRequestSchema } from "../public/organizationMembershipUpdateRequestSchema.js"
import { organizationSwitchRequestSchema } from "../public/organizationSwitchRequestSchema.js"
import { organizationUpdateRequestSchema } from "../public/organizationUpdateRequestSchema.js"
import { organizationBrandingSetRequestSchema } from "../public/organizationBrandingSetRequestSchema.js"
import { organizationDomainClaimRequestSchema } from "../public/organizationDomainClaimRequestSchema.js"
import { organizationLoginPolicySetRequestSchema } from "../public/organizationLoginPolicySetRequestSchema.js"

type OrganizationServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly domainVerificationPort?: ReturnType<typeof organizationDomainDnsVerificationPortCreate>
  readonly systemSecret?: Secret | string
}

export function organizationServerAppCreate(options: OrganizationServerAppCreateOptions) {
  const app = new Hono()
  const systemContext = realmSystemContextCreate("system")
  const domainVerificationPort = options.domainVerificationPort ?? organizationDomainDnsVerificationPortCreate()

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
