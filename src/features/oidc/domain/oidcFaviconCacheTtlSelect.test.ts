import { expect, test } from "bun:test"
import { oidcFaviconCacheTtlSelect } from "./oidcFaviconCacheTtlSelect.js"

const weekMs = 7 * 24 * 60 * 60 * 1000

test("project favicon cache uses upstream max-age when configured", () => {
  expect(oidcFaviconCacheTtlSelect({ cacheControl: "public, max-age=3600", expires: null, now: 0 })).toBe(3_600_000)
})

test("project favicon cache prefers s-maxage for the shared proxy cache", () => {
  expect(oidcFaviconCacheTtlSelect({ cacheControl: "public, max-age=60, s-maxage=600", expires: null, now: 0 })).toBe(
    600_000,
  )
})

test("project favicon cache uses expires when no max-age is configured", () => {
  expect(
    oidcFaviconCacheTtlSelect({
      cacheControl: "public",
      expires: new Date(60_000).toUTCString(),
      now: 0,
    }),
  ).toBe(60_000)
})

test("project favicon cache disables caching on no-store", () => {
  expect(oidcFaviconCacheTtlSelect({ cacheControl: "no-store", expires: null, now: 0 })).toBe(0)
})

test("project favicon cache defaults to one week without upstream headers", () => {
  expect(oidcFaviconCacheTtlSelect({ cacheControl: null, expires: null, now: 0 })).toBe(weekMs)
  expect(oidcFaviconCacheTtlSelect({ cacheControl: "public", expires: "not-a-date", now: 0 })).toBe(weekMs)
})
