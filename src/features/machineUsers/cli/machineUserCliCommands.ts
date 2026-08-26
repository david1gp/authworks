import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
import { machineUserApiClientCreate } from "../client/machineUserApiClientCreate.js"

type MachineListFlags = {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}
type MachineCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly systemToken?: string
  readonly token?: string
}
type MachineRealmFlags = MachineCliFlags & { readonly realmId?: string }
type MachineUserFlags = MachineRealmFlags & { readonly machineUserId: string }

const machineUserCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: MachineRealmFlags & { displayName: string; scopes?: string; userName: string },
  ) {
    const connection = await machineCliConnectionResolve(this, flags)
    if (!connection.success) return machineCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(connection.data).machineUserCreate(realmId, {
        displayName: flags.displayName,
        scopes: machineScopesSplit(flags.scopes),
        userName: flags.userName,
      }),
      [connection.data.token, connection.data.systemToken],
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
    const connection = await machineCliConnectionResolve(this, flags)
    if (!connection.success) return machineCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(connection.data).machineUserList(realmId, machineListQueryCreate(flags)),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: { flags: { ...machineCommonFlags(), ...machineListFlags(), realmId: machineRealmIdFlag() } },
  docs: { brief: "List machine users" },
})

const machineUserGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: MachineUserFlags) {
    const connection = await machineCliConnectionResolve(this, flags)
    if (!connection.success) return machineCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(connection.data).machineUserGet(realmId, flags.machineUserId),
      [connection.data.token, connection.data.systemToken],
    )
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
    const connection = await machineCliConnectionResolve(this, flags)
    if (!connection.success) return machineCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(connection.data).machineUserClientSecretRotate(realmId, flags.machineUserId),
      [connection.data.token, connection.data.systemToken],
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
    const connection = await machineCliConnectionResolve(this, flags)
    if (!connection.success) return machineCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(connection.data).machineUserLifecycleSet(realmId, flags.machineUserId, {
        status: flags.status,
      }),
      [connection.data.token, connection.data.systemToken],
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
    const connection = await machineCliConnectionResolve(this, flags)
    if (!connection.success) return machineCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(connection.data).machinePersonalAccessTokenCreate(realmId, flags.machineUserId, {
        expiresAt: flags.expiresAt,
        machineUserId: flags.machineUserId,
        name: flags.name,
        scopes: machineScopesSplit(flags.scopes),
      }),
      [connection.data.token, connection.data.systemToken],
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
    const connection = await machineCliConnectionResolve(this, flags)
    if (!connection.success) return machineCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(connection.data).machineApiKeyCreate(realmId, flags.machineUserId, {
        expiresAt: flags.expiresAt,
        machineUserId: flags.machineUserId,
        name: flags.name,
        scopes: machineScopesSplit(flags.scopes),
      }),
      [connection.data.token, connection.data.systemToken],
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
    const connection = await machineCliConnectionResolve(this, flags)
    if (!connection.success) return machineCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(connection.data).machineCredentialList(
        realmId,
        flags.machineUserId,
        machineListQueryCreate(flags),
      ),
      [connection.data.token, connection.data.systemToken],
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
    const connection = await machineCliConnectionResolve(this, flags)
    if (!connection.success) return machineCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    machineCliResultWrite(
      this,
      await machineCliClientCreate(connection.data).machineCredentialRevoke(realmId, flags.credentialId, {
        reason: flags.reason,
      }),
      [connection.data.token, connection.data.systemToken],
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

async function machineCliConnectionResolve(
  context: ApplicationContext,
  flags: MachineCliFlags & { readonly realmId?: string },
) {
  const connection = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!connection.success) return connection
  return {
    data: {
      ...connection.data,
      systemToken: connectionProfileCliSystemTokenResolve(flags.systemToken ?? flags.token, context.process.env),
    },
    success: true as const,
  }
}

function machineCliClientCreate(flags: {
  readonly server: string
  readonly systemToken?: string
  readonly token?: string
}) {
  return machineUserApiClientCreate({
    baseUrl: flags.server,
    systemToken: flags.systemToken,
    token: flags.token,
  })
}

function machineCliResultWrite(
  context: ApplicationContext,
  result: { data?: unknown; errorMessage?: string; success: boolean },
  secrets: readonly (string | undefined)[] = [],
) {
  if (!result.success) {
    context.process.stderr.write(
      `${connectionProfileCliOutputRedact(result.errorMessage ?? "The request failed.", secrets)}\n`,
    )
    context.process.exitCode = 1
    return
  }
  context.process.stdout.write(`${connectionProfileCliOutputRedact(JSON.stringify(result.data), secrets)}\n`)
}

function machineCommonFlags() {
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
    systemToken: {
      brief: "System bearer token",
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
