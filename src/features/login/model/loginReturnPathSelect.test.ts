import { describe, expect, test } from "bun:test"
import { loginInteractionHandleSelect } from "./loginInteractionHandleSelect.js"
import { loginReturnPathSelect } from "./loginReturnPathSelect.js"

describe("hosted login return paths and interaction handles", () => {
  test("accepts same-origin absolute paths", () => {
    expect(loginReturnPathSelect("/account/profile", "/account")).toBe("/account/profile")
    expect(loginReturnPathSelect("/oauth2/authorize?interaction=abc", "/account")).toBe(
      "/oauth2/authorize?interaction=abc",
    )
  })

  test("rejects cross-origin, protocol-relative, and traversal-style destinations", () => {
    for (const candidate of [
      "https://evil.example/steal",
      "//evil.example/steal",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ])
      expect(loginReturnPathSelect(candidate, "/account")).toBe("/account")
  })

  test("rejects control characters, over-long values, and broken percent encoding", () => {
    expect(loginReturnPathSelect("/account\n/profile", "/account")).toBe("/account")
    expect(loginReturnPathSelect(`/${"a".repeat(2100)}`, "/account")).toBe("/account")
    expect(loginReturnPathSelect("/account%zz", "/account")).toBe("/account")
    expect(loginReturnPathSelect("/%2f%2fevil.example", "/account")).toBe("/account")
  })

  test("accepts only opaque server-issued interaction handles", () => {
    const handle = "a".repeat(43)
    expect(loginInteractionHandleSelect(handle)).toBe(handle)
    expect(loginInteractionHandleSelect("too-short")).toBeUndefined()
    expect(loginInteractionHandleSelect(`${"a".repeat(42)}/../x`)).toBeUndefined()
    expect(loginInteractionHandleSelect(null)).toBeUndefined()
    expect(loginInteractionHandleSelect("a".repeat(200))).toBeUndefined()
  })
})
