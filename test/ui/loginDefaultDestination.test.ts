import { describe, expect, test } from "bun:test"
import { loginDefaultDestinationResolve } from "../../src/features/login/model/loginDefaultDestinationResolve.js"

describe("loginDefaultDestinationResolve", () => {
  test("sends realm administrators to the admin users page", () => {
    expect(loginDefaultDestinationResolve({ organizationRoles: [], realmAdministrator: true })).toBe("/admin/users")
  })

  test("sends owners and admins of the active organization to the admin users page", () => {
    expect(loginDefaultDestinationResolve({ organizationRoles: ["owner"], realmAdministrator: false })).toBe(
      "/admin/users",
    )
    expect(loginDefaultDestinationResolve({ organizationRoles: ["admin"], realmAdministrator: false })).toBe(
      "/admin/users",
    )
    expect(loginDefaultDestinationResolve({ organizationRoles: ["member", "admin"], realmAdministrator: false })).toBe(
      "/admin/users",
    )
  })

  test("keeps the account default for members, guests, and role-free sessions", () => {
    expect(loginDefaultDestinationResolve({ organizationRoles: ["member"], realmAdministrator: false })).toBe(
      "/account",
    )
    expect(loginDefaultDestinationResolve({ organizationRoles: ["guest"], realmAdministrator: false })).toBe("/account")
    expect(loginDefaultDestinationResolve({ organizationRoles: [], realmAdministrator: false })).toBe("/account")
  })
})
