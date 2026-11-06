import { expect, test } from "bun:test"
import { authenticatedRelativeTimeFormat } from "./authenticatedRelativeTimeFormat.js"

test("future days and months use abbreviated relative time", () => {
  const now = Date.parse("2026-10-23T12:00:00Z")
  expect(authenticatedRelativeTimeFormat(now + 3 * 86_400_000, now, "en")).toBe("in 3 d")
  expect(authenticatedRelativeTimeFormat(now + 61 * 86_400_000, now, "en")).toBe("in 2 mo")
})

test("short notation formats past and future distances", () => {
  const now = Date.parse("2026-10-23T12:00:00Z")
  const format = (offset: number) => authenticatedRelativeTimeFormat(now + offset, now, "en", "short")
  expect(format(0)).toBe("now")
  expect(format(-5 * 60_000)).toBe("5m")
  expect(format(-2 * 3_600_000)).toBe("2h")
  expect(format(-6 * 86_400_000)).toBe("6d")
  expect(format(-90 * 86_400_000)).toBe("3mo")
  expect(format(-730 * 86_400_000)).toBe("2y")
  expect(format(3 * 86_400_000)).toBe("in 3d")
})
