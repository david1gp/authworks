import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { directoryRolesKeyDerive } from "../../src/features/directory/ui/directoryRolesKeyDerive.js"
import { projectRoleCreateRequestSchema } from "../../src/features/projects/public/projectRoleCreateRequestSchema.js"

const backendKeySchema = projectRoleCreateRequestSchema.entries.key

describe("directory role key derivation", () => {
  test("lowercases names and collapses separators into single dashes", () => {
    expect(directoryRolesKeyDerive("Support Agent")).toBe("support-agent")
    expect(directoryRolesKeyDerive("Customer  Success__Lead")).toBe("customer-success-lead")
  })

  test("strips diacritics and trims leading and trailing dashes", () => {
    expect(directoryRolesKeyDerive("Café Münchner Kindl!")).toBe("cafe-mu-nchner-kindl")
    expect(directoryRolesKeyDerive("  --Reader--  ")).toBe("reader")
  })

  test("returns an empty string when nothing key-like remains", () => {
    expect(directoryRolesKeyDerive("")).toBe("")
    expect(directoryRolesKeyDerive("!!!")).toBe("")
  })

  test("derived keys satisfy the backend role key schema", () => {
    for (const displayName of ["Administrator", "Support Agent", "Café Viewer 2"]) {
      const derived = directoryRolesKeyDerive(displayName)
      expect(v.safeParse(backendKeySchema, derived).success).toBe(true)
    }
  })
})
