import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
import { organizationApiClientCreate } from "../client/organizationApiClientCreate.js"
import type { OrganizationBrandingSetRequest } from "../public/organizationBrandingSetRequestSchema.js"
import type { OrganizationLoginPolicySetRequest } from "../public/organizationLoginPolicySetRequestSchema.js"

type OrganizationCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly token?: string
}

type OrganizationIdCliFlags = OrganizationCliFlags & {
  readonly realmId?: string
  readonly organizationId?: string
}
type OrganizationGetCliFlags = OrganizationIdCliFlags & { readonly ifModifiedSince?: string }

type OrganizationListCliFlags = OrganizationCliFlags & {
  readonly realmId?: string
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}

type OrganizationNestedListCliFlags = OrganizationIdCliFlags & {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}

type OrganizationRoleListCliFlags = OrganizationCliFlags & {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}

const organizationCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: OrganizationCliFlags & { name: string; ownerUserId?: string; realmId?: string },
  ) {
    const resolved = await organizationCliRealmResolve(this, flags)
    if (resolved === undefined) return
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationCreate(resolved.realmId, {
        name: flags.name,
        ownerUserId: flags.ownerUserId,
      }),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      name: textFlag("Organization display name"),
      ownerUserId: optionalTextFlag("Initial owner user ID"),
    },
  },
  docs: { brief: "Create an organization" },
})

const organizationListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationListCliFlags & { realmId?: string }) {
    const resolved = await organizationCliRealmResolve(this, flags)
    if (resolved === undefined) return
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationList(
        resolved.realmId,
        organizationListQueryCreate(flags),
      ),
      [resolved.connection.token],
    )
  },
  parameters: { flags: { ...organizationCommonFlags(), ...organizationListFlags(), realmId: realmIdFlag() } },
  docs: { brief: "List organizations" },
})

const organizationGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationGetCliFlags) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationGet(
        ids.realmId,
        ids.organizationId,
        flags.ifModifiedSince === undefined ? undefined : { ifModifiedSince: flags.ifModifiedSince },
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      ifModifiedSince: ifModifiedSinceFlag(),
    },
  },
  docs: { brief: "Get an organization" },
})

const organizationUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { name: string }) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationUpdate(ids.realmId, ids.organizationId, {
        name: flags.name,
      }),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      name: textFlag("Organization display name"),
    },
  },
  docs: { brief: "Rename an organization" },
})

const organizationBrandingSetCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { branding: string }) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationBrandingSet(
        ids.realmId,
        ids.organizationId,
        organizationCliJsonParse(flags.branding) as OrganizationBrandingSetRequest,
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      branding: textFlag("Branding JSON document"),
    },
  },
  docs: { brief: "Set organization branding metadata" },
})

const organizationDomainClaimCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { domain: string; primary?: boolean }) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationDomainClaim(ids.realmId, ids.organizationId, {
        domain: flags.domain,
        isPrimary: flags.primary,
      }),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      domain: textFlag("Organization domain"),
      primary: optionalBooleanFlag("Make this the primary domain"),
    },
  },
  docs: { brief: "Claim an organization domain" },
})

const organizationDomainListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationNestedListCliFlags) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationDomainList(
        ids.realmId,
        ids.organizationId,
        organizationListQueryCreate(flags),
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      ...organizationListFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
    },
  },
  docs: { brief: "List organization domains" },
})

const organizationDomainVerifyCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { domain: string }) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationDomainVerify(
        ids.realmId,
        ids.organizationId,
        flags.domain,
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      domain: textFlag("Organization domain"),
    },
  },
  docs: { brief: "Verify an organization domain through DNS" },
})

const organizationLoginPolicySetCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { policy: string }) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationLoginPolicySet(
        ids.realmId,
        ids.organizationId,
        organizationCliJsonParse(flags.policy) as OrganizationLoginPolicySetRequest,
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      policy: textFlag("Login policy JSON document"),
    },
  },
  docs: { brief: "Set organization login policy overrides" },
})

const organizationLoginPolicyGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationLoginPolicyGet(
        ids.realmId,
        ids.organizationId,
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
    },
  },
  docs: { brief: "Get organization login policy overrides" },
})

const organizationRealmLoginPolicyGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationCliFlags & { readonly realmId?: string }) {
    const resolved = await organizationCliRealmResolve(this, flags)
    if (resolved === undefined) return
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationRealmLoginPolicyGet(resolved.realmId),
      [resolved.connection.token],
    )
  },
  parameters: { flags: { ...organizationCommonFlags(), realmId: realmIdFlag() } },
  docs: { brief: "Get realm login policy defaults" },
})

const organizationRealmLoginPolicySetCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: OrganizationCliFlags & { readonly policy: string; readonly realmId?: string },
  ) {
    const resolved = await organizationCliRealmResolve(this, flags)
    if (resolved === undefined) return
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationRealmLoginPolicySet(
        resolved.realmId,
        organizationCliJsonParse(flags.policy) as OrganizationLoginPolicySetRequest,
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      policy: textFlag("Realm login policy JSON document"),
    },
  },
  docs: { brief: "Set realm login policy defaults" },
})

const organizationLifecycleCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { status: "active" | "inactive" | "removed" }) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationLifecycleSet(ids.realmId, ids.organizationId, {
        status: flags.status,
      }),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      status: {
        brief: "Lifecycle status",
        kind: "parsed" as const,
        parse: (value: string) => value as "active" | "inactive" | "removed",
        placeholder: "STATUS",
      },
    },
  },
  docs: { brief: "Change an organization lifecycle status" },
})

const organizationRolesCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationRoleListCliFlags) {
    const connection = await organizationCliConnectionResolve(this, flags)
    if (connection === undefined) return
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(connection).organizationRoleList(organizationListQueryCreate(flags)),
      [connection.token],
    )
  },
  parameters: { flags: { ...organizationCommonFlags(), ...organizationListFlags() } },
  docs: { brief: "List organization roles" },
})

const organizationMemberAddCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { userId: string; roles: string }) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationMembershipCreate(
        ids.realmId,
        ids.organizationId,
        {
          userId: flags.userId,
          roles: flags.roles.split(",") as ("owner" | "admin" | "member" | "guest")[],
        },
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      userId: textFlag("User ID"),
      roles: textFlag("Comma-separated roles"),
    },
  },
  docs: { brief: "Add an organization member" },
})

const organizationMemberListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationNestedListCliFlags) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationMembershipList(
        ids.realmId,
        ids.organizationId,
        organizationListQueryCreate(flags),
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      ...organizationListFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
    },
  },
  docs: { brief: "List organization members" },
})

const organizationMemberUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { membershipId: string; roles: string }) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationMembershipUpdate(
        ids.realmId,
        ids.organizationId,
        flags.membershipId,
        { roles: flags.roles.split(",") as ("owner" | "admin" | "member" | "guest")[] },
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      membershipId: textFlag("Membership ID"),
      roles: textFlag("Comma-separated roles"),
    },
  },
  docs: { brief: "Update an organization member" },
})

const organizationMemberRemoveCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { membershipId: string }) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationMembershipRemove(
        ids.realmId,
        ids.organizationId,
        flags.membershipId,
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      membershipId: textFlag("Membership ID"),
    },
  },
  docs: { brief: "Remove an organization member" },
})

const organizationInvitationCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: OrganizationIdCliFlags & { email: string; roles: string; expiresAt?: number },
  ) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationInvitationCreate(
        ids.realmId,
        ids.organizationId,
        {
          email: flags.email,
          roles: flags.roles.split(",") as ("owner" | "admin" | "member" | "guest")[],
          expiresAt: flags.expiresAt,
        },
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      email: textFlag("Invitee email"),
      roles: textFlag("Comma-separated roles"),
      expiresAt: optionalNumberFlag("Expiry timestamp"),
    },
  },
  docs: { brief: "Create an organization invitation" },
})

const organizationInvitationDeclineCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationCliFlags & { token: string; userId: string }) {
    const { token: payloadToken, ...connectionFlags } = flags
    const connection = await organizationCliConnectionResolve(this, connectionFlags, false)
    if (connection === undefined) return
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(connection).organizationInvitationDecline({
        token: flags.token,
        userId: flags.userId,
      }),
      [payloadToken, connection.token],
    )
  },
  parameters: {
    flags: { ...organizationCommonFlags(), token: textFlag("Invitation token"), userId: textFlag("Declining user ID") },
  },
  docs: { brief: "Decline an organization invitation" },
})

const organizationInvitationListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationNestedListCliFlags) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationInvitationList(
        ids.realmId,
        ids.organizationId,
        organizationListQueryCreate(flags),
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      ...organizationListFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
    },
  },
  docs: { brief: "List organization invitations" },
})

const organizationInvitationRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { invitationId: string }) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationInvitationRevoke(
        ids.realmId,
        ids.organizationId,
        flags.invitationId,
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      realmId: realmIdFlag(),
      organizationId: organizationFlag(),
      invitationId: textFlag("Invitation ID"),
    },
  },
  docs: { brief: "Revoke an organization invitation" },
})

const organizationInvitationAcceptCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationCliFlags & { token: string; userId: string }) {
    const { token: payloadToken, ...connectionFlags } = flags
    const connection = await organizationCliConnectionResolve(this, connectionFlags, false)
    if (connection === undefined) return
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(connection).organizationInvitationAccept({
        token: flags.token,
        userId: flags.userId,
      }),
      [payloadToken, connection.token],
    )
  },
  parameters: {
    flags: { ...organizationCommonFlags(), token: textFlag("Invitation token"), userId: textFlag("Accepting user ID") },
  },
  docs: { brief: "Accept an organization invitation" },
})

const organizationSwitchCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationCliFlags & { organizationId?: string; realmId?: string }) {
    const resolved = await organizationCliScopeResolve(this, flags)
    if (resolved === undefined) return
    const ids = resolved.ids
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(resolved.connection).organizationSwitch(ids.realmId, {
        organizationId: ids.organizationId,
      }),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: { ...organizationCommonFlags(), realmId: realmIdFlag(), organizationId: organizationFlag() },
  },
  docs: { brief: "Switch the active organization" },
})

export const organizationCliCommands = buildRouteMap({
  routes: {
    create: organizationCreateCommand,
    get: organizationGetCommand,
    list: organizationListCommand,
    memberAdd: organizationMemberAddCommand,
    memberList: organizationMemberListCommand,
    memberRemove: organizationMemberRemoveCommand,
    memberUpdate: organizationMemberUpdateCommand,
    invitationAccept: organizationInvitationAcceptCommand,
    invitationCreate: organizationInvitationCreateCommand,
    invitationDecline: organizationInvitationDeclineCommand,
    invitationList: organizationInvitationListCommand,
    invitationRevoke: organizationInvitationRevokeCommand,
    roles: organizationRolesCommand,
    switch: organizationSwitchCommand,
    lifecycle: organizationLifecycleCommand,
    update: organizationUpdateCommand,
    brandingSet: organizationBrandingSetCommand,
    domainClaim: organizationDomainClaimCommand,
    domainList: organizationDomainListCommand,
    domainVerify: organizationDomainVerifyCommand,
    loginPolicySet: organizationLoginPolicySetCommand,
    loginPolicyGet: organizationLoginPolicyGetCommand,
    realmLoginPolicyGet: organizationRealmLoginPolicyGetCommand,
    realmLoginPolicySet: organizationRealmLoginPolicySetCommand,
  },
  docs: { brief: "Organization administration" },
})

function organizationCliClientCreate(connection: { readonly server: string; readonly token?: string }) {
  return organizationApiClientCreate({ baseUrl: connection.server, token: connection.token })
}

async function organizationCliConnectionResolve(
  context: ApplicationContext,
  flags: OrganizationCliFlags & { readonly organizationId?: string; readonly realmId?: string },
  systemAuthentication = true,
) {
  const result = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!result.success) {
    organizationCliResultWrite(context, result, [flags.token, context.process.env?.AUTHWORKS_TOKEN])
    return undefined
  }
  if (!systemAuthentication) return result.data
  return { ...result.data, token: connectionProfileCliSystemTokenResolve(flags.token, context.process.env) }
}

async function organizationCliScopeResolve(
  context: ApplicationContext,
  flags: OrganizationCliFlags & { readonly organizationId?: string; readonly realmId?: string },
) {
  const connection = await organizationCliConnectionResolve(context, flags)
  if (connection === undefined) return undefined
  const ids = organizationScopeIdsResolve(context, connection)
  if (ids === undefined) return undefined
  return { connection, ids }
}

async function organizationCliRealmResolve(
  context: ApplicationContext,
  flags: OrganizationCliFlags & { readonly realmId?: string },
) {
  const connection = await organizationCliConnectionResolve(context, flags)
  if (connection === undefined) return undefined
  const realmId = scopeIdResolve(context, connection.realmId, "realm")
  if (realmId === undefined) return undefined
  return { connection, realmId }
}

function organizationCliResultWrite(
  context: ApplicationContext,
  result: {
    readonly data?: unknown
    readonly errorData?: string | null
    readonly errorMessage?: string
    readonly code?: string
    readonly op?: string
    readonly statusCode?: number
    readonly status?: "current" | "unchanged"
    readonly success: boolean
  },
  secrets: readonly (string | undefined)[] = [],
) {
  if (!result.success) {
    const details = organizationCliErrorDetailsParse(result.errorData)
    const output = JSON.stringify({
      error: {
        code: result.code ?? "platform.internal",
        ...(details === undefined ? {} : { details }),
        message: result.errorMessage ?? "The request failed.",
        op: result.op ?? "organizationCliResultWrite",
        ...(result.statusCode === undefined ? {} : { status: result.statusCode }),
      },
    })
    context.process.stderr.write(`${connectionProfileCliOutputRedact(output, secrets)}\n`)
    context.process.exitCode = 1
    return
  }
  if (result.status === "unchanged") {
    context.process.stderr.write("304 Not Modified\n")
    return
  }
  context.process.stdout.write(
    `${connectionProfileCliOutputRedact(JSON.stringify(result.data) ?? "undefined", secrets)}\n`,
  )
}

function organizationCommonFlags() {
  return {
    profile: connectionProfileCliProfileFlag(),
    server: {
      brief: "Authworks server URL",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "URL",
    },
    token: {
      brief: "Bearer token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
  }
}

function organizationListFlags() {
  return {
    pageSize: optionalNumberFlag("Page size"),
    pageToken: optionalTextFlag("Page token"),
    sortBy: optionalTextFlag("Sort field"),
    sortDirection: {
      brief: "Sort direction",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value as "asc" | "desc",
      placeholder: "DIRECTION",
    },
  }
}

function realmIdFlag() {
  return {
    brief: "Realm UUID",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "REALM_ID",
  }
}

function organizationFlag() {
  return {
    brief: "Organization UUID",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "ORGANIZATION_ID",
  }
}

function ifModifiedSinceFlag() {
  return {
    brief: "HTTP If-Modified-Since date",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "HTTP-DATE",
  }
}

function textFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function optionalTextFlag(brief: string) {
  return { ...textFlag(brief), optional: true as const }
}

function optionalNumberFlag(brief: string) {
  return {
    brief,
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => Number(value),
    placeholder: "TIMESTAMP",
  }
}

function optionalBooleanFlag(brief: string) {
  return {
    brief,
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value === "true",
    placeholder: "BOOLEAN",
  }
}

function organizationCliJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch (_error) {
    return null
  }
}

function organizationCliErrorDetailsParse(errorData: string | null | undefined): Record<string, unknown> | undefined {
  if (errorData === undefined || errorData === null) return undefined
  try {
    const parsed: unknown = JSON.parse(errorData)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined
    return parsed as Record<string, unknown>
  } catch (_error) {
    return undefined
  }
}

function organizationListQueryCreate(flags: OrganizationListCliFlags): ListQuery | undefined {
  if (
    flags.pageSize === undefined &&
    flags.pageToken === undefined &&
    flags.sortBy === undefined &&
    flags.sortDirection === undefined
  )
    return undefined
  return {
    pageSize: flags.pageSize,
    pageToken: flags.pageToken,
    sortBy: flags.sortBy,
    sortDirection: flags.sortDirection,
  }
}

function organizationScopeIdsResolve(
  context: ApplicationContext,
  flags: { readonly organizationId?: string; readonly realmId?: string },
): { readonly organizationId: string; readonly realmId: string } | undefined {
  const realmId = scopeIdResolve(context, flags.realmId, "realm")
  const organizationId = scopeIdResolve(context, flags.organizationId, "organization")
  if (realmId === undefined || organizationId === undefined) return undefined
  return { organizationId, realmId }
}
