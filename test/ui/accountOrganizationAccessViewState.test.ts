import { expect, test } from "bun:test"
import { accountOrganizationAccessViewStateCreate } from "../../src/features/account/ui/accountOrganizationAccessViewStateCreate.js"
import type { AccountAccessStatus } from "../../src/features/account/ui/accountAccessStatusSchema.js"

test("organization access view exposes loading, empty, and ready boundaries for each response", () => {
  let organizationStatus: AccountAccessStatus = "loading"
  let effectiveAccessStatus: AccountAccessStatus = "loading"
  const state = accountOrganizationAccessViewStateCreate({
    effectiveAccessError: () => undefined,
    effectiveAccessStatus: () => effectiveAccessStatus,
    organizationError: () => undefined,
    organizationStatus: () => organizationStatus,
    organizations: () => [],
  })

  expect(state.organizationBoundary()).toEqual({ state: "loading" })
  expect(state.organizationSummary()).toBe("Loading")
  expect(state.effectiveAccessBoundary()).toEqual({ state: "loading" })

  organizationStatus = "empty"
  effectiveAccessStatus = "empty"
  expect(state.organizationBoundary()).toEqual({
    detail: "This account does not belong to an organization.",
    state: "empty",
  })
  expect(state.organizationSummary()).toBe("0 organizations")
  expect(state.effectiveAccessBoundary()).toEqual({
    detail: "This account has no active organization or project access.",
    state: "empty",
  })

  organizationStatus = "ready"
  effectiveAccessStatus = "ready"
  expect(state.organizationBoundary()).toEqual({ state: "ready" })
  expect(state.effectiveAccessBoundary()).toEqual({ state: "ready" })
})

test("organization access view preserves response errors and permission boundaries", () => {
  let organizationStatus: AccountAccessStatus = "error"
  let effectiveAccessStatus: AccountAccessStatus = "permission-denied"
  const state = accountOrganizationAccessViewStateCreate({
    effectiveAccessError: () => undefined,
    effectiveAccessStatus: () => effectiveAccessStatus,
    organizationError: () => "Organization access failed.",
    organizationStatus: () => organizationStatus,
    organizations: () => [],
  })

  expect(state.organizationBoundary()).toEqual({ detail: "Organization access failed.", state: "error" })
  expect(state.organizationSummary()).toBe("This account information could not be loaded.")
  expect(state.effectiveAccessBoundary()).toEqual({
    detail: "You do not have permission to perform this action.",
    state: "inaccessible",
  })

  organizationStatus = "expired"
  effectiveAccessStatus = "error"
  expect(state.organizationBoundary()).toEqual({ detail: "Organization access failed.", state: "inaccessible" })
  expect(state.effectiveAccessBoundary()).toEqual({ detail: undefined, state: "error" })
})
