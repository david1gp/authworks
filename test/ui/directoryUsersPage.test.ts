import { describe, expect, test } from "bun:test"
import { directoryAdminUserStatusTone } from "../../src/features/directory/ui/directoryAdminUserStatusTone.js"
import { directoryAdminUsersQueryParse } from "../../src/features/directory/ui/directoryAdminUsersQuerySchema.js"

describe("directory users URL query parsing", () => {
  test("falls back to empty defaults for a missing query", () => {
    expect(directoryAdminUsersQueryParse("")).toEqual({})
  })
  test("parses the people tab state from the URL", () => {
    expect(directoryAdminUsersQueryParse("?tab=people&q=ada&role=owner&scope=all&sort=userName&dir=asc")).toEqual({
      dir: "asc",
      q: "ada",
      role: "owner",
      scope: "all",
      sort: "userName",
      tab: "people",
    })
  })
  test("parses the service-account and invitation tabs and dialogs", () => {
    expect(directoryAdminUsersQueryParse("?tab=service-accounts&dialog=create-service-account")).toEqual({
      dialog: "create-service-account",
      tab: "service-accounts",
    })
    expect(directoryAdminUsersQueryParse("?tab=invitations&dialog=invite")).toEqual({
      dialog: "invite",
      tab: "invitations",
    })
    expect(directoryAdminUsersQueryParse("?dialog=create-user")).toEqual({ dialog: "create-user" })
  })
  test("drops unknown enum values instead of failing", () => {
    expect(directoryAdminUsersQueryParse("?tab=nope&role=superadmin&scope=realm&sort=email&dir=sideways")).toEqual({})
  })
})

describe("directory user status tone mapping", () => {
  test("maps active and initial people to calm or positive tones", () => {
    expect(directoryAdminUserStatusTone("active")).toBe("success")
    expect(directoryAdminUserStatusTone("initial")).toBe("neutral")
  })
  test("maps inactive and suspended people to the warning tone", () => {
    expect(directoryAdminUserStatusTone("inactive")).toBe("warning")
    expect(directoryAdminUserStatusTone("suspended")).toBe("warning")
  })
  test("maps locked and deleted people to the danger tone", () => {
    expect(directoryAdminUserStatusTone("locked")).toBe("danger")
    expect(directoryAdminUserStatusTone("deleted")).toBe("danger")
  })
})
