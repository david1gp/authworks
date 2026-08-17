import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { organizationApiClientCreate } from "../client/organizationApiClientCreate.js"

type OrganizationCliFlags = {
  readonly server?: string
  readonly token?: string
}

type OrganizationIdCliFlags = OrganizationCliFlags & {
  readonly instanceId: string
  readonly organizationId: string
}

const organizationCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: OrganizationCliFlags & { instanceId: string; name: string; ownerUserId?: string },
  ) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationCreate(flags.instanceId, {
        name: flags.name,
        ownerUserId: flags.ownerUserId,
      }),
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      instanceId: organizationIdFlag(),
      name: textFlag("Organization display name"),
      ownerUserId: optionalTextFlag("Initial owner user ID"),
    },
  },
  docs: { brief: "Create an organization" },
})

const organizationListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationCliFlags & { instanceId: string }) {
    organizationCliResultWrite(this, await organizationCliClientCreate(this, flags).organizationList(flags.instanceId))
  },
  parameters: { flags: { ...organizationCommonFlags(), instanceId: organizationIdFlag() } },
  docs: { brief: "List organizations" },
})

const organizationGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationGet(flags.instanceId, flags.organizationId),
    )
  },
  parameters: {
    flags: { ...organizationCommonFlags(), instanceId: organizationIdFlag(), organizationId: organizationFlag() },
  },
  docs: { brief: "Get an organization" },
})

const organizationUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { name: string }) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationUpdate(flags.instanceId, flags.organizationId, {
        name: flags.name,
      }),
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      instanceId: organizationIdFlag(),
      organizationId: organizationFlag(),
      name: textFlag("Organization display name"),
    },
  },
  docs: { brief: "Rename an organization" },
})

const organizationLifecycleCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { status: "active" | "inactive" | "removed" }) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationLifecycleSet(flags.instanceId, flags.organizationId, {
        status: flags.status,
      }),
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      instanceId: organizationIdFlag(),
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
  async func(this: ApplicationContext, flags: OrganizationCliFlags) {
    organizationCliResultWrite(this, await organizationCliClientCreate(this, flags).organizationRoleList())
  },
  parameters: { flags: organizationCommonFlags() },
  docs: { brief: "List organization roles" },
})

const organizationMemberAddCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { userId: string; roles: string }) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationMembershipCreate(
        flags.instanceId,
        flags.organizationId,
        { userId: flags.userId, roles: flags.roles.split(",") as ("owner" | "admin" | "member" | "guest")[] },
      ),
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      instanceId: organizationIdFlag(),
      organizationId: organizationFlag(),
      userId: textFlag("User ID"),
      roles: textFlag("Comma-separated roles"),
    },
  },
  docs: { brief: "Add an organization member" },
})

const organizationMemberListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationMembershipList(flags.instanceId, flags.organizationId),
    )
  },
  parameters: {
    flags: { ...organizationCommonFlags(), instanceId: organizationIdFlag(), organizationId: organizationFlag() },
  },
  docs: { brief: "List organization members" },
})

const organizationMemberUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { membershipId: string; roles: string }) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationMembershipUpdate(
        flags.instanceId,
        flags.organizationId,
        flags.membershipId,
        { roles: flags.roles.split(",") as ("owner" | "admin" | "member" | "guest")[] },
      ),
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      instanceId: organizationIdFlag(),
      organizationId: organizationFlag(),
      membershipId: textFlag("Membership ID"),
      roles: textFlag("Comma-separated roles"),
    },
  },
  docs: { brief: "Update an organization member" },
})

const organizationMemberRemoveCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { membershipId: string }) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationMembershipRemove(
        flags.instanceId,
        flags.organizationId,
        flags.membershipId,
      ),
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      instanceId: organizationIdFlag(),
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
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationInvitationCreate(
        flags.instanceId,
        flags.organizationId,
        {
          email: flags.email,
          roles: flags.roles.split(",") as ("owner" | "admin" | "member" | "guest")[],
          expiresAt: flags.expiresAt,
        },
      ),
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      instanceId: organizationIdFlag(),
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
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationInvitationDecline({
        token: flags.token,
        userId: flags.userId,
      }),
    )
  },
  parameters: {
    flags: { ...organizationCommonFlags(), token: textFlag("Invitation token"), userId: textFlag("Declining user ID") },
  },
  docs: { brief: "Decline an organization invitation" },
})

const organizationInvitationListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationInvitationList(flags.instanceId, flags.organizationId),
    )
  },
  parameters: {
    flags: { ...organizationCommonFlags(), instanceId: organizationIdFlag(), organizationId: organizationFlag() },
  },
  docs: { brief: "List organization invitations" },
})

const organizationInvitationRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationIdCliFlags & { invitationId: string }) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationInvitationRevoke(
        flags.instanceId,
        flags.organizationId,
        flags.invitationId,
      ),
    )
  },
  parameters: {
    flags: {
      ...organizationCommonFlags(),
      instanceId: organizationIdFlag(),
      organizationId: organizationFlag(),
      invitationId: textFlag("Invitation ID"),
    },
  },
  docs: { brief: "Revoke an organization invitation" },
})

const organizationInvitationAcceptCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationCliFlags & { token: string; userId: string }) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationInvitationAccept({
        token: flags.token,
        userId: flags.userId,
      }),
    )
  },
  parameters: {
    flags: { ...organizationCommonFlags(), token: textFlag("Invitation token"), userId: textFlag("Accepting user ID") },
  },
  docs: { brief: "Accept an organization invitation" },
})

const organizationSwitchCommand = buildCommand({
  async func(this: ApplicationContext, flags: OrganizationCliFlags & { instanceId: string; organizationId: string }) {
    organizationCliResultWrite(
      this,
      await organizationCliClientCreate(this, flags).organizationSwitch(flags.instanceId, {
        organizationId: flags.organizationId,
      }),
    )
  },
  parameters: {
    flags: { ...organizationCommonFlags(), instanceId: organizationIdFlag(), organizationId: organizationFlag() },
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
  },
  docs: { brief: "Organization administration" },
})

function organizationCliClientCreate(context: ApplicationContext, flags: OrganizationCliFlags) {
  return organizationApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
  })
}

function organizationCliResultWrite(
  context: ApplicationContext,
  result: { data?: unknown; errorMessage?: string; success: boolean },
) {
  if (!result.success) {
    context.process.stderr.write(`${result.errorMessage ?? "The request failed."}\n`)
    context.process.exitCode = 1
    return
  }
  context.process.stdout.write(`${JSON.stringify(result.data)}\n`)
}

function organizationCommonFlags() {
  return {
    server: {
      brief: "ZITADEL v2 server URL",
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

function organizationIdFlag() {
  return {
    brief: "Instance UUID",
    kind: "parsed" as const,
    parse: (value: string) => value,
    placeholder: "INSTANCE_ID",
  }
}

function organizationFlag() {
  return {
    brief: "Organization UUID",
    kind: "parsed" as const,
    parse: (value: string) => value,
    placeholder: "ORGANIZATION_ID",
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
