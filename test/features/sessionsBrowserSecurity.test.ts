import { expect, test } from "bun:test"
import { sessionBrowserCookieExtract } from "../../src/features/sessions/domain/sessionBrowserCookieExtract.js"
import { sessionBrowserCookieParse } from "../../src/features/sessions/domain/sessionBrowserCookieParse.js"
import { sessionBrowserCookieSerialize } from "../../src/features/sessions/domain/sessionBrowserCookieSerialize.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { sessionCsrfTokenValidate } from "../../src/features/sessions/domain/sessionCsrfTokenValidate.js"
import { sessionRequestOriginValidate } from "../../src/features/sessions/domain/sessionRequestOriginValidate.js"
import { sessionReturnPathValidate } from "../../src/features/sessions/domain/sessionReturnPathValidate.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

test("browser cookies serialize securely and parse without ambiguity", () => {
  const serialized = sessionBrowserCookieSerialize("session", "opaque-token")
  expect(serialized).toEqual({
    data: "session=opaque-token; Path=/; HttpOnly; Secure; SameSite=Lax",
    success: true,
  })
  if (!serialized.success) return
  const parsed = sessionBrowserCookieParse("session=opaque-token; theme=dark")
  expect(parsed).toEqual({ data: { session: "opaque-token", theme: "dark" }, success: true })
  expect(sessionBrowserCookieExtract("session=opaque-token; theme=dark", "session")).toEqual({
    data: "opaque-token",
    success: true,
  })
  expect(sessionBrowserCookieExtract("theme=dark", "session")).toEqual({ data: undefined, success: true })
  const quoted = sessionBrowserCookieParse('session="opaque-token"')
  expect(quoted).toEqual({ data: { session: "opaque-token" }, success: true })
  expect(sessionBrowserCookieParse("session=one; session=two").success).toBe(false)
  expect(sessionBrowserCookieParse("session=bad value").success).toBe(false)
  expect(sessionBrowserCookieSerialize("session", "bad;value").success).toBe(false)
  expect(sessionBrowserCookieSerialize("session", "", { maxAge: 0, expires: new Date(0) })).toMatchObject({
    success: true,
    data: "session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  })
})

test("CSRF tokens are unpredictable-format and compared safely", () => {
  const testkit = platformTestkitCreate()
  const first = sessionCsrfTokenCreate(testkit.runtime)
  const second = sessionCsrfTokenCreate(testkit.runtime)
  expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(second).not.toBe(first)
  expect(sessionCsrfTokenValidate(first, first)).toBe(true)
  expect(sessionCsrfTokenValidate(first, second)).toBe(false)
  expect(sessionCsrfTokenValidate(undefined, first)).toBe(false)
  expect(sessionCsrfTokenValidate("short", first)).toBe(false)
})

test("request origins must match the configured public origin", () => {
  const publicOrigin = "https://identity.example.test/app"
  expect(
    sessionRequestOriginValidate(
      new Request("https://identity.example.test/app/login", { headers: { origin: "https://identity.example.test" } }),
      publicOrigin,
    ),
  ).toEqual({ data: true, success: true })
  expect(
    sessionRequestOriginValidate(
      new Request("https://identity.example.test/app/login", { headers: { origin: "https://evil.example.test" } }),
      publicOrigin,
    ),
  ).toEqual({ data: false, success: true })
  expect(sessionRequestOriginValidate(new Request("https://identity.example.test/app/login"), publicOrigin)).toEqual({
    data: false,
    success: true,
  })
  expect(
    sessionRequestOriginValidate(
      new Request("https://identity.example.test/app/login", { headers: { origin: "null" } }),
      publicOrigin,
    ),
  ).toEqual({ data: false, success: true })
  expect(sessionRequestOriginValidate(new Request("https://identity.example.test"), "not-an-origin").success).toBe(
    false,
  )
})

test("return paths remain relative to the configured origin", () => {
  expect(sessionReturnPathValidate("/account/security?tab=sessions#active", "https://identity.example.test")).toEqual({
    data: "/account/security?tab=sessions#active",
    success: true,
  })
  expect(sessionReturnPathValidate("/account/../login", "https://identity.example.test")).toEqual({
    data: "/login",
    success: true,
  })
  for (const unsafe of [
    "https://evil.example.test/",
    "//evil.example.test/",
    "/\\\\evil.example.test/",
    "/%5C%5Cevil.example.test/",
    "/%2F%2Fevil.example.test/",
    "/bad%2",
    "javascript:alert(1)",
    "",
  ]) {
    expect(sessionReturnPathValidate(unsafe, "https://identity.example.test").success).toBe(false)
  }
})
