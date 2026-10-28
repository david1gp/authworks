import { expect, mock, test } from "bun:test"
import { createEffect, createRoot } from "solid-js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import type { OrganizationAdminAdapter } from "./organizationAdminAdapter.js"
import { organizationAdminDemoAdapterCreate } from "./organizationAdminDemoAdapterCreate.js"
import { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"

let location = { hash: "#domains", pathname: "/organization/configuration", search: "" }
const navigate = mock((href: string) => {
  location.search = new URL(href, "https://auth.example.com").search
})
mock.module("@solidjs/router", () => ({ useLocation: () => location, useNavigate: () => navigate }))
const solidRuntimePath = "solid-js/dist/dev.js"
mock.module("solid-js", () => import(solidRuntimePath))
const { organizationAdminScreenStateCreate } = await import("./organizationAdminScreenStateCreate.js")

function fixtureCreate() {
  location = { hash: "#domains", pathname: "/organization/configuration", search: "?section=domains" }
  navigate.mockClear()
  const adapter = organizationAdminDemoAdapterCreate(() => "success")
  let resolveClaim!: (result: Awaited<ReturnType<OrganizationAdminAdapter["domainClaim"]>>) => void
  const claim = mock<OrganizationAdminAdapter["domainClaim"]>(
    () =>
      new Promise((resolve) => {
        resolveClaim = resolve
      }),
  )
  const page = organizationAdminPageStateCreate({
    adapter: { ...adapter, domainClaim: claim },
    organizationId: () => "01900000-0000-7000-8000-000000000011",
    screen: () => "configuration",
  })
  const ready = new Promise<void>((resolve) => {
    createEffect(() => {
      if (page.status() === "ready") resolve()
    })
  })
  const state = organizationAdminScreenStateCreate({
    basePath: "/organization",
    confirmState: confirmStateCreate(),
    page,
  })
  return {
    adapter,
    claim,
    page,
    ready,
    resolveClaim: (result: Parameters<typeof resolveClaim>[0]) => resolveClaim(result),
    state,
  }
}

for (const [code, message] of [
  ["platform.internal", "The service is unavailable. Try again."],
  ["authorization.denied", "You do not have permission to claim this domain."],
  ["sessions.expired", "Your session has expired. Sign in again."],
] as const) {
  test(`domain claim retains the dialog and inputs after delayed ${code}, prevents duplicate submits, and clears only after retry succeeds`, async () => {
    let dispose!: () => void
    const fixture = createRoot((cleanup) => {
      dispose = cleanup
      return fixtureCreate()
    })
    try {
      await fixture.ready
      const { state, page } = fixture
      state.domainClaimOpenSet(true)
      state.form.claimDomain.set("claim.example.com")
      state.form.claimPrimary.set(true)
      const event = { preventDefault: mock(() => {}) } as unknown as SubmitEvent
      const submission = state.domainClaimSubmit(event)
      expect(state.domainClaimPending()).toBe(true)
      expect(state.domainClaimOpen()).toBe(true)
      expect(state.form.claimDomain.get()).toBe("claim.example.com")
      expect(state.form.claimPrimary.get()).toBe(true)
      state.domainClaimOpenSet(false)
      await state.domainClaimSubmit(event)
      expect(await page.domainClaim("duplicate.example.com", false)).toBe(false)
      expect(fixture.claim).toHaveBeenCalledTimes(1)
      expect(fixture.claim).toHaveBeenLastCalledWith(page.organizationId(), {
        domain: "claim.example.com",
        isPrimary: true,
      })
      expect(state.domainClaimOpen()).toBe(true)
      fixture.resolveClaim(resultErrorCodedCreate("domainClaim", message, code))
      await submission
      expect(state.domainClaimPending()).toBe(false)
      expect(page.status()).toBe("ready")
      expect(page.domainClaimError()).toBe(message)
      expect(state.domainClaimOpen()).toBe(true)
      expect(state.form.claimDomain.get()).toBe("claim.example.com")
      expect(state.form.claimPrimary.get()).toBe(true)

      const retry = state.domainClaimSubmit(event)
      expect(page.domainClaimError()).toBeUndefined()
      expect(fixture.claim).toHaveBeenCalledTimes(2)
      fixture.resolveClaim(
        await fixture.adapter.domainClaim(page.organizationId(), { domain: "claim.example.com", isPrimary: true }),
      )
      await retry
      expect(state.domainClaimOpen()).toBe(false)
      expect(state.domainClaimPending()).toBe(false)
      expect(state.form.claimDomain.get()).toBe("")
      expect(state.form.claimPrimary.get()).toBe(false)
      expect(location.search).toBe("?section=domains")
      expect(navigate.mock.calls.at(-1)?.[0]).toBe("/organization/configuration?section=domains#domains")
    } finally {
      dispose()
    }
  })
}

test("domain claim URL state rejects unknown dialog values and validation never sends a mutation", () => {
  createRoot((dispose) => {
    const { claim, state } = fixtureCreate()
    location.search = "?domain-dialog=unknown"
    expect(state.domainClaimOpen()).toBe(false)
    state.domainClaimOpenSet(true)
    void state.domainClaimSubmit({ preventDefault: () => {} } as SubmitEvent)
    expect(claim).not.toHaveBeenCalled()
    expect(state.domainClaimOpen()).toBe(true)
    expect(state.form.validationMessage.get()).toBeDefined()
    dispose()
  })
})
