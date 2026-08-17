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
import { organizationCreate } from "../actions/organizationCreate.js"
import { organizationBrandingGet } from "../actions/organizationBrandingGet.js"
import { organizationBrandingSet } from "../actions/organizationBrandingSet.js"
import { organizationDomainClaim } from "../actions/organizationDomainClaim.js"
import { organizationDomainDiscover } from "../actions/organizationDomainDiscover.js"
import { organizationDomainList } from "../actions/organizationDomainList.js"
import { organizationDomainRemove } from "../actions/organizationDomainRemove.js"
import { organizationDomainVerify } from "../actions/organizationDomainVerify.js"
import { organizationInstanceLoginPolicyGet } from "../actions/organizationInstanceLoginPolicyGet.js"
import { organizationInstanceLoginPolicySet } from "../actions/organizationInstanceLoginPolicySet.js"
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
  const systemContext = instanceSystemContextCreate("system")
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
    return context.json(organizationRoleList().data)
  })

  app.get("/organization-roles", (context) => context.json(organizationRoleList().data))

  app.get("/system/instances/:instanceId/organizations", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationList({
        context: systemContext,
        database: options.database,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  app.post("/system/instances/:instanceId/organizations", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationCreateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The organization request is invalid.",
        op: "organizationCreate",
      })
    return organizationResultResponseCreate(
      context,
      organizationCreate({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
      }),
      201,
    )
  })

  app.get("/system/instances/:instanceId/organizations/:organizationId", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationGet({
        context: systemContext,
        database: options.database,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.patch("/system/instances/:instanceId/organizations/:organizationId", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationUpdateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The organization update is invalid.",
        op: "organizationUpdate",
      })
    return organizationResultResponseCreate(
      context,
      organizationUpdate({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.get("/system/instances/:instanceId/login-policy", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationInstanceLoginPolicyGet({ database: options.database, instanceId: context.req.param("instanceId") }),
    )
  })

  app.patch("/system/instances/:instanceId/login-policy", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationLoginPolicySetRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The login policy is invalid.",
        op: "organizationInstanceLoginPolicySet",
      })
    return organizationResultResponseCreate(
      context,
      organizationInstanceLoginPolicySet({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  app.get("/system/instances/:instanceId/organizations/:organizationId/branding", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationBrandingGet({
        database: options.database,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.put("/system/instances/:instanceId/organizations/:organizationId/branding", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationBrandingSetRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The branding is invalid.",
        op: "organizationBrandingSet",
      })
    return organizationResultResponseCreate(
      context,
      organizationBrandingSet({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.get("/system/instances/:instanceId/organizations/:organizationId/login-policy", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationLoginPolicyGet({
        database: options.database,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.patch("/system/instances/:instanceId/organizations/:organizationId/login-policy", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationLoginPolicySetRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The login policy is invalid.",
        op: "organizationLoginPolicySet",
      })
    return organizationResultResponseCreate(
      context,
      organizationLoginPolicySet({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.get("/system/instances/:instanceId/organizations/:organizationId/domains", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationDomainList({
        database: options.database,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.post("/system/instances/:instanceId/organizations/:organizationId/domains", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationDomainClaimRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The domain claim is invalid.",
        op: "organizationDomainClaim",
      })
    return organizationResultResponseCreate(
      context,
      organizationDomainClaim({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
      201,
    )
  })

  app.post("/system/instances/:instanceId/organizations/:organizationId/domains/:domain/verify", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      await organizationDomainVerify({
        context: systemContext,
        database: options.database,
        dnsPort: domainVerificationPort,
        domain: context.req.param("domain"),
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.delete("/system/instances/:instanceId/organizations/:organizationId/domains/:domain", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationDomainRemove({
        context: systemContext,
        database: options.database,
        domain: context.req.param("domain"),
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.post("/system/instances/:instanceId/organizations/:organizationId/lifecycle", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationLifecycleRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The organization lifecycle request is invalid.",
        op: "organizationLifecycleSet",
      })
    return organizationResultResponseCreate(
      context,
      organizationLifecycleSet({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.get("/system/instances/:instanceId/organizations/:organizationId/memberships", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationMembershipList({
        context: systemContext,
        database: options.database,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.post("/system/instances/:instanceId/organizations/:organizationId/memberships", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationMembershipCreateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The organization membership request is invalid.",
        op: "organizationMembershipCreate",
      })
    return organizationResultResponseCreate(
      context,
      organizationMembershipCreate({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
      201,
    )
  })

  app.patch(
    "/system/instances/:instanceId/organizations/:organizationId/memberships/:membershipId",
    async (context) => {
      const authorization = organizationSystemAuthorizationGet(
        context.req.header("authorization"),
        options.systemSecret,
      )
      if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
      const body = await organizationRequestJsonRead(context)
      if (!body.success) return organizationErrorResponseCreate(context, body)
      const input = v.safeParse(organizationMembershipUpdateRequestSchema, body.data)
      if (!input.success)
        return organizationErrorResponseCreate(context, {
          errorMessage: "The organization membership update is invalid.",
          op: "organizationMembershipUpdate",
        })
      return organizationResultResponseCreate(
        context,
        organizationMembershipUpdate({
          context: systemContext,
          database: options.database,
          input: input.output,
          instanceId: context.req.param("instanceId"),
          membershipId: context.req.param("membershipId"),
          organizationId: context.req.param("organizationId"),
        }),
      )
    },
  )

  app.delete("/system/instances/:instanceId/organizations/:organizationId/memberships/:membershipId", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationMembershipRemove({
        context: systemContext,
        database: options.database,
        instanceId: context.req.param("instanceId"),
        membershipId: context.req.param("membershipId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.get("/system/instances/:instanceId/organizations/:organizationId/invitations", (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    return organizationResultResponseCreate(
      context,
      organizationInvitationList({
        context: systemContext,
        database: options.database,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
    )
  })

  app.post("/system/instances/:instanceId/organizations/:organizationId/invitations", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationInvitationCreateRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The organization invitation request is invalid.",
        op: "organizationInvitationCreate",
      })
    return organizationResultResponseCreate(
      context,
      organizationInvitationCreate({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
        organizationId: context.req.param("organizationId"),
      }),
      201,
    )
  })

  app.post(
    "/system/instances/:instanceId/organizations/:organizationId/invitations/:invitationId/revoke",
    (context) => {
      const authorization = organizationSystemAuthorizationGet(
        context.req.header("authorization"),
        options.systemSecret,
      )
      if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
      return organizationResultResponseCreate(
        context,
        organizationInvitationRevoke({
          context: systemContext,
          database: options.database,
          instanceId: context.req.param("instanceId"),
          invitationId: context.req.param("invitationId"),
          organizationId: context.req.param("organizationId"),
        }),
      )
    },
  )

  app.post("/organizations/invitations/accept", async (context) => {
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationInvitationAcceptRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The invitation acceptance is invalid.",
        op: "organizationInvitationAccept",
      })
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
      return organizationErrorResponseCreate(context, {
        errorMessage: "The invitation decline is invalid.",
        op: "organizationInvitationDecline",
      })
    return organizationResultResponseCreate(
      context,
      organizationInvitationDecline({ database: options.database, input: input.output }),
    )
  })

  app.post("/system/instances/:instanceId/organizations/switch", async (context) => {
    const authorization = organizationSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return organizationErrorResponseCreate(context, authorization)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationSwitchRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The organization switch request is invalid.",
        op: "organizationSwitch",
      })
    return organizationResultResponseCreate(
      context,
      organizationSwitch({
        context: systemContext,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  app.post("/organizations/switch", async (context) => {
    const tenant = organizationTenantContextResolve(options.database, context.req.header("host"), context.req.url)
    if (!tenant.success) return organizationErrorResponseCreate(context, tenant)
    const authenticated = instanceBootstrapAdminAuthenticate({
      context: tenant.data,
      database: options.database,
      secret: organizationBearerTokenGet(context.req.header("authorization")) ?? "",
    })
    if (!authenticated.success) return organizationErrorResponseCreate(context, authenticated)
    const body = await organizationRequestJsonRead(context)
    if (!body.success) return organizationErrorResponseCreate(context, body)
    const input = v.safeParse(organizationSwitchRequestSchema, body.data)
    if (!input.success)
      return organizationErrorResponseCreate(context, {
        errorMessage: "The organization switch request is invalid.",
        op: "organizationSwitch",
      })
    return organizationResultResponseCreate(
      context,
      organizationSwitch({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        instanceId: authenticated.data.instanceId,
      }),
    )
  })

  return app
}

function organizationErrorResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { errorMessage: string; op: string },
) {
  const code = organizationErrorCodeGet(result)
  return context.json(
    httpErrorResponseCreate(code, result.errorMessage),
    httpErrorStatusGet(code) as ContentfulStatusCode,
  )
}

function organizationErrorCodeGet(result: { errorMessage: string; op: string }): string {
  const message = result.errorMessage.toLowerCase()
  if (result.op.includes("systemAuthorization") || message.includes("authorization is required")) return "unauthorized"
  if (message.includes("not a member") || message.includes("not authorized") || message.includes("only the system"))
    return "forbidden"
  if (message.includes("not found") || message.includes("not available")) return "not_found"
  if (
    message.includes("already") ||
    message.includes("pending") ||
    message.includes("must retain") ||
    message.includes("removed") ||
    message.includes("not active") ||
    message.includes("expired")
  )
    return "conflict"
  if (
    message.includes("invalid") ||
    message.includes("empty") ||
    message.includes("unique") ||
    message.includes("expiry")
  )
    return "bad_request"
  return "internal_server_error"
}

function organizationResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; op?: string; success: boolean },
  status = 200,
) {
  if (!result.success) return organizationErrorResponseCreate(context, result as { errorMessage: string; op: string })
  return context.json(result.data, status as ContentfulStatusCode)
}

async function organizationRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return { errorMessage: "The request body is invalid.", op: "organizationRequestJsonRead", success: false as const }
  }
}

function organizationSystemAuthorizationGet(
  authorization: string | undefined,
  configuredSecret: Secret | string | undefined,
) {
  const token = organizationBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return {
      errorMessage: "System authorization is required.",
      op: "organizationSystemAuthorizationGet",
      success: false as const,
    }
  return { data: undefined, success: true as const }
}

function organizationBearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? null
}

function organizationTenantContextResolve(database: StorageDatabase, host: string | undefined, requestUrl: string) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : resolvedHost.split(":")[0]
  return instanceTenantContextResolve({ database, host: normalizedHost ?? "" })
}

function organizationRequestHostGet(host: string | undefined, requestUrl: string): string {
  const value = host ?? new URL(requestUrl).hostname
  return value.startsWith("[") ? value.slice(1, value.indexOf("]")) : (value.split(":")[0] ?? "")
}
