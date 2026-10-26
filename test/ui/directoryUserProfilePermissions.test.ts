import { describe, expect, test } from "bun:test"
import { directoryUserProfilePermissionsResolve } from "../../src/features/directory/ui/directoryUserProfilePermissions.js"
import {
  directoryUserProfileDialogSelect,
  directoryUserProfileTabSelect,
} from "../../src/features/directory/ui/directoryUserProfileUrlState.js"

const owner = { organizationRoles: ["owner"], realmAdministrator: false } as const
const admin = { organizationRoles: ["admin"], realmAdministrator: false } as const
const member = { organizationRoles: ["member"], realmAdministrator: false } as const
const realmAdmin = { organizationRoles: [], realmAdministrator: true } as const

describe("user profile permitted actions", () => {
  test("lets realm administrators act on anyone, including owners and realm administrators", () => {
    const onOwner = directoryUserProfilePermissionsResolve(realmAdmin, {
      realmAdministrator: true,
      roles: ["owner"],
    })
    expect(onOwner.delete).toBe(true)
    expect(onOwner.setPassword).toBe(true)
    expect(onOwner.revokeRealmAdministrator).toBe(true)
    expect(onOwner.grantRealmAdministrator).toBe(false)
    expect(onOwner.manageOrganizationRole).toBe(true)

    const onMember = directoryUserProfilePermissionsResolve(realmAdmin, {
      realmAdministrator: false,
      roles: ["member"],
    })
    expect(onMember.grantRealmAdministrator).toBe(true)
    expect(onMember.manageOrganizationRole).toBe(true)
  })

  test("lets owners manage admins and members but never realm administrators", () => {
    const onAdmin = directoryUserProfilePermissionsResolve(owner, {
      realmAdministrator: false,
      roles: ["admin"],
    })
    expect(onAdmin.delete).toBe(true)
    expect(onAdmin.impersonate).toBe(true)
    expect(onAdmin.setPassword).toBe(false)
    expect(onAdmin.manageOrganizationRole).toBe(true)

    const onOwner = directoryUserProfilePermissionsResolve(owner, {
      realmAdministrator: false,
      roles: ["owner"],
    })
    expect(onOwner.manageOrganizationRole).toBe(true)
    expect(onOwner.delete).toBe(true)

    const onRealmAdmin = directoryUserProfilePermissionsResolve(owner, {
      realmAdministrator: true,
      roles: ["member"],
    })
    expect(onRealmAdmin.delete).toBe(false)
    expect(onRealmAdmin.editProfile).toBe(false)
    expect(onRealmAdmin.impersonate).toBe(false)
  })

  test("stops admins from acting on owners while letting them manage members", () => {
    const onOwner = directoryUserProfilePermissionsResolve(admin, {
      realmAdministrator: false,
      roles: ["owner"],
    })
    expect(onOwner.delete).toBe(false)
    expect(onOwner.impersonate).toBe(false)
    expect(onOwner.unlock).toBe(false)

    const onMember = directoryUserProfilePermissionsResolve(admin, {
      realmAdministrator: false,
      roles: ["member"],
    })
    expect(onMember.activate).toBe(true)
    expect(onMember.delete).toBe(true)
    expect(onMember.setPassword).toBe(false)
    expect(onMember.grantRealmAdministrator).toBe(false)
  })

  test("denies plain members every profile action", () => {
    const permissions = directoryUserProfilePermissionsResolve(member, {
      realmAdministrator: false,
      roles: ["member"],
    })
    expect(Object.values(permissions).every((allowed) => allowed === false)).toBe(true)
  })
})

describe("user profile url state", () => {
  test("defaults to the overview tab and rejects unknown tabs", () => {
    expect(directoryUserProfileTabSelect("")).toBe("overview")
    expect(directoryUserProfileTabSelect("?tab=access")).toBe("access")
    expect(directoryUserProfileTabSelect("?tab=security")).toBe("security")
    expect(directoryUserProfileTabSelect("?tab=activity")).toBe("overview")
  })

  test("accepts only the known profile dialogs", () => {
    expect(directoryUserProfileDialogSelect("")).toBe(undefined)
    expect(directoryUserProfileDialogSelect("?dialog=edit-profile")).toBe("edit-profile")
    expect(directoryUserProfileDialogSelect("?dialog=assign-roles")).toBe("assign-roles")
    expect(directoryUserProfileDialogSelect("?dialog=set-password")).toBe("set-password")
    expect(directoryUserProfileDialogSelect("?dialog=delete")).toBe("delete")
    expect(directoryUserProfileDialogSelect("?dialog=purge")).toBe("purge")
    expect(directoryUserProfileDialogSelect("?dialog=remove")).toBe(undefined)
  })
})
