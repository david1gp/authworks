import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import type { Event as TenantEvent } from "../../events/public/eventSchema.js"
import type { Realm } from "../../realms/public/realmSchema.js"
import type { AdminAdapter } from "./adminAdapter.js"
import { adminDemoEventFixtures } from "./adminDemoEventFixtures.js"
import { adminDemoWhatsappUsageFixture } from "./adminDemoWhatsappUsageFixture.js"
import { adminDemoRealmFixtureCreate } from "./adminDemoRealmFixtureCreate.js"
import { adminDemoUserFixtures } from "./adminDemoUserFixtures.js"
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
    eventList: async (query) => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoEventList")
      if (failed !== undefined) return failed
      return resultCreate({
        items:
          fixtureState() === "empty"
            ? []
            : [...events]
                .sort((a, b) => b.occurredAt - a.occurredAt)
                .slice(0, query?.pageSize ?? events.length)
                .map((event) => ({
                  ...event,
                  actorDisplayName:
                    adminDemoUserFixtures.find((user) => user.id === event.actorId)?.profile.displayName ??
                    (event.actorId ? "Realm administrator" : null),
                })),
      })
    },
    realmSummaryGet: async () => {
      if (fixtureState() === "loading") return pending()
      if (fixtureState() === "permission-denied")
        return resultErrorCodedCreate(
          "adminDemoRealmSummaryGet",
          "You do not have permission to read the realm summary.",
          "realms.forbidden",
        )
      const failed = readFailure("adminDemoRealmSummaryGet")
      if (failed !== undefined) return failed
      if (fixtureState() === "empty")
        return resultCreate({
          organizations: 0,
          users: 0,
          realmAdministrators: 0,
          oidcClients: 0,
          activeSessions: 0,
          auditEvents24h: 0,
        })
      return resultCreate({
        organizations: 4,
        users: 13,
        realmAdministrators: 2,
        oidcClients: 5,
        activeSessions: 8,
        auditEvents24h: 42,
      })
    },
    realmGet: async () => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoRealmGet")
      if (failed !== undefined) return failed
      return resultCreate({ realm })
    },
    whatsappOtpUsageGet: async () => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoWhatsappOtpUsageGet")
      if (failed !== undefined) return failed
      if (fixtureState() === "empty")
        return resultCreate({
          attempts: {
            byPurposeLastDay: {},
            byStatusLastDay: { blocked: 0, failed: 0, sent: 0 },
            byStatusLastHour: { blocked: 0, failed: 0, sent: 0 },
          },
          limits: { dailyPerSender: 100, hourlyPerSender: 20 },
          recent: [],
          requests: { otpRequestedLastDay: 0, otpRequestedLastHour: 0 },
          senders: [],
          totals: { sentLastDay: 0, sentLastHour: 0 },
        })
      return resultCreate(structuredClone(adminDemoWhatsappUsageFixture))
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
