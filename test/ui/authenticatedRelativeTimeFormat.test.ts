import { expect, test } from "bun:test"
import { authenticatedAbsoluteTimeFormat } from "../../src/ui/authenticated/authenticatedAbsoluteTimeFormat.js"
import { authenticatedRelativeTimeFormat } from "../../src/ui/authenticated/authenticatedRelativeTimeFormat.js"

const noon = new Date("2026-10-23T12:00:00Z").getTime()

test("relative time walks seconds up to years in both directions", () => {
  expect(authenticatedRelativeTimeFormat(noon - 45_000, noon, "en")).toBe("just now")
  expect(authenticatedRelativeTimeFormat(noon - 5 * 60_000, noon, "en")).toBe("5 min ago")
  expect(authenticatedRelativeTimeFormat(noon - 3 * 3_600_000, noon, "en")).toBe("3 h ago")
  expect(authenticatedRelativeTimeFormat(noon - 26 * 3_600_000, noon, "en")).toBe("1 d ago")
  expect(authenticatedRelativeTimeFormat(noon - 10 * 86_400_000, noon, "en")).toBe("10 d ago")
  expect(authenticatedRelativeTimeFormat(noon - 90 * 86_400_000, noon, "en")).toBe("3 mo ago")
  expect(authenticatedRelativeTimeFormat(noon - 400 * 86_400_000, noon, "en")).toBe("1 yr ago")
  expect(authenticatedRelativeTimeFormat(noon + 2 * 3_600_000, noon, "en")).toBe("in 2 h")
})

test("relative time follows the requested locale", () => {
  expect(authenticatedRelativeTimeFormat(noon - 5 * 60_000, noon, "de")).toBe("vor 5 Min.")
})

test("invalid timestamps format to an empty string", () => {
  expect(authenticatedRelativeTimeFormat(Number.NaN, noon, "en")).toBe("")
  expect(authenticatedAbsoluteTimeFormat(Number.NaN, "en")).toBe("")
})

test("absolute time renders a medium date with a short time", () => {
  expect(authenticatedAbsoluteTimeFormat(noon, "en")).toBe(
    new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(noon),
  )
})
