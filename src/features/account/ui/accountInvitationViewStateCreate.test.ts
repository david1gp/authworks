import { describe, expect, test } from "bun:test"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"
import { accountInvitationViewStateCreate } from "./accountInvitationViewStateCreate.js"

describe("invitation continuation", () => {
  test.each(["accepted", "declined", "expired", "replayed", "permission-denied", "error", "empty"] as const)(
    "offers the account access continuation after %s",
    (status) => {
      const state = accountInvitationViewStateCreate({
        error: () => undefined,
        organizationsHref: () => undefined,
        status: () => status,
      })
      expect(state.continuationVisible()).toBe(true)
      expect(state.continuationHref()).toBe("/account#access")
    },
  )

  test("keeps missing-token errors actionable without copying the token or demo fixture parameters", () => {
    const state = accountInvitationViewStateCreate({
      error: () => "missing-token",
      organizationsHref: () => "/demo/account/organizations",
      status: () => "error",
    })
    expect(state.boundary().state).toBe("error")
    expect(state.continuationVisible()).toBe(true)
    expect(state.continuationHref()).toBe("/demo/account/organizations")
  })

  test("updates continuation visibility when loading or acting on the invitation finishes", () => {
    let status: AccountAccessStatus = "loading"
    const state = accountInvitationViewStateCreate({
      error: () => undefined,
      organizationsHref: () => undefined,
      status: () => status,
    })
    expect(state.continuationVisible()).toBe(false)
    status = "ready"
    expect(state.continuationVisible()).toBe(false)
    status = "accepted"
    expect(state.continuationVisible()).toBe(true)
  })
})
