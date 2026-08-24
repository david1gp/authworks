import { describe, expect, test } from "bun:test"
import { loginIdentifierNormalize } from "./loginIdentifierNormalize.js"
import { loginPreferenceLoad } from "./loginPreferenceLoad.js"
import { loginPreferenceSave } from "./loginPreferenceSave.js"

function storageCreate(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

describe("hosted login identifier preference", () => {
  test("normalizes email identifiers but preserves username casing", () => {
    expect(loginIdentifierNormalize("  Person@Example.COM ")).toBe("person@example.com")
    expect(loginIdentifierNormalize("  UserName ")).toBe("UserName")
  })

  test("round-trips a remembered identifier without exposing password data", () => {
    const storage = storageCreate()
    const preference = {
      identifier: "person@example.com",
      rememberIdentifier: true,
      updatedAt: Date.now(),
      version: 1 as const,
    }

    expect(loginPreferenceSave(storage, "org-1", preference).success).toBe(true)
    expect(loginPreferenceLoad(storage, "org-1")).toEqual({ success: true, data: preference })
    expect(storage.getItem("authworks:login:preference:v1:org-1")).not.toContain("password")
  })

  test("round-trips a remembered email in the organization-scoped preference", () => {
    const storage = storageCreate()
    const preference = {
      email: "person@example.com",
      rememberIdentifier: true,
      updatedAt: Date.now(),
      version: 1 as const,
    }

    expect(loginPreferenceSave(storage, "org-1", preference).success).toBe(true)
    expect(loginPreferenceLoad(storage, "org-1")).toEqual({ success: true, data: preference })
  })

  test("drops malformed and expired remembered identifiers", () => {
    const storage = storageCreate({
      "authworks:login:preference:v1:org-1": JSON.stringify({ invalid: true }),
    })
    expect(loginPreferenceLoad(storage, "org-1").success).toBe(false)
    expect(storage.getItem("authworks:login:preference:v1:org-1")).toBeNull()

    const expired = storageCreate({
      "authworks:login:preference:v1:org-1": JSON.stringify({
        identifier: "old@example.com",
        rememberIdentifier: true,
        updatedAt: Date.now() - 181 * 24 * 60 * 60 * 1000,
        version: 1,
      }),
    })
    const loaded = loginPreferenceLoad(expired, "org-1")
    expect(loaded).toEqual({
      success: true,
      data: expect.objectContaining({ rememberIdentifier: true, identifier: undefined }),
    })
    expect(expired.getItem("authworks:login:preference:v1:org-1")).not.toContain("old@example.com")
  })
})
