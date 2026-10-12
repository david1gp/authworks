import { describe, expect, test } from "bun:test"
import { loginChallengeTokenSelect } from "./loginChallengeTokenSelect.js"

describe("hosted login MFA challenge tokens", () => {
  test("accepts only opaque server-issued challenge tokens", () => {
    const token = "a".repeat(43)
    expect(loginChallengeTokenSelect(token)).toBe(token)
    expect(loginChallengeTokenSelect("a".repeat(128))).toBe("a".repeat(128))
    expect(loginChallengeTokenSelect("too-short")).toBeUndefined()
    expect(loginChallengeTokenSelect(`${"a".repeat(42)}/../x`)).toBeUndefined()
    expect(loginChallengeTokenSelect(null)).toBeUndefined()
    expect(loginChallengeTokenSelect(undefined)).toBeUndefined()
    expect(loginChallengeTokenSelect("a".repeat(200))).toBeUndefined()
  })
})
