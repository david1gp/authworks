import { readFile } from "node:fs/promises"
import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import * as v from "valibot"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { passkeyApiClientCreate } from "../client/passkeyApiClientCreate.js"
import { passkeyAuthenticationCompleteRequestSchema } from "../public/passkeyAuthenticationCompleteRequestSchema.js"
import { passkeyRegistrationCompleteRequestSchema } from "../public/passkeyRegistrationCompleteRequestSchema.js"

type PasskeyListFlags = {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}
type PasskeyCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly token?: string
  readonly realmId?: string
}

const passkeyListCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & PasskeyListFlags) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(
      this,
      await passkeyClientCreate(connection.data).passkeyCredentialList(realmId, passkeyListQueryCreate(flags)),
      [connection.data.token],
    )
  },
  parameters: { flags: { ...passkeyCommonFlags(), ...passkeyListFlags(), realmId: passkeyRealmIdFlag() } },
  docs: { brief: "List passkey credentials" },
})

const passkeyRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { credentialId: string }) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(
      this,
      await passkeyClientCreate(connection.data).passkeyCredentialRevoke(realmId, {
        credentialId: flags.credentialId,
      }),
      [connection.data.token],
    )
  },
  parameters: {
    flags: {
      ...passkeyCommonFlags(),
      realmId: passkeyRealmIdFlag(),
      credentialId: passkeyTextFlag("Credential ID"),
    },
  },
  docs: { brief: "Revoke a passkey credential" },
})

const passkeyRenameCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { credentialId: string; nickname: string }) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(
      this,
      await passkeyClientCreate(connection.data).passkeyCredentialRename(realmId, flags.credentialId, {
        nickname: flags.nickname,
      }),
      [connection.data.token],
    )
  },
  parameters: {
    flags: {
      ...passkeyCommonFlags(),
      realmId: passkeyRealmIdFlag(),
      credentialId: passkeyTextFlag("Credential ID"),
      nickname: passkeyTextFlag("Credential nickname"),
    },
  },
  docs: { brief: "Rename a passkey credential" },
})

const passkeyAdminRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { credentialId: string; userId: string }) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(
      this,
      await passkeyClientCreate(connection.data).passkeyCredentialAdministratorRevoke(
        realmId,
        flags.userId,
        flags.credentialId,
      ),
      [connection.data.token],
    )
  },
  parameters: {
    flags: {
      ...passkeyCommonFlags(),
      realmId: passkeyRealmIdFlag(),
      userId: passkeyTextFlag("User ID"),
      credentialId: passkeyTextFlag("Credential ID"),
    },
  },
  docs: { brief: "Revoke a user's passkey credential as administrator" },
})

const passkeyRegistrationStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(this, await passkeyClientCreate(connection.data).passkeyRegistrationStart(realmId), [
      connection.data.token,
    ])
  },
  parameters: { flags: { ...passkeyCommonFlags(), realmId: passkeyRealmIdFlag() } },
  docs: { brief: "Start a passkey registration ceremony and print the creation options" },
})

const passkeyRegistrationCompleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { responseFile: string }) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    const input = await passkeyResponseFileRead(this, passkeyRegistrationCompleteRequestSchema, flags.responseFile, [
      connection.data.token,
    ])
    if (input === undefined) return
    passkeyResultWrite(this, await passkeyClientCreate(connection.data).passkeyRegistrationComplete(realmId, input), [
      connection.data.token,
    ])
  },
  parameters: {
    flags: { ...passkeyCommonFlags(), realmId: passkeyRealmIdFlag(), responseFile: passkeyResponseFileFlag() },
  },
  docs: { brief: "Complete a passkey registration ceremony from a response JSON file" },
})

const passkeyAuthenticationStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { organizationId?: string }) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(
      this,
      await passkeyClientCreate(connection.data).passkeyAuthenticationStart(realmId, {
        ...(flags.organizationId === undefined ? {} : { organizationId: flags.organizationId }),
      }),
      [connection.data.token],
    )
  },
  parameters: {
    flags: { ...passkeyCommonFlags(), realmId: passkeyRealmIdFlag(), organizationId: optionalOrganizationIdFlag() },
  },
  docs: { brief: "Start a passkey authentication ceremony and print the request options" },
})

const passkeyAuthenticationCompleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { responseFile: string }) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    const input = await passkeyResponseFileRead(this, passkeyAuthenticationCompleteRequestSchema, flags.responseFile, [
      connection.data.token,
    ])
    if (input === undefined) return
    passkeyResultWrite(this, await passkeyClientCreate(connection.data).passkeyAuthenticationComplete(realmId, input), [
      connection.data.token,
    ])
  },
  parameters: {
    flags: { ...passkeyCommonFlags(), realmId: passkeyRealmIdFlag(), responseFile: passkeyResponseFileFlag() },
  },
  docs: { brief: "Complete a passkey authentication ceremony from a response JSON file" },
})

const passkeyMfaLoginStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { challengeToken: string }) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(
      this,
      await passkeyClientCreate(connection.data).passkeyMfaLoginStart(realmId, flags.challengeToken),
      [connection.data.token, flags.challengeToken],
    )
  },
  parameters: {
    flags: { ...passkeyCommonFlags(), realmId: passkeyRealmIdFlag(), challengeToken: passkeyTextFlag("MFA token") },
  },
  docs: { brief: "Start an MFA passkey login ceremony for an MFA challenge token" },
})

const passkeyMfaLoginCompleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { responseFile: string }) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    const input = await passkeyResponseFileRead(this, passkeyAuthenticationCompleteRequestSchema, flags.responseFile, [
      connection.data.token,
    ])
    if (input === undefined) return
    passkeyResultWrite(this, await passkeyClientCreate(connection.data).passkeyMfaLoginComplete(realmId, input), [
      connection.data.token,
    ])
  },
  parameters: {
    flags: { ...passkeyCommonFlags(), realmId: passkeyRealmIdFlag(), responseFile: passkeyResponseFileFlag() },
  },
  docs: { brief: "Complete an MFA passkey login ceremony from a response JSON file" },
})

const passkeyMfaStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(this, await passkeyClientCreate(connection.data).passkeyMfaStart(realmId), [
      connection.data.token,
    ])
  },
  parameters: { flags: { ...passkeyCommonFlags(), realmId: passkeyRealmIdFlag() } },
  docs: { brief: "Start an authenticated MFA passkey ceremony and print the request options" },
})

const passkeyMfaCompleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { responseFile: string }) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    const input = await passkeyResponseFileRead(this, passkeyAuthenticationCompleteRequestSchema, flags.responseFile, [
      connection.data.token,
    ])
    if (input === undefined) return
    passkeyResultWrite(this, await passkeyClientCreate(connection.data).passkeyMfaComplete(realmId, input), [
      connection.data.token,
    ])
  },
  parameters: {
    flags: { ...passkeyCommonFlags(), realmId: passkeyRealmIdFlag(), responseFile: passkeyResponseFileFlag() },
  },
  docs: { brief: "Complete an authenticated MFA passkey ceremony from a response JSON file" },
})

const passkeyStepUpStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(this, await passkeyClientCreate(connection.data).passkeyStepUpStart(realmId), [
      connection.data.token,
    ])
  },
  parameters: { flags: { ...passkeyCommonFlags(), realmId: passkeyRealmIdFlag() } },
  docs: { brief: "Start a passkey step-up ceremony and print the request options" },
})

const passkeyStepUpCompleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { responseFile: string }) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    const input = await passkeyResponseFileRead(this, passkeyAuthenticationCompleteRequestSchema, flags.responseFile, [
      connection.data.token,
    ])
    if (input === undefined) return
    passkeyResultWrite(this, await passkeyClientCreate(connection.data).passkeyStepUpComplete(realmId, input), [
      connection.data.token,
    ])
  },
  parameters: {
    flags: { ...passkeyCommonFlags(), realmId: passkeyRealmIdFlag(), responseFile: passkeyResponseFileFlag() },
  },
  docs: { brief: "Complete a passkey step-up ceremony from a response JSON file" },
})

export const passkeyCliCommands = buildRouteMap({
  routes: {
    adminRevoke: passkeyAdminRevokeCommand,
    authenticationComplete: passkeyAuthenticationCompleteCommand,
    authenticationStart: passkeyAuthenticationStartCommand,
    list: passkeyListCommand,
    mfaComplete: passkeyMfaCompleteCommand,
    mfaLoginComplete: passkeyMfaLoginCompleteCommand,
    mfaLoginStart: passkeyMfaLoginStartCommand,
    mfaStart: passkeyMfaStartCommand,
    registrationComplete: passkeyRegistrationCompleteCommand,
    registrationStart: passkeyRegistrationStartCommand,
    rename: passkeyRenameCommand,
    revoke: passkeyRevokeCommand,
    stepUpComplete: passkeyStepUpCompleteCommand,
    stepUpStart: passkeyStepUpStartCommand,
  },
  docs: { brief: "Manage passkey credentials" },
})

async function passkeyCliConnectionResolve(context: ApplicationContext, flags: PasskeyCliFlags) {
  return connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
}

function passkeyClientCreate(flags: { readonly server: string; readonly token?: string }) {
  return passkeyApiClientCreate({
    baseUrl: flags.server,
    token: flags.token,
  })
}

function passkeyResultWrite(
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
  context.process.stdout.write(
    `${connectionProfileCliOutputRedact(JSON.stringify(result.data) ?? "undefined", secrets)}\n`,
  )
}

function passkeyCommonFlags() {
  return {
    ...connectionProfileCliCentralFlags(),
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

function passkeyListFlags() {
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

function passkeyListQueryCreate(flags: PasskeyCliFlags & PasskeyListFlags) {
  return {
    ...(flags.pageSize === undefined ? {} : { pageSize: flags.pageSize }),
    ...(flags.pageToken === undefined ? {} : { pageToken: flags.pageToken }),
    ...(flags.sortBy === undefined ? {} : { sortBy: flags.sortBy }),
    ...(flags.sortDirection === undefined ? {} : { sortDirection: flags.sortDirection }),
  }
}

function passkeyRealmIdFlag() {
  return {
    brief: "Realm UUID",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "REALM_ID",
  }
}

function passkeyTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function passkeyResponseFileFlag() {
  return {
    brief: "Ceremony response JSON file",
    kind: "parsed" as const,
    parse: (value: string) => value,
    placeholder: "PATH",
  }
}

function optionalOrganizationIdFlag() {
  return {
    brief: "Organization UUID",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "ORGANIZATION_ID",
  }
}

async function passkeyResponseFileRead<T>(
  context: ApplicationContext,
  schema: v.GenericSchema<T>,
  path: string,
  secrets: readonly (string | undefined)[],
): Promise<T | undefined> {
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(path, "utf8")) as unknown
  } catch (_error) {
    context.process.stderr.write("The passkey ceremony response file could not be read.\n")
    context.process.exitCode = 1
    return undefined
  }
  const parsed = v.safeParse(schema, raw)
  if (!parsed.success) {
    context.process.stderr.write(
      `${connectionProfileCliOutputRedact("The passkey ceremony response file is invalid.", secrets)}\n`,
    )
    context.process.exitCode = 1
    return undefined
  }
  return parsed.output
}
