import { expect, test } from "bun:test"
import * as v from "valibot"
import { eventSecurityHistoryProjectionCreate } from "./eventSecurityHistoryProjectionCreate.js"
import { eventSecurityHistoryItemSchema } from "../public/eventSecurityHistoryItemSchema.js"

test("security history attaches the session device location without leaking other payload fields", () => {
  const projected = eventSecurityHistoryProjectionCreate({
    category: "sessions",
    displayCode: "session.created",
    eventType: "session.created",
    id: "session-device-event",
    occurredAt: 100,
    payload: {
      device: {
        countryCode: "US",
        description: "Work laptop",
        fingerprint: "fingerprint-must-not-leak",
        ipAddress: "203.0.113.7",
        region: "California",
        userAgent: "agent-must-not-leak",
      },
    },
  })
  expect(projected).toEqual({
    data: {
      category: "sessions",
      countryCode: "US",
      displayCode: "session.created",
      id: "session-device-event",
      ipAddress: "203.0.113.7",
      occurredAt: 100,
      region: "California",
    },
    success: true,
  })
  if (!projected.success) return
  expect(v.safeParse(eventSecurityHistoryItemSchema, projected.data).success).toBe(true)
  expect(JSON.stringify(projected.data)).not.toContain("fingerprint-must-not-leak")
  expect(JSON.stringify(projected.data)).not.toContain("agent-must-not-leak")
})

test("security history leaves other categories without location fields", () => {
  const projected = eventSecurityHistoryProjectionCreate({
    category: "passwords",
    displayCode: "password.login_succeeded",
    eventType: "password.login_succeeded",
    id: "password-device-event",
    occurredAt: 200,
    payload: { password: "secret-password", strategy: "password" },
  })
  expect(projected).toEqual({
    data: {
      category: "passwords",
      displayCode: "password.login_succeeded",
      id: "password-device-event",
      occurredAt: 200,
    },
    success: true,
  })
})

test("security history omits blank device fields and stays backward compatible without payloads", () => {
  const blanked = eventSecurityHistoryProjectionCreate({
    category: "sessions",
    displayCode: "session.created",
    eventType: "session.created",
    id: "blank-device-event",
    occurredAt: 300,
    payload: { device: { countryCode: "  ", ipAddress: "", region: "Oregon" } },
  })
  expect(blanked).toEqual({
    data: {
      category: "sessions",
      displayCode: "session.created",
      id: "blank-device-event",
      occurredAt: 300,
      region: "Oregon",
    },
    success: true,
  })
  const legacy = eventSecurityHistoryProjectionCreate({
    category: "sessions",
    displayCode: "session.created",
    eventType: "session.created",
    id: "legacy-device-event",
    occurredAt: 400,
  })
  expect(legacy).toEqual({
    data: { category: "sessions", displayCode: "session.created", id: "legacy-device-event", occurredAt: 400 },
    success: true,
  })
  if (!legacy.success) return
  expect(v.safeParse(eventSecurityHistoryItemSchema, legacy.data).success).toBe(true)
})
