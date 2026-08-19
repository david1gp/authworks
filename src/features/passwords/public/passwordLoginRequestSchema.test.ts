import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { passwordLoginRequestSchema } from "./passwordLoginRequestSchema.js"

describe("passwordLoginRequestSchema", () => {
  test("parses the demo login fixture", () => {
    const result = v.safeParse(passwordLoginRequestSchema, {
      identifier: "alex@example.com",
      organizationId: "org-acme",
      password: "correct horse battery staple",
    })
    expect(result.success).toBe(true)
  })
})
