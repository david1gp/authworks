import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import type { Result } from "#result"
import type { ConnectionProfile } from "../model/connectionProfile.js"
import { connectionProfilesStoreCreate } from "../persistence/connectionProfilesStoreCreate.js"

type ConnectionProfileSetFlags = {
  readonly organizationId?: string
  readonly realmId?: string
  readonly server?: string
  readonly token?: string
}

const connectionProfileSetCommand = buildCommand({
  async func(this: ApplicationContext, flags: ConnectionProfileSetFlags, name: string) {
    const result = await connectionProfilesStoreCreate({ environment: this.process.env }).connectionProfileSet(
      name,
      connectionProfileSetInputCreate(flags),
    )
    connectionProfilesCliResultWrite(
      this,
      result.success ? { ...result, data: connectionProfileRedact(result.data) } : result,
    )
  },
  parameters: {
    flags: connectionProfileSetFlags(),
    positional: { kind: "tuple", parameters: [connectionProfileNameParameter()] },
  },
  docs: { brief: "Create or update a connection profile" },
})

const connectionProfileListCommand = buildCommand({
  async func(this: ApplicationContext) {
    const result = await connectionProfilesStoreCreate({ environment: this.process.env }).connectionProfileList()
    if (!result.success) {
      connectionProfilesCliResultWrite(this, result)
      return
    }
    const profiles = Object.entries(result.data)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([name, profile]) => ({ name, ...connectionProfileRedact(profile) }))
    connectionProfilesCliResultWrite(this, { data: profiles, success: true })
  },
  parameters: { flags: {} },
  docs: { brief: "List connection profiles" },
})

const connectionProfileShowCommand = buildCommand({
  async func(this: ApplicationContext, _flags: Record<string, never>, name: string) {
    const result = await connectionProfilesStoreCreate({ environment: this.process.env }).connectionProfileGet(name)
    if (!result.success) {
      connectionProfilesCliResultWrite(this, result)
      return
    }
    if (result.data === undefined) {
      connectionProfilesCliMissingWrite(this, name)
      return
    }
    connectionProfilesCliResultWrite(this, { data: connectionProfileRedact(result.data), success: true })
  },
  parameters: {
    flags: {},
    positional: { kind: "tuple", parameters: [connectionProfileNameParameter()] },
  },
  docs: { brief: "Show a connection profile" },
})

const connectionProfileDeleteCommand = buildCommand({
  async func(this: ApplicationContext, _flags: Record<string, never>, name: string) {
    const result = await connectionProfilesStoreCreate({ environment: this.process.env }).connectionProfileDelete(name)
    if (!result.success) {
      connectionProfilesCliResultWrite(this, result)
      return
    }
    if (!result.data) {
      connectionProfilesCliMissingWrite(this, name)
      return
    }
    connectionProfilesCliResultWrite(this, result)
  },
  parameters: {
    flags: {},
    positional: { kind: "tuple", parameters: [connectionProfileNameParameter()] },
  },
  docs: { brief: "Delete a connection profile" },
})

export const connectionProfilesCliCommands = buildRouteMap({
  routes: {
    delete: connectionProfileDeleteCommand,
    list: connectionProfileListCommand,
    set: connectionProfileSetCommand,
    show: connectionProfileShowCommand,
  },
  docs: { brief: "Manage local connection profiles" },
})

function connectionProfileNameParameter() {
  return {
    brief: "Connection profile name",
    parse: (value: string) => value,
    placeholder: "NAME",
  }
}

function connectionProfileSetFlags() {
  return {
    organizationId: connectionProfileValueFlag("Organization UUID", "ORGANIZATION_ID"),
    realmId: connectionProfileValueFlag("Realm UUID", "REALM_ID"),
    server: connectionProfileValueFlag("Authworks server URL", "URL"),
    token: connectionProfileValueFlag("Bearer token", "TOKEN"),
  }
}

function connectionProfileValueFlag(brief: string, placeholder: string) {
  return {
    brief,
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder,
  }
}

function connectionProfileSetInputCreate(flags: ConnectionProfileSetFlags): ConnectionProfile {
  return {
    ...(flags.organizationId === undefined ? {} : { organizationId: flags.organizationId }),
    ...(flags.realmId === undefined ? {} : { realmId: flags.realmId }),
    ...(flags.server === undefined ? {} : { server: flags.server }),
    ...(flags.token === undefined ? {} : { token: flags.token }),
  }
}

function connectionProfileRedact(profile: ConnectionProfile): ConnectionProfile {
  return profile.token === undefined ? profile : { ...profile, token: "[REDACTED]" }
}

function connectionProfilesCliMissingWrite(context: ApplicationContext, name: string) {
  context.process.stderr.write(`Connection profile "${name}" was not found.\n`)
  context.process.exitCode = 1
}

function connectionProfilesCliResultWrite(context: ApplicationContext, result: Result<unknown>) {
  if (!result.success) {
    context.process.stderr.write(`${result.errorMessage ?? "The request failed."}\n`)
    context.process.exitCode = 1
    return
  }
  context.process.stdout.write(`${JSON.stringify(result.data)}\n`)
}
