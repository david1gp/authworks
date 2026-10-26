import { describe, expect, test } from "bun:test"
import { authenticatedIconRegistry } from "../../../ui/authenticated/authenticatedIconRegistry.js"
import { directoryRoleIconGet } from "./directoryRoleIconGet.js"
import { directoryTabIconGet } from "./directoryTabIconGet.js"

describe("directory zentral icons", () => {
  test("tabs map to distinct non-empty MDI paths", () => {
    const people = directoryTabIconGet("people")
    const serviceAccounts = directoryTabIconGet("service-accounts")
    const invitations = directoryTabIconGet("invitations")
    for (const icon of [people, serviceAccounts, invitations]) expect(icon.length).toBeGreaterThan(10)
    expect(new Set([people, serviceAccounts, invitations]).size).toBe(3)
  })

  test("roles map to distinct non-empty MDI paths", () => {
    const all = directoryRoleIconGet("all")
    const owner = directoryRoleIconGet("owner")
    const admin = directoryRoleIconGet("admin")
    const member = directoryRoleIconGet("member")
    const guest = directoryRoleIconGet("guest")
    for (const icon of [all, owner, admin, member, guest]) expect(icon.length).toBeGreaterThan(10)
    expect(new Set([owner, admin, member, guest]).size).toBe(4)
  })

  test("registry entries are shared references", () => {
    expect(directoryTabIconGet("people")).toBe(authenticatedIconRegistry.directoryTabPeople)
    expect(directoryRoleIconGet("owner")).toBe(authenticatedIconRegistry.directoryRoleOwner)
  })
})
