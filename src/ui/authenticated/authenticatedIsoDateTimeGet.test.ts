import { expect, test } from "bun:test"
import { authenticatedIsoDateTimeGet } from "./authenticatedIsoDateTimeGet.js"

test("invalid timestamps yield undefined instead of throwing", () => {
  expect(authenticatedIsoDateTimeGet(null)).toBeUndefined()
  expect(authenticatedIsoDateTimeGet(undefined)).toBeUndefined()
  expect(authenticatedIsoDateTimeGet(Number.NaN)).toBeUndefined()
  expect(authenticatedIsoDateTimeGet("not-a-date")).toBeUndefined()
})

test("out-of-range timestamps yield undefined instead of throwing", () => {
  expect(authenticatedIsoDateTimeGet(8.65e15)).toBeUndefined()
  expect(authenticatedIsoDateTimeGet(1e18)).toBeUndefined()
})

test("valid timestamps yield an ISO string", () => {
  expect(authenticatedIsoDateTimeGet(0)).toBe("1970-01-01T00:00:00.000Z")
  expect(authenticatedIsoDateTimeGet("2026-01-01T00:00:00.000Z")).toBe("2026-01-01T00:00:00.000Z")
})
