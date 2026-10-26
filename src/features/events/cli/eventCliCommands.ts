import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { EventListQuery } from "../public/eventListQuerySchema.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
import { eventApiClientCreate } from "../client/eventApiClientCreate.js"

type EventCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly systemToken?: string
  readonly token?: string
  readonly realmId?: string
}

type EventListCliFlags = EventCliFlags & {
  readonly actorId?: string
  readonly aggregateId?: string
  readonly aggregateType?: string
  readonly eventType?: string
  readonly occurredFrom?: number
  readonly occurredTo?: number
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
  readonly userSubjectId?: string
}

const eventListCommand = buildCommand({
  async func(this: ApplicationContext, flags: EventListCliFlags) {
    const resolved = await eventCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    eventCliResultWrite(
      this,
      await eventApiClientCreate({
        baseUrl: resolved.connection.server,
        token: resolved.systemToken,
      }).eventList(resolved.realmId, eventListQueryCreate(flags)),
      [resolved.systemToken, resolved.connection.token],
    )
  },
  parameters: { flags: { ...eventCommonFlags(), ...eventListFlags() } },
  docs: { brief: "List realm events (system access)" },
})

const eventTenantListCommand = buildCommand({
  async func(this: ApplicationContext, flags: EventListCliFlags) {
    const resolved = await eventCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    eventCliResultWrite(
      this,
      await eventApiClientCreate({
        baseUrl: resolved.connection.server,
        token: resolved.connection.token,
      }).eventTenantList(resolved.realmId, eventListQueryCreate(flags)),
      [resolved.connection.token, resolved.systemToken],
    )
  },
  parameters: { flags: { ...eventCommonFlags(), ...eventListFlags() } },
  docs: { brief: "List realm events (tenant access)" },
})

const eventExportCommand = buildCommand({
  async func(this: ApplicationContext, flags: EventListCliFlags) {
    const resolved = await eventCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    eventCliResultWrite(
      this,
      await eventApiClientCreate({
        baseUrl: resolved.connection.server,
        token: resolved.systemToken,
      }).eventExport(resolved.realmId, eventListQueryCreate(flags)),
      [resolved.systemToken, resolved.connection.token],
    )
  },
  parameters: { flags: { ...eventCommonFlags(), ...eventListFlags() } },
  docs: { brief: "Export realm events as JSON (system access)" },
})

export const eventCliCommands = buildRouteMap({
  routes: {
    export: eventExportCommand,
    list: eventListCommand,
    tenantList: eventTenantListCommand,
  },
  docs: { brief: "Append-only event log" },
})

async function eventCliConnectionResolve(context: ApplicationContext, flags: EventCliFlags) {
  const result = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!result.success) {
    eventCliResultWrite(context, result, [
      flags.systemToken,
      flags.token,
      context.process.env?.AUTHWORKS_SYSTEM_SECRET,
      context.process.env?.AUTHWORKS_TOKEN,
    ])
    return undefined
  }
  const realmId = scopeIdResolve(context, result.data.realmId, "realm")
  if (realmId === undefined) return undefined
  return {
    connection: result.data,
    realmId,
    systemToken: connectionProfileCliSystemTokenResolve(flags.systemToken ?? flags.token, context.process.env),
  }
}

function eventListQueryCreate(flags: EventListCliFlags): EventListQuery | undefined {
  if (
    flags.actorId === undefined &&
    flags.aggregateId === undefined &&
    flags.aggregateType === undefined &&
    flags.eventType === undefined &&
    flags.occurredFrom === undefined &&
    flags.occurredTo === undefined &&
    flags.pageSize === undefined &&
    flags.pageToken === undefined &&
    flags.sortBy === undefined &&
    flags.sortDirection === undefined &&
    flags.userSubjectId === undefined
  )
    return undefined
  return {
    ...(flags.actorId === undefined ? {} : { actorId: flags.actorId }),
    ...(flags.aggregateId === undefined ? {} : { aggregateId: flags.aggregateId }),
    ...(flags.aggregateType === undefined ? {} : { aggregateType: flags.aggregateType }),
    ...(flags.eventType === undefined ? {} : { eventType: flags.eventType }),
    ...(flags.occurredFrom === undefined ? {} : { occurredFrom: flags.occurredFrom }),
    ...(flags.occurredTo === undefined ? {} : { occurredTo: flags.occurredTo }),
    ...(flags.pageSize === undefined ? {} : { pageSize: flags.pageSize }),
    ...(flags.pageToken === undefined ? {} : { pageToken: flags.pageToken }),
    ...(flags.sortBy === undefined ? {} : { sortBy: flags.sortBy }),
    ...(flags.sortDirection === undefined ? {} : { sortDirection: flags.sortDirection }),
    ...(flags.userSubjectId === undefined ? {} : { userSubjectId: flags.userSubjectId }),
  }
}

function eventCliResultWrite(
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

function eventListFlags() {
  return {
    actorId: {
      brief: "Filter by actor ID",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "ID",
    },
    aggregateId: {
      brief: "Filter by aggregate ID",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "ID",
    },
    aggregateType: {
      brief: "Filter by aggregate type",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TYPE",
    },
    eventType: {
      brief: "Filter by event type",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TYPE",
    },
    occurredFrom: {
      brief: "Filter by earliest occurrence timestamp",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => Number(value),
      placeholder: "TIMESTAMP",
    },
    occurredTo: {
      brief: "Filter by latest occurrence timestamp",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => Number(value),
      placeholder: "TIMESTAMP",
    },
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
    userSubjectId: {
      brief: "Filter by user subject ID",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "ID",
    },
  }
}

function eventCommonFlags() {
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
    systemToken: {
      brief: "System Bearer [REDACTED]",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
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
