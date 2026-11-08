import { describe, expect, test } from "bun:test"
import { loginDefaultDestinationResolve } from "../../src/features/login/model/loginDefaultDestinationResolve.js"

describe("loginDefaultDestinationResolve", () => {
  test("sends realm administrators to the realm overview", () => {
    expect(loginDefaultDestinationResolve({ organizationRoles: [], realmAdministrator: true })).toBe("/realm")
  })

  test("sends owners and admins of the active organization to its users page", () => {
    expect(loginDefaultDestinationResolve({ organizationRoles: ["owner"], realmAdministrator: false }, "acme")).toBe(
      "/orgs/acme/users",
    )
    expect(loginDefaultDestinationResolve({ organizationRoles: ["admin"], realmAdministrator: false }, "acme")).toBe(
      "/orgs/acme/users",
    )
    expect(
      loginDefaultDestinationResolve({ organizationRoles: ["member", "admin"], realmAdministrator: false }, "acme"),
    ).toBe("/orgs/acme/users")
  })

  test("keeps the account default for members, guests, role-free sessions, and slug-free admins", () => {
    expect(loginDefaultDestinationResolve({ organizationRoles: ["member"], realmAdministrator: false })).toBe(
      "/account",
    )
    expect(loginDefaultDestinationResolve({ organizationRoles: ["guest"], realmAdministrator: false })).toBe("/account")
    expect(loginDefaultDestinationResolve({ organizationRoles: [], realmAdministrator: false })).toBe("/account")
    expect(loginDefaultDestinationResolve({ organizationRoles: ["owner"], realmAdministrator: false })).toBe("/account")
  })
})
