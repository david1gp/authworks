import { expect, test } from "bun:test"
import { oidcFaviconOriginSelect } from "./oidcFaviconOriginSelect.js"

test("project favicon origin prefers the first usable redirect URI origin", () => {
  expect(
    oidcFaviconOriginSelect({
      additionalOrigins: ["https://additional.example.com"],
      postLogoutRedirectUris: ["https://logout.example.com/signed-out"],
      redirectUris: ["https://app.example.com/callback", "https://other.example.com/callback"],
    }),
  ).toBe("https://app.example.com")
})

test("project favicon origin skips invalid redirect URIs and falls back", () => {
  expect(
    oidcFaviconOriginSelect({
      additionalOrigins: ["https://additional.example.com"],
      postLogoutRedirectUris: ["https://logout.example.com/signed-out"],
      redirectUris: ["not-a-url", "ftp://files.example.com/callback", "custom-scheme:/callback"],
    }),
  ).toBe("https://logout.example.com")
})

test("project favicon origin falls back to additional origins", () => {
  expect(
    oidcFaviconOriginSelect({
      additionalOrigins: ["https://additional.example.com"],
      postLogoutRedirectUris: [],
      redirectUris: [],
    }),
  ).toBe("https://additional.example.com")
})

test("project favicon origin is undefined when nothing usable is configured", () => {
  expect(oidcFaviconOriginSelect({ additionalOrigins: [], postLogoutRedirectUris: [], redirectUris: [] })).toBe(
    undefined,
  )
  expect(
    oidcFaviconOriginSelect({
      additionalOrigins: ["data:image/png;base64,abc"],
      postLogoutRedirectUris: ["javascript:alert(1)"],
      redirectUris: ["custom-scheme:/callback"],
    }),
  ).toBe(undefined)
})
