import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { type EventExportResponse, eventExportResponseSchema } from "../public/eventExportResponseSchema.js"
import { type EventListQuery } from "../public/eventListQuerySchema.js"
import { type EventListResponse, eventListResponseSchema } from "../public/eventListResponseSchema.js"

type EventApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type EventApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: EventApiFetch
  readonly token?: Secret | string
}

export function eventApiClientCreate(options: EventApiClientCreateOptions) {
  const eventSystemList = (realmId: string, query?: EventListQuery): Promise<Result<EventListResponse>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { method: "GET" },
      op: "eventApiClientList",
      path: `/system/realms/${encodeURIComponent(realmId)}/events${eventListQueryToSearchParams(query)}`,
      schema: eventListResponseSchema,
      token: options.token,
    })
  const eventTenantList = (realmId: string, query?: EventListQuery): Promise<Result<EventListResponse>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { credentials: "same-origin", method: "GET" },
      op: "eventApiClientTenantList",
      path: `/realms/${encodeURIComponent(realmId)}/events${eventListQueryToSearchParams(query)}`,
      schema: eventListResponseSchema,
      token: options.token,
    })
  const eventSystemExport = (realmId: string, query?: EventListQuery): Promise<Result<EventExportResponse>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { method: "GET" },
      op: "eventApiClientExport",
      path: `/system/realms/${encodeURIComponent(realmId)}/events/export${eventListQueryToSearchParams(query)}`,
      schema: eventExportResponseSchema,
      token: options.token,
    })
  const eventTenantExport = (realmId: string, query?: EventListQuery): Promise<Result<EventExportResponse>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { credentials: "same-origin", method: "GET" },
      op: "eventApiClientTenantExport",
      path: `/realms/${encodeURIComponent(realmId)}/events/export${eventListQueryToSearchParams(query)}`,
      schema: eventExportResponseSchema,
      token: options.token,
    })

  return {
    eventOrganizationList(
      realmId: string,
      organizationId: string,
      query?: EventListQuery,
    ): Promise<Result<EventListResponse>> {
      if (realmId.length === 0 || organizationId.length === 0)
        return Promise.resolve(
          resultErrorCreate(
            "eventApiClientOrganizationList",
            "The realm or organization ID is invalid.",
            "events.invalid",
          ),
        )
      return httpApiClientRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: { credentials: "same-origin", method: "GET" },
        op: "eventApiClientOrganizationList",
        path: `/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/activity${eventListQueryToSearchParams(query)}`,
        schema: eventListResponseSchema,
        token: options.token,
      })
    },
    eventExport(realmId: string, query?: EventListQuery): Promise<Result<EventExportResponse>> {
      const parsedRealmId = v.safeParse(v.pipe(v.string(), v.minLength(1)), realmId)
      if (!parsedRealmId.success)
        return Promise.resolve(resultErrorCreate("eventApiClientExport", "The realm ID is invalid.", "events.invalid"))
      return eventSystemExport(parsedRealmId.output, query)
    },
    eventList(realmId: string, query?: EventListQuery): Promise<Result<EventListResponse>> {
      const parsedRealmId = v.safeParse(v.pipe(v.string(), v.minLength(1)), realmId)
      if (!parsedRealmId.success)
        return Promise.resolve(resultErrorCreate("eventApiClientList", "The realm ID is invalid.", "events.invalid"))
      return eventSystemList(parsedRealmId.output, query)
    },
    eventTenantExport(realmId: string, query?: EventListQuery): Promise<Result<EventExportResponse>> {
      const parsedRealmId = v.safeParse(v.pipe(v.string(), v.minLength(1)), realmId)
      if (!parsedRealmId.success)
        return Promise.resolve(
          resultErrorCreate("eventApiClientTenantExport", "The realm ID is invalid.", "events.invalid"),
        )
      return eventTenantExport(parsedRealmId.output, query)
    },
    eventTenantList(realmId: string, query?: EventListQuery): Promise<Result<EventListResponse>> {
      const parsedRealmId = v.safeParse(v.pipe(v.string(), v.minLength(1)), realmId)
      if (!parsedRealmId.success)
        return Promise.resolve(
          resultErrorCreate("eventApiClientTenantList", "The realm ID is invalid.", "events.invalid"),
        )
      return eventTenantList(parsedRealmId.output, query)
    },
  }
}

function eventListQueryToSearchParams(query: EventListQuery | ListQuery | undefined): string {
  if (query === undefined) return ""
  const params = new URLSearchParams()
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize))
  if (query.pageToken !== undefined) params.set("pageToken", query.pageToken)
  if (query.search !== undefined) params.set("search", query.search)
  if (query.sortBy !== undefined) params.set("sortBy", query.sortBy)
  if (query.sortDirection !== undefined) params.set("sortDirection", query.sortDirection)
  const filters = query as EventListQuery
  if (filters.actorId !== undefined) params.set("actorId", filters.actorId)
  if (filters.aggregateId !== undefined) params.set("aggregateId", filters.aggregateId)
  if (filters.aggregateType !== undefined) params.set("aggregateType", filters.aggregateType)
  if (filters.eventType !== undefined) params.set("eventType", filters.eventType)
  if (filters.occurredFrom !== undefined) params.set("occurredFrom", String(filters.occurredFrom))
  if (filters.occurredTo !== undefined) params.set("occurredTo", String(filters.occurredTo))
  if (filters.userSubjectId !== undefined) params.set("userSubjectId", filters.userSubjectId)
  const encoded = params.toString()
  return encoded.length === 0 ? "" : `?${encoded}`
}
