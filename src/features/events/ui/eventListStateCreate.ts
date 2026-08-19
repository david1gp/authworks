import { useLocation } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import * as v from "valibot"
import { demoAdminEvents } from "../../demo/demoAdminEvents.js"

export function eventListStateCreate() {
  const location = useLocation()
  const query = createSignalObject(searchQueryGet(location.search))
  const expandedId = createSignalObject<string | undefined>(undefined)
  const events = demoAdminEvents.map((event) => ({ ...event, payload: payloadData(event.payload) }))
  const filteredEvents = () => {
    const value = query.get().toLowerCase()
    if (!value) return events
    return events.filter((event) =>
      `${event.eventType} ${event.aggregateType} ${event.actorId ?? ""} ${event.id}`.toLowerCase().includes(value),
    )
  }
  const searchSet = (value: string) => {
    query.set(value)
    const url = new URL(window.location.href)
    if (value) url.searchParams.set("q", value)
    else url.searchParams.delete("q")
    window.history.replaceState({}, "", url)
  }
  const toggleExpanded = (id: string) => expandedId.set(expandedId.get() === id ? undefined : id)
  // Production would use eventApiClientCreate here for the event list.
  return {
    expandedId: expandedId.get,
    filteredEvents,
    query: query.get,
    searchSet,
    toggleExpanded,
  }
}

function payloadData(payload: unknown): string | object | unknown[] {
  return typeof payload === "object" && payload !== null ? payload : String(payload)
}

function searchQueryGet(search: string): string {
  const value = new URLSearchParams(search).get("q")
  const result = v.safeParse(v.optional(v.string()), value ?? undefined)
  return result.success ? (result.output ?? "") : ""
}
