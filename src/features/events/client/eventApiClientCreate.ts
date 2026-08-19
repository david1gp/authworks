import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listQueryToSearchParams } from "../../../platform/http/listQueryToSearchParams.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { type EventListResponse, eventListResponseSchema } from "../public/eventListResponseSchema.js"

type EventApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type EventApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: EventApiFetch
  readonly token?: Secret | string
}

export function eventApiClientCreate(options: EventApiClientCreateOptions) {
  const eventList = (realmId: string, query?: ListQuery): Promise<Result<EventListResponse>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { method: "GET" },
      op: "eventApiClientList",
      path: `/system/realms/${encodeURIComponent(realmId)}/events${listQueryToSearchParams(query)}`,
      schema: eventListResponseSchema,
      token: options.token,
    })

  return {
    eventList(realmId: string, query?: ListQuery): Promise<Result<EventListResponse>> {
      const parsedRealmId = v.safeParse(v.pipe(v.string(), v.minLength(1)), realmId)
      if (!parsedRealmId.success)
        return Promise.resolve(resultErrorCreate("eventApiClientList", "The realm ID is invalid.", "events.invalid"))
      return eventList(parsedRealmId.output, query)
    },
  }
}
