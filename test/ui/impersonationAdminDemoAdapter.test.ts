import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { demoAdminImpersonationNow } from "../../src/features/demo/demoAdminImpersonationNow.js"
import { demoAdminImpersonationSession } from "../../src/features/demo/demoAdminImpersonationSession.js"
import { impersonationStartRequestSchema } from "../../src/features/impersonation/public/impersonationStartRequestSchema.js"
import { impersonationAdminDemoAdapterCreate } from "../../src/features/impersonation/ui/impersonationAdminDemoAdapterCreate.js"
import { impersonationAdminDurationBounds } from "../../src/features/impersonation/ui/impersonationAdminDurationBounds.js"
import { impersonationAdminDurationOptions } from "../../src/features/impersonation/ui/impersonationAdminDurationOptions.js"
import { impersonationAdminFailureStatusSelect } from "../../src/features/impersonation/ui/impersonationAdminFailureStatusSelect.js"

const alexId = "01900000-0000-7000-8000-000000000021"
const lockedId = "01900000-0000-7000-8000-000000000023"

describe("impersonation duration bounds", () => {
  test("never offer a duration the server would reject", () => {
    for (const seconds of impersonationAdminDurationOptions) {
      expect(seconds).toBeGreaterThanOrEqual(impersonationAdminDurationBounds.minimumSeconds)
      expect(seconds).toBeLessThanOrEqual(impersonationAdminDurationBounds.maximumSeconds)
      const parsed = v.safeParse(impersonationStartRequestSchema, {
        durationSeconds: seconds,
        reason: "Support investigation",
        targetUserId: alexId,
      })
      expect(parsed.success).toBe(true)
    }
  })
})

describe("impersonation failure mapping", () => {
  test("distinguishes assurance, nesting, and permission from generic errors", () => {
    expect(impersonationAdminFailureStatusSelect({ code: "authorization.insufficient-assurance" })).toBe(
      "assurance-required",
    )
    expect(impersonationAdminFailureStatusSelect({ code: "sessions.assurance-required" })).toBe("assurance-required")
    expect(impersonationAdminFailureStatusSelect({ code: "authorization.impersonation-forbidden" })).toBe(
      "nested-rejected",
    )
    expect(impersonationAdminFailureStatusSelect({ code: "authorization.forbidden" })).toBe("permission-denied")
    expect(impersonationAdminFailureStatusSelect({ statusCode: 403 })).toBe("permission-denied")
    expect(impersonationAdminFailureStatusSelect({ code: "impersonation.read-failed" })).toBe("error")
  })
})

describe("impersonation administration demo adapter", () => {
  test("reports an eligible actor and no active session in the success state", async () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "success")

    const eligibility = await adapter.eligibilityGet()
    const active = await adapter.activeGet()

    expect(eligibility.success && eligibility.data.permitted).toBe(true)
    expect(eligibility.success && eligibility.data.assurance).toBe("multi_factor")
    expect(eligibility.success && eligibility.data.nested).toBe(false)
    expect(active.success && active.data).toBeNull()
  })

  test("reports an unmet assurance without hiding the reason", async () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "assurance-required")

    const eligibility = await adapter.eligibilityGet()
    const started = await adapter.impersonationStart({
      durationSeconds: 600,
      reason: "Support investigation",
      targetUserId: alexId,
    })

    expect(eligibility.success && eligibility.data.assurance).toBe("authenticated")
    expect(eligibility.success && eligibility.data.permitted).toBe(false)
    expect(!started.success && started.code).toBe("authorization.insufficient-assurance")
  })

  test("refuses a nested impersonation with the prohibiting code", async () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "nested-rejected")

    const eligibility = await adapter.eligibilityGet()
    const active = await adapter.activeGet()
    const started = await adapter.impersonationStart({
      durationSeconds: 600,
      reason: "Support investigation",
      targetUserId: alexId,
    })

    expect(eligibility.success && eligibility.data.nested).toBe(true)
    expect(active.success && active.data?.sessionId).toBe(demoAdminImpersonationSession.sessionId)
    expect(!started.success && started.code).toBe("authorization.impersonation-forbidden")
  })

  test("denies a start without the impersonate permission", async () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "permission-denied")

    const started = await adapter.impersonationStart({
      durationSeconds: 600,
      reason: "Support investigation",
      targetUserId: alexId,
    })

    expect(!started.success && started.code).toBe("authorization.forbidden")
  })

  test("starts a bounded, reasoned session and never returns a credential", async () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "success")

    const started = await adapter.impersonationStart({
      durationSeconds: 300,
      organizationId: "01900000-0000-7000-8000-000000000011",
      reason: "  Ticket NW-1: reproduce the failure.  ",
      targetUserId: alexId,
    })

    expect(started.success && started.data.subjectId).toBe(alexId)
    expect(started.success && started.data.expiresAt).toBe(demoAdminImpersonationNow + 300_000)
    expect(started.success && started.data.reason).toBe("Ticket NW-1: reproduce the failure.")
    // No credential of any kind crosses the adapter boundary.
    const keys = started.success ? Object.keys(started.data) : []
    expect(keys).not.toContain("token")
    expect(keys).not.toContain("secret")
    expect(keys.some((name) => /token|secret|credential/i.test(name))).toBe(false)
  })

  test("rejects a target that is not active", async () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "success")

    const started = await adapter.impersonationStart({
      durationSeconds: 600,
      reason: "Support investigation",
      targetUserId: lockedId,
    })

    expect(!started.success && started.code).toBe("impersonation.not-found")
  })

  test("exposes an active session that the end action clears", async () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "active")

    const active = await adapter.activeGet()
    const ended = await adapter.impersonationEnd(demoAdminImpersonationSession.sessionId)
    const after = await adapter.activeGet()

    expect(active.success && active.data?.subjectLabel).toBe("Alex Morgan")
    expect(ended.success && ended.data.ended).toBe(true)
    expect(after.success && after.data).toBeNull()
  })

  test("the expiring state is under a minute from its enforced expiry", async () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "expiring")

    const active = await adapter.activeGet()

    const remaining = active.success && active.data !== null ? active.data.expiresAt - demoAdminImpersonationNow : 0
    expect(remaining).toBeLessThan(60_000)
    expect(remaining).toBeGreaterThan(0)
  })

  test("the ended state has no active session left to end", async () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "ended")

    const active = await adapter.activeGet()
    const ended = await adapter.impersonationEnd(demoAdminImpersonationSession.sessionId)

    expect(active.success && active.data).toBeNull()
    expect(ended.success && ended.data.ended).toBe(false)
  })

  test("never settles in the loading state so the loading view stays visible", async () => {
    const pending = impersonationAdminDemoAdapterCreate(() => "loading").eligibilityGet()

    const outcome = await Promise.race([
      pending.then(() => "settled" as const),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 25)),
    ])

    expect(outcome).toBe("pending")
  })

  test("surfaces a coded read failure in the error state", async () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "error")

    const eligibility = await adapter.eligibilityGet()

    expect(!eligibility.success && eligibility.code).toBe("impersonation.read-failed")
  })

  test("offers only active organizations for a scoped session", async () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "success")

    const organizations = await adapter.organizationList()

    expect(organizations.success && organizations.data.length).toBeGreaterThan(0)
    expect(organizations.success && organizations.data.some((item) => item.name === "Globex Corporation")).toBe(false)
  })

  test("exposes no operation that reads a session credential", () => {
    const adapter = impersonationAdminDemoAdapterCreate(() => "success")

    const surface = Object.keys(adapter)
    expect(surface.some((name) => /token|secret|credential/i.test(name))).toBe(false)
  })
})
