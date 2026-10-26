import { describe, expect, mock, test } from "bun:test"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { EventListQuery } from "../../events/public/eventListQuerySchema.js"
import { adminDemoAdapterCreate } from "./adminDemoAdapterCreate.js"
import { adminEventFiltersParse } from "./adminEventFiltersSchema.js"
import { adminEventFiltersToQuery } from "./adminEventFiltersSchema.js"

// Plain `bun test` resolves Solid's server runtime, whose effects do not run.
// Use the real client runtime so the filter-driven reload is exercised.
const solidRuntimePath = "../../../../node_modules/solid-js/dist/solid.js"
const solidRuntime = await import(solidRuntimePath)
mock.module("solid-js", () => solidRuntime)
const [{ createRoot }, { adminPageStateCreate }] = await Promise.all([
  import("solid-js"),
  import("./adminPageStateCreate.js"),
])

const flushEffects = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe("administrator event filters", () => {
  test("unknown and invalid filter params fall back to empty", () => {
    expect(adminEventFiltersParse("?eventType=&occurredFrom=not-a-date&unknown=1")).toEqual({})
    expect(adminEventFiltersParse("")).toEqual({})
  })

  test("valid params parse into every server filter", () => {
    expect(
      adminEventFiltersParse(
        "?eventType=session.revoked&aggregateType=session&aggregateId=abc&actorId=admin&userSubjectId=user-1&occurredFrom=2026-09-01&occurredTo=2026-10-01",
      ),
    ).toEqual({
      actorId: "admin",
      aggregateId: "abc",
      aggregateType: "session",
      eventType: "session.revoked",
      occurredFrom: "2026-09-01",
      occurredTo: "2026-10-01",
      userSubjectId: "user-1",
    })
  })

  test("an invalid calendar date is dropped while the other filters serialize", () => {
    expect(
      adminEventFiltersToQuery({
        eventType: "session.revoked",
        occurredFrom: "2026-09-01",
        occurredTo: "2026-10-02",
      }),
    ).toEqual({
      eventType: "session.revoked",
      occurredFrom: Date.parse("2026-09-01T00:00:00.000Z"),
      occurredTo: Date.parse("2026-10-02T00:00:00.000Z") + 86_400_000 - 1,
    })
    // The to-date is inclusive, so the whole selected day counts.
    const single = adminEventFiltersToQuery({ occurredTo: "2026-10-02" })
    expect(single.occurredTo).toBe(Date.parse("2026-10-03T00:00:00.000Z") - 1)
  })

  test("the audit-events screen passes URL filters as server query params", async () => {
    const queries: (EventListQuery | undefined)[] = []
    const { page, dispose } = createRoot((dispose) => ({
      dispose,
      page: adminPageStateCreate({
        adapter: {
          ...adminDemoAdapterCreate(() => "success"),
          eventList: async (query) => {
            queries.push(query)
            return resultCreate({ items: [] })
          },
        },
        confirm: () => false,
        eventFilterSearch: () => "?eventType=session.revoked&actorId=admin-1&occurredFrom=2026-09-01",
        screen: () => "audit-events",
      }),
    }))
    await flushEffects()

    expect(queries).toHaveLength(1)
    expect(queries[0]).toMatchObject({
      eventType: "session.revoked",
      actorId: "admin-1",
      occurredFrom: Date.parse("2026-09-01T00:00:00.000Z"),
      pageSize: 20,
    })
    expect(queries[0]).not.toHaveProperty("occurredTo")
    dispose()
  })

  test("export sends the filters without pagination and reports the exported count", async () => {
    const exported: (EventListQuery | undefined)[] = []
    const createdUrls: string[] = []
    const anchor = { click: () => {}, download: "", href: "", remove: () => {} }
    const documentStub = {
      body: { append: (_element: unknown) => {} },
      createElement: (_tag: string) => anchor,
    }
    const globalScope = globalThis as unknown as Record<string, unknown>
    const previousDocument = globalScope.document
    globalScope.document = documentStub
    const previousCreateObjectURL = URL.createObjectURL
    const previousRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = () => {
      const url = "blob:authworks-events"
      createdUrls.push(url)
      return url
    }
    URL.revokeObjectURL = () => {}
    try {
      const { page, dispose } = createRoot((dispose) => ({
        dispose,
        page: adminPageStateCreate({
          adapter: {
            ...adminDemoAdapterCreate(() => "success"),
            eventExport: async (query) => {
              exported.push(query)
              return resultCreate({
                items: [
                  {
                    actorId: "admin-1",
                    aggregateId: "session-1",
                    aggregateType: "session",
                    aggregateVersion: 1,
                    correlationId: "correlation-1",
                    eventType: "session.revoked",
                    id: "event-1",
                    metadata: {},
                    occurredAt: Date.parse("2026-09-15T12:00:00.000Z"),
                    payload: {},
                    realmId: "realm-1",
                    sequence: 1,
                  },
                ],
                truncated: false,
              })
            },
          },
          confirm: () => false,
          eventFilterSearch: () => "?eventType=session.revoked",
          screen: () => "audit-events",
        }),
      }))
      await flushEffects()
      await page.eventsExport()

      expect(exported).toHaveLength(1)
      expect(exported[0]).toEqual({ eventType: "session.revoked" })
      expect(anchor.href).toBe("blob:authworks-events")
      expect(anchor.download).toBe("authworks-events.json")
      expect(createdUrls).toEqual(["blob:authworks-events"])
      expect(page.notice()).toBe("Exported 1 events.")
      dispose()
    } finally {
      globalScope.document = previousDocument
      URL.createObjectURL = previousCreateObjectURL
      URL.revokeObjectURL = previousRevokeObjectURL
    }
  })
})
