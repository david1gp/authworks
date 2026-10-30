import { expect, test } from "bun:test"
import { sessionGeoConfigurationParse } from "../../src/features/sessions/server/sessionGeoConfigurationParse.js"

test("session geo configuration defaults to the public endpoint when unset", () => {
  const parsed = sessionGeoConfigurationParse({})
  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.data).toEqual({ baseUrl: "http://ip-api.com/json/" })
})

test("session geo configuration honors a custom endpoint", () => {
  const parsed = sessionGeoConfigurationParse({ AUTHWORKS_GEO_LOOKUP_URL: "https://geo.example.com" })
  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.data).toEqual({ baseUrl: "https://geo.example.com/" })
})

test("session geo configuration disables enrichment on an explicit empty value", () => {
  const parsed = sessionGeoConfigurationParse({ AUTHWORKS_GEO_LOOKUP_URL: "   " })
  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.data).toBeUndefined()
})

test("session geo configuration rejects an invalid URL", () => {
  const parsed = sessionGeoConfigurationParse({ AUTHWORKS_GEO_LOOKUP_URL: "not-a-url" })
  expect(parsed.success).toBe(false)
})
