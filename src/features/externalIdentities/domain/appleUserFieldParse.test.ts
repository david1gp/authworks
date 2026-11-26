import { expect, test } from "bun:test"
import { appleUserFieldParse } from "./appleUserFieldParse.js"

test("apple user field parses first-login names", () => {
  const parsed = appleUserFieldParse(
    JSON.stringify({ email: "ada@example.com", name: { firstName: " Ada ", lastName: " Lovelace " } }),
  )
  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.data).toMatchObject({ email: "ada@example.com", name: { firstName: "Ada", lastName: "Lovelace" } })
})

test("apple user field treats absent or blank input as no names", () => {
  for (const raw of [undefined, null, "", "   "] as const) {
    const parsed = appleUserFieldParse(raw)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBeNull()
  }
  const emptyObject = appleUserFieldParse(JSON.stringify({}))
  expect(emptyObject.success).toBe(true)
  if (emptyObject.success) expect(emptyObject.data).toBeNull()
})

test("apple user field treats empty and whitespace-only fields as absent", () => {
  for (const raw of [
    JSON.stringify({ email: "", name: { firstName: "", lastName: "" } }),
    JSON.stringify({ email: "   ", name: { firstName: "  ", lastName: " " } }),
    JSON.stringify({ name: { firstName: "", lastName: "" } }),
  ]) {
    const parsed = appleUserFieldParse(raw)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBeNull()
  }
})

test("apple user field keeps only the non-empty fields", () => {
  const nameOnly = appleUserFieldParse(JSON.stringify({ email: "", name: { firstName: "", lastName: "Lovelace" } }))
  expect(nameOnly.success).toBe(true)
  if (nameOnly.success) expect(nameOnly.data).toEqual({ name: { lastName: "Lovelace" } })
  const trimmed = appleUserFieldParse(JSON.stringify({ email: "  ", name: { firstName: " Ada ", lastName: "" } }))
  expect(trimmed.success).toBe(true)
  if (trimmed.success) expect(trimmed.data).toEqual({ name: { firstName: "Ada" } })
})

test("apple user field rejects malformed payloads", () => {
  for (const raw of ["not-json", JSON.stringify({ name: "Ada" }), JSON.stringify({ name: { firstName: 42 } })]) {
    expect(appleUserFieldParse(raw).success).toBe(false)
  }
})
