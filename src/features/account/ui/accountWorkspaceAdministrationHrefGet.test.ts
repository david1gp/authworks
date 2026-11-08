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

const organizations = [{ id: "active", slug: "active-org" }]

describe("account administration continuation", () => {
  test("offers realm overview to realm administrators without an active organization", () => {
    expect(
      accountWorkspaceAdministrationHrefGet(
        {
          ...guard,
          access: { organizationRoles: [], realmAdministrator: true },
          organization: "missing",
        },
        organizations,
      ),
    ).toBe("/realm")
  })

  test.each(["owner", "admin"] as const)("offers administration to an active organization %s", (role) => {
    expect(
      accountWorkspaceAdministrationHrefGet(
        {
          ...guard,
          access: { organizationRoles: [role], realmAdministrator: false },
        },
        organizations,
      ),
    ).toBe("/orgs/active-org/users")
  })

  test("offers nothing when the active organization slug is unknown", () => {
    expect(
      accountWorkspaceAdministrationHrefGet(
        {
          ...guard,
          access: { organizationRoles: ["owner"], realmAdministrator: false },
        },
        [],
      ),
    ).toBeUndefined()
  })

  test.each(["member", "guest"] as const)("does not offer administration to an ordinary %s", (role) => {
    expect(
      accountWorkspaceAdministrationHrefGet(
        {
          ...guard,
          access: { organizationRoles: [role], realmAdministrator: false },
        },
        organizations,
      ),
    ).toBeUndefined()
  })

  test("does not expose administration for unresolved access or stale organization roles", () => {
    expect(accountWorkspaceAdministrationHrefGet({ ...guard, access: "loading" }, organizations)).toBeUndefined()
    expect(
      accountWorkspaceAdministrationHrefGet(
        {
          ...guard,
          access: { organizationRoles: ["admin"], realmAdministrator: false },
          organization: "loading",
        },
        organizations,
      ),
    ).toBeUndefined()
    expect(
      accountWorkspaceAdministrationHrefGet({ ...guard, authentication: "anonymous" }, organizations),
    ).toBeUndefined()
    expect(accountWorkspaceAdministrationHrefGet({ ...guard, realm: "missing" }, organizations)).toBeUndefined()
  })
})
