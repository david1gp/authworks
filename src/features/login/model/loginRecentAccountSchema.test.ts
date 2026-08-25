import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { loginRecentAccountSchema } from "./loginRecentAccountSchema.js"

describe("login recent account model", () => {
  test("accepts an optional display label without changing the identifier contract", () => {
    const account = {
      authenticationMethod: "password",
      identifier: "alex@acme.example",
      label: "Alex Morgan",
      lastUsedAt: 10,
      sessionId: "session-alex",
    } as const

    const parsed = v.safeParse(loginRecentAccountSchema, account)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.output).toEqual(account)
    expect(
      v.safeParse(loginRecentAccountSchema, {
        authenticationMethod: account.authenticationMethod,
        identifier: account.identifier,
        lastUsedAt: account.lastUsedAt,
        sessionId: account.sessionId,
      }).success,
    ).toBe(true)
  })
})
