import { describe, expect, test } from "bun:test"
import {
  directoryRealmAdministratorsAddDialogOpenGet,
  directoryRealmAdministratorsQueryParse,
} from "../../src/features/directory/ui/directoryRealmAdministratorsQuerySchema.js"

describe("realm administrators URL query parsing", () => {
  test("falls back to empty defaults for a missing query", () => {
    expect(directoryRealmAdministratorsQueryParse("")).toEqual({})
  })
  test("parses the add-administrator dialog and search state", () => {
    expect(directoryRealmAdministratorsQueryParse("?dialog=add-admin&q=ada")).toEqual({
      dialog: "add-admin",
      q: "ada",
    })
  })
  test("drops the query instead of failing on unknown dialog values", () => {
    expect(directoryRealmAdministratorsQueryParse("?dialog=invite&q=ada")).toEqual({})
    expect(directoryRealmAdministratorsAddDialogOpenGet("?dialog=invite")).toBe(false)
  })
  test("detects the add-administrator dialog slot", () => {
    expect(directoryRealmAdministratorsAddDialogOpenGet("?dialog=add-admin")).toBe(true)
    expect(directoryRealmAdministratorsAddDialogOpenGet("")).toBe(false)
  })
})
