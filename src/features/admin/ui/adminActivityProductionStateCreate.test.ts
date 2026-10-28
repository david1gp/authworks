import { afterAll, expect, mock, test } from "bun:test"
import type { ProductionSessionContextValue } from "../../../ui/production/productionSessionContextValue.js"

const session: ProductionSessionContextValue = {
  actorLabel: "Administrator",
  guard: {
    access: { organizationRoles: ["admin"], realmAdministrator: true },
    authentication: { status: "authenticated", userId: "user" },
    organization: { organizationId: "org", status: "available" },
    permission: "not-required",
    realm: { realmId: "realm", status: "available" },
  },
  impersonation: null,
  organizations: [{ id: "org", label: "Northwind Labs" }],
  organizationSelect: async () => ({ success: true, data: undefined }),
  organizationSwitchPending: () => false,
  realms: [{ id: "realm", label: "Northwind IAM" }],
}
let guard = session.guard
mock.module("../../../ui/production/productionSessionContextGet.js", () => ({
  productionSessionContextGet: () => ({
    ...session,
    get guard() {
      return guard
    },
  }),
}))
afterAll(() => mock.restore())

test("production activity follows live organization selection, never treats a pending selection as IAM", async () => {
  const { adminActivityProductionStateCreate } = await import("./adminActivityProductionStateCreate.js")
  const state = adminActivityProductionStateCreate()
  expect(state.organizationId()).toBe("org")
  expect(state.contextLabel()).toBe("Northwind Labs")
  guard = { ...guard, organization: "loading" }
  expect(state.ready()).toBe(false)
  guard = { ...guard, organization: "missing" }
  expect(state.ready()).toBe(true)
  expect(state.organizationId()).toBeUndefined()
  expect(state.contextLabel()).toBe("Northwind IAM")
  expect(state.allowed()).toBe(true)
  guard = { ...guard, organizationResolutionFailed: true }
  expect(state.contextError()).toBe(true)
  expect(state.allowed()).toBe(false)
  guard = { ...guard, organizationResolutionFailed: false }
  guard = { ...guard, access: { organizationRoles: ["admin"], realmAdministrator: false } }
  expect(state.allowed()).toBe(false)
})
