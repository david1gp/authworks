import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import type { Event as TenantEvent } from "../../events/public/eventSchema.js"
import type { Realm } from "../../realms/public/realmSchema.js"
import type { AdminAdapter } from "./adminAdapter.js"
import { adminDemoEventFixtures } from "./adminDemoEventFixtures.js"
import { adminDemoRealmFixtureCreate } from "./adminDemoRealmFixtureCreate.js"
import { adminSessionDemoAdapterCreate } from "./adminSessionDemoAdapterCreate.js"

/**
 * Deterministic in-memory administration adapter. Every response is produced locally so
 * `/demo/admin/**` requires no backend, authentication, or network access.
 */
export function adminDemoAdapterCreate(
  fixtureState: () => DemoFixtureState,
  options: { readonly signedInInitially?: boolean } = {},
): AdminAdapter {
  let realm: Realm = adminDemoRealmFixtureCreate()
  const events: TenantEvent[] = structuredClone(adminDemoEventFixtures) as TenantEvent[]
  const pending = <T>() => new Promise<T>(() => undefined)
  const readFailure = (op: string) => {
    if (fixtureState() === "error")
      return resultErrorCodedCreate(
        op,
        "The deterministic administration fixture is unavailable.",
        "realms.read-failed",
      )
    if (fixtureState() === "expired")
      return resultErrorCodedCreate(op, "The administrator session has expired.", "sessions.unauthorized")
    return undefined
  }
  const writeFailure = (op: string) => {
    if (fixtureState() === "permission-denied")
      return resultErrorCodedCreate(op, "You do not have permission to perform this action.", "realms.forbidden")
    return readFailure(op)
  }

  return {
    ...adminSessionDemoAdapterCreate({ fixtureState, signedInInitially: options.signedInInitially }),
    eventExport: async () => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoEventExport")
      if (failed !== undefined) return failed
      return resultCreate({ items: fixtureState() === "empty" ? [] : events, truncated: false })
    },
    eventList: async () => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoEventList")
      if (failed !== undefined) return failed
      return resultCreate({ items: fixtureState() === "empty" ? [] : events })
    },
    realmGet: async () => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoRealmGet")
      if (failed !== undefined) return failed
      return resultCreate({ realm })
    },
    realmUpdate: async (input) => {
      const failed = writeFailure("adminDemoRealmUpdate")
      if (failed !== undefined) return failed
      realm = {
        ...realm,
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.domains === undefined || input.domains.length === 0
          ? {}
          : { domain: input.domains[0] as string, domains: [...input.domains] }),
        updatedAt: realm.updatedAt + 1_000,
      }
      return resultCreate({ realm })
    },
  }
}
