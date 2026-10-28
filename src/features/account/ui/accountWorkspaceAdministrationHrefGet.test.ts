import { describe, expect, test } from "bun:test"
import type { ProductionRouteGuardContext } from "../../../ui/production/productionRouteGuardContext.js"
import { accountWorkspaceAdministrationHrefGet } from "./accountWorkspaceAdministrationHrefGet.js"

const guard: ProductionRouteGuardContext = {
  access: { organizationRoles: [], realmAdministrator: false },
  authentication: { status: "authenticated", userId: "user" },
  organization: { organizationId: "active", status: "available" },
  permission: "not-required",
  realm: { realmId: "realm", status: "available" },
}

describe("account administration continuation", () => {
  test("offers administration to realm administrators without an active organization", () => {
    expect(
      accountWorkspaceAdministrationHrefGet({
        ...guard,
        access: { organizationRoles: [], realmAdministrator: true },
        organization: "missing",
      }),
    ).toBe("/admin/users")
  })

  test.each(["owner", "admin"] as const)("offers administration to an active organization %s", (role) => {
    expect(
      accountWorkspaceAdministrationHrefGet({
        ...guard,
        access: { organizationRoles: [role], realmAdministrator: false },
      }),
    ).toBe("/admin/users")
  })

  test.each(["member", "guest"] as const)("does not offer administration to an ordinary %s", (role) => {
    expect(
      accountWorkspaceAdministrationHrefGet({
        ...guard,
        access: { organizationRoles: [role], realmAdministrator: false },
      }),
    ).toBeUndefined()
  })

  test("does not expose administration for unresolved access or stale organization roles", () => {
    expect(accountWorkspaceAdministrationHrefGet({ ...guard, access: "loading" })).toBeUndefined()
    expect(
      accountWorkspaceAdministrationHrefGet({
        ...guard,
        access: { organizationRoles: ["admin"], realmAdministrator: false },
        organization: "loading",
      }),
    ).toBeUndefined()
    expect(accountWorkspaceAdministrationHrefGet({ ...guard, authentication: "anonymous" })).toBeUndefined()
    expect(accountWorkspaceAdministrationHrefGet({ ...guard, realm: "missing" })).toBeUndefined()
  })
})
