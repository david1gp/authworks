import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { machineUserApiClientCreate } from "../client/machineUserApiClientCreate.js"

type MachineListFlags = {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}
type MachineCliFlags = { readonly server?: string; readonly token?: string }
type MachineRealmFlags = MachineCliFlags & { readonly realmId?: string }
type MachineUserFlags = MachineRealmFlags & { readonly machineUserId: string }

const machineUserCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: MachineRealmFlags & { displayName: string; scopes?: string; userName: string },
  ) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineUserCreate(realmId, {
        displayName: flags.displayName,
        scopes: machineScopesSplit(flags.scopes),
        userName: flags.userName,
      }),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      realmId: machineRealmIdFlag(),
      userName: machineTextFlag("Machine username"),
      displayName: machineTextFlag("Machine display name"),
      scopes: { ...machineTextFlag("Comma-separated scopes"), optional: true as const },
    },
  },
  docs: { brief: "Create a machine user and one-time client secret" },
})

const machineUserListCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineRealmFlags & MachineListFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineUserList(realmId, machineListQueryCreate(flags)),
    )
  },
  parameters: { flags: { ...machineCommonFlags(), ...machineListFlags(), realmId: machineRealmIdFlag() } },
  docs: { brief: "List machine users" },
})

const machineUserGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineUserFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(this, await machineCliClientCreate(this, flags).machineUserGet(realmId, flags.machineUserId))
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      realmId: machineRealmIdFlag(),
      machineUserId: machineIdFlag("Machine user UUID"),
    },
  },
  docs: { brief: "Get a machine user" },
})

const machineUserSecretRotateCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineUserFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineUserClientSecretRotate(realmId, flags.machineUserId),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      realmId: machineRealmIdFlag(),
      machineUserId: machineIdFlag("Machine user UUID"),
    },
  },
  docs: { brief: "Rotate a machine user client secret" },
})

const machineUserLifecycleCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineUserFlags & { status: "active" | "inactive" | "removed" }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineUserLifecycleSet(realmId, flags.machineUserId, {
        status: flags.status,
      }),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      realmId: machineRealmIdFlag(),
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machinePersonalAccessTokenCreate(realmId, flags.machineUserId, {
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
      realmId: machineRealmIdFlag(),
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineApiKeyCreate(realmId, flags.machineUserId, {
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
      realmId: machineRealmIdFlag(),
      machineUserId: machineIdFlag("Machine user UUID"),
      name: machineTextFlag("API key name"),
      scopes: machineTextFlag("Comma-separated scopes"),
      expiresAt: { ...machineNumberFlag("Expiration timestamp in milliseconds"), optional: true as const },
    },
  },
  docs: { brief: "Create an API key" },
})

const machineCredentialListCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineUserFlags & MachineListFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineCredentialList(
        realmId,
        flags.machineUserId,
        machineListQueryCreate(flags),
      ),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      ...machineListFlags(),
      realmId: machineRealmIdFlag(),
      machineUserId: machineIdFlag("Machine user UUID"),
    },
  },
  docs: { brief: "List machine credentials" },
})

const machineCredentialRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineRealmFlags & { credentialId: string; reason?: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(this, flags).machineCredentialRevoke(realmId, flags.credentialId, {
        reason: flags.reason,
      }),
    )
  },
  parameters: {
    flags: {
      ...machineCommonFlags(),
      realmId: machineRealmIdFlag(),
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

function machineListFlags() {
  return {
    pageSize: {
      brief: "Page size",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => Number(value),
      placeholder: "NUMBER",
    },
    pageToken: {
      brief: "Page token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
    sortBy: {
      brief: "Sort field",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "FIELD",
    },
    sortDirection: {
      brief: "Sort direction",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value as "asc" | "desc",
      placeholder: "DIRECTION",
    },
  }
}

function machineListQueryCreate(flags: MachineListFlags) {
  return {
    ...(flags.pageSize === undefined ? {} : { pageSize: flags.pageSize }),
    ...(flags.pageToken === undefined ? {} : { pageToken: flags.pageToken }),
    ...(flags.sortBy === undefined ? {} : { sortBy: flags.sortBy }),
    ...(flags.sortDirection === undefined ? {} : { sortDirection: flags.sortDirection }),
  }
}

function machineIdFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "UUID" }
}

function machineRealmIdFlag() {
  return { ...machineIdFlag("Realm UUID"), optional: true as const }
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
