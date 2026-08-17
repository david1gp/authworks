import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { machineUserApiClientCreate } from "../client/machineUserApiClientCreate.js"

type MachineCliFlags = { readonly server?: string; readonly token?: string }
type MachineInstanceFlags = MachineCliFlags & { readonly instanceId: string }
type MachineUserFlags = MachineInstanceFlags & { readonly machineUserId: string }

const machineUserCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: MachineInstanceFlags & { displayName: string; scopes?: string; userName: string },
  ) {
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineUserCreate(flags.instanceId, {
        displayName: flags.displayName,
        scopes: machineScopesSplit(flags.scopes),
        userName: flags.userName,
      }),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      instanceId: machineIdFlag("Instance UUID"),
      userName: machineTextFlag("Machine username"),
      displayName: machineTextFlag("Machine display name"),
      scopes: { ...machineTextFlag("Comma-separated scopes"), optional: true as const },
    },
  },
  docs: { brief: "Create a machine user and one-time client secret" },
})

const machineUserListCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineInstanceFlags) {
    machineCliResultWrite(this, await machineCliClientCreate(this, flags).machineUserList(flags.instanceId))
  },
  parameters: { flags: { ...machineCommonFlags(), instanceId: machineIdFlag("Instance UUID") } },
  docs: { brief: "List machine users" },
})

const machineUserGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineUserFlags) {
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineUserGet(flags.instanceId, flags.machineUserId),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      instanceId: machineIdFlag("Instance UUID"),
      machineUserId: machineIdFlag("Machine user UUID"),
    },
  },
  docs: { brief: "Get a machine user" },
})

const machineUserSecretRotateCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineUserFlags) {
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineUserClientSecretRotate(flags.instanceId, flags.machineUserId),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      instanceId: machineIdFlag("Instance UUID"),
      machineUserId: machineIdFlag("Machine user UUID"),
    },
  },
  docs: { brief: "Rotate a machine user client secret" },
})

const machineUserLifecycleCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineUserFlags & { status: "active" | "inactive" | "removed" }) {
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineUserLifecycleSet(flags.instanceId, flags.machineUserId, {
        status: flags.status,
      }),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      instanceId: machineIdFlag("Instance UUID"),
      machineUserId: machineIdFlag("Machine user UUID"),
      status: {
        brief: "Machine user status",
        kind: "parsed" as const,
        parse: (value: string) => value as "active" | "inactive" | "removed",
        placeholder: "STATUS",
      },
    },
  },
  docs: { brief: "Change a machine user lifecycle status" },
})

const machinePersonalAccessTokenCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineUserFlags & { expiresAt?: number; name: string; scopes: string }) {
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machinePersonalAccessTokenCreate(
        flags.instanceId,
        flags.machineUserId,
        {
          expiresAt: flags.expiresAt,
          machineUserId: flags.machineUserId,
          name: flags.name,
          scopes: machineScopesSplit(flags.scopes),
        },
      ),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      instanceId: machineIdFlag("Instance UUID"),
      machineUserId: machineIdFlag("Machine user UUID"),
      name: machineTextFlag("Token name"),
      scopes: machineTextFlag("Comma-separated scopes"),
      expiresAt: { ...machineNumberFlag("Expiration timestamp in milliseconds"), optional: true as const },
    },
  },
  docs: { brief: "Create a personal access token" },
})

const machineApiKeyCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineUserFlags & { expiresAt?: number; name: string; scopes: string }) {
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineApiKeyCreate(flags.instanceId, flags.machineUserId, {
        expiresAt: flags.expiresAt,
        machineUserId: flags.machineUserId,
        name: flags.name,
        scopes: machineScopesSplit(flags.scopes),
      }),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      instanceId: machineIdFlag("Instance UUID"),
      machineUserId: machineIdFlag("Machine user UUID"),
      name: machineTextFlag("API key name"),
      scopes: machineTextFlag("Comma-separated scopes"),
      expiresAt: { ...machineNumberFlag("Expiration timestamp in milliseconds"), optional: true as const },
    },
  },
  docs: { brief: "Create an API key" },
})

const machineCredentialListCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineUserFlags) {
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineCredentialList(flags.instanceId, flags.machineUserId),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      instanceId: machineIdFlag("Instance UUID"),
      machineUserId: machineIdFlag("Machine user UUID"),
    },
  },
  docs: { brief: "List machine credentials" },
})

const machineCredentialRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineInstanceFlags & { credentialId: string; reason?: string }) {
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineCredentialRevoke(flags.instanceId, flags.credentialId, {
        reason: flags.reason,
      }),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      instanceId: machineIdFlag("Instance UUID"),
      credentialId: machineIdFlag("Credential UUID"),
      reason: { ...machineTextFlag("Revocation reason"), optional: true as const },
    },
  },
  docs: { brief: "Revoke a machine credential" },
})

export const machineUserCliCommands = buildRouteMap({
  routes: {
    apiKeyCreate: machineApiKeyCommand,
    credentialList: machineCredentialListCommand,
    credentialRevoke: machineCredentialRevokeCommand,
    create: machineUserCreateCommand,
    get: machineUserGetCommand,
    list: machineUserListCommand,
    lifecycle: machineUserLifecycleCommand,
    personalAccessTokenCreate: machinePersonalAccessTokenCommand,
    secretRotate: machineUserSecretRotateCommand,
  },
  docs: { brief: "Machine users and credentials" },
})

function machineCliClientCreate(context: ApplicationContext, flags: MachineCliFlags) {
  return machineUserApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
  })
}

function machineCliResultWrite(
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

function machineCommonFlags() {
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

function machineIdFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "UUID" }
}

function machineTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function machineNumberFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => Number(value), placeholder: "NUMBER" }
}

function machineScopesSplit(value: string | undefined): string[] {
  if (value === undefined) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}
