import { describe, expect, test } from "bun:test"
import { loginLegalUrlsGet } from "./loginLegalUrlsGet.js"

const privacyUrl = "https://example.com/privacy"
const termsUrl = "http://example.com/terms"

describe("loginLegalUrlsGet", () => {
  test("accepts a complete pair of absolute http and https URLs", () => {
    expect(loginLegalUrlsGet({ privacyUrl, termsUrl })).toEqual({ privacyUrl, termsUrl })
  })

  test.each(["javascript:alert(1)", "data:text/html,unsafe", "local/path", "https://"])(
    "rejects unsafe or malformed URLs without throwing: %s",
    (invalidUrl) => {
      expect(() => loginLegalUrlsGet({ privacyUrl, termsUrl: invalidUrl })).not.toThrow()
      expect(loginLegalUrlsGet({ privacyUrl, termsUrl: invalidUrl })).toBeUndefined()
    },
  )

  test("rejects an incomplete legal pair", () => {
    expect(loginLegalUrlsGet({ privacyUrl })).toBeUndefined()
    expect(loginLegalUrlsGet({ termsUrl })).toBeUndefined()
  })
})
