import { expect, test } from "bun:test"
import * as v from "valibot"
import { englishCatalog } from "../../src/ui/i18n/model/englishCatalog.js"
import { adminDemoUserSessionsFixture } from "../../src/features/admin/ui/adminDemoUserSessionsFixture.js"
import { sessionDeviceMetadataSchema } from "../../src/features/sessions/public/sessionDeviceMetadataSchema.js"

test("session region display exposes explicit region and country labels", () => {
  expect(englishCatalog["admin.users.sessions.region"]).toBe("Region")
  expect(englishCatalog["admin.users.sessions.country"]).toBe("Country")
})

test("session region display demo fixtures carry geo data for every session", () => {
  expect(adminDemoUserSessionsFixture.length).toBeGreaterThan(0)
  for (const session of adminDemoUserSessionsFixture) {
    expect(session.device.region?.trim().length ?? 0).toBeGreaterThan(0)
    expect(session.device.countryCode?.trim().length ?? 0).toBeGreaterThan(0)
  }
})

test("session region display device schema accepts region and country code", () => {
  const parsed = v.safeParse(sessionDeviceMetadataSchema, {
    countryCode: "DE",
    description: "Firefox on Linux",
    ipAddress: "192.0.2.10",
    region: "Berlin",
  })
  expect(parsed.success).toBe(true)
})
