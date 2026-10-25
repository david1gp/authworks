import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { accountApiClientCreate } from "../client/accountApiClientCreate.js"

type AccountCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly token?: string
  readonly realmId?: string
}

type AccountListCliFlags = AccountCliFlags & {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}

const accountEffectiveAccessCommand = buildCommand({
  async func(this: ApplicationContext, flags: AccountListCliFlags) {
    const resolved = await accountCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    accountCliResultWrite(
      this,
      await accountCliClientCreate(resolved.connection).effectiveAccessList(
        resolved.realmId,
        accountListQueryCreate(flags),
      ),
      [resolved.connection.token],
    )
  },
  parameters: { flags: { ...accountCommonFlags(), ...accountListFlags() } },
  docs: { brief: "List the current account's effective access" },
})

const accountSecurityHistoryCommand = buildCommand({
  async func(this: ApplicationContext, flags: AccountListCliFlags) {
    const resolved = await accountCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    accountCliResultWrite(
      this,
      await accountCliClientCreate(resolved.connection).securityHistoryList(
        resolved.realmId,
        accountListQueryCreate(flags),
      ),
      [resolved.connection.token],
    )
  },
  parameters: { flags: { ...accountCommonFlags(), ...accountListFlags() } },
  docs: { brief: "List the current account's security history" },
})

export const accountCliCommands = buildRouteMap({
  routes: {
    effectiveAccess: accountEffectiveAccessCommand,
    effective_access: accountEffectiveAccessCommand,
    securityHistory: accountSecurityHistoryCommand,
    security_history: accountSecurityHistoryCommand,
  },
  docs: { brief: "Current account access and security history" },
})

async function accountCliConnectionResolve(context: ApplicationContext, flags: AccountCliFlags) {
  const result = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!result.success) {
    accountCliResultWrite(context, result, [flags.token, context.process.env?.AUTHWORKS_TOKEN])
    return undefined
  }
  const realmId = scopeIdResolve(context, result.data.realmId, "realm")
  if (realmId === undefined) return undefined
  return { connection: result.data, realmId }
}

function accountCliClientCreate(connection: { readonly server: string; readonly token?: string }) {
  return accountApiClientCreate({ baseUrl: connection.server, token: connection.token })
}

function accountCliResultWrite(
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

function accountCommonFlags() {
  return {
    ...connectionProfileCliCentralFlags(),
    realmId: {
      brief: "Realm UUID",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "REALM_ID",
    },
    server: {
      brief: "Authworks server URL",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "URL",
    },
    token: {
      brief: "Session Bearer [REDACTED]",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
  }
}

function accountListFlags() {
  return {
    pageSize: {
      brief: "Maximum items per page",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => Number(value),
      placeholder: "NUMBER",
    },
    pageToken: {
      brief: "Opaque page token",
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

function accountListQueryCreate(flags: AccountListCliFlags): ListQuery | undefined {
  if (
    flags.pageSize === undefined &&
    flags.pageToken === undefined &&
    flags.sortBy === undefined &&
    flags.sortDirection === undefined
  )
    return undefined
  return {
    ...(flags.pageSize === undefined ? {} : { pageSize: flags.pageSize }),
    ...(flags.pageToken === undefined ? {} : { pageToken: flags.pageToken }),
    ...(flags.sortBy === undefined ? {} : { sortBy: flags.sortBy }),
    ...(flags.sortDirection === undefined ? {} : { sortDirection: flags.sortDirection }),
  }
}
