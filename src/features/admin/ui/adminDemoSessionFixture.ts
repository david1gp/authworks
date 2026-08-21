import type { AdminSession } from "./adminAdapter.js"

const fixtureNow = Date.UTC(2026, 7, 21, 9, 30)

export const adminDemoSessionFixture: AdminSession = {
  expiresAt: fixtureNow + 900_000,
  sessionId: "01900000-0000-7000-8000-0000000000a1",
  subjectId: "01900000-0000-7000-8000-0000000000b1",
  subjectType: "bootstrap_admin",
}
