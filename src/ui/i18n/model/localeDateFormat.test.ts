import { expect, test } from "bun:test"
import { localeDateFormat } from "./localeDateFormat.js"

test("invalid timestamps render as empty instead of throwing", () => {
  expect(localeDateFormat(Number.NaN)).toBe("")
})

test("out-of-range timestamps render as empty instead of throwing", () => {
  expect(localeDateFormat(8.65e15)).toBe("")
  expect(localeDateFormat(1e18)).toBe("")
})

test("valid timestamps render a non-empty date", () => {
  expect(localeDateFormat(0).length).toBeGreaterThan(0)
})
