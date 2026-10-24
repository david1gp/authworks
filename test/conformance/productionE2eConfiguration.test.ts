import { expect, test } from "bun:test"
import { e2eTargetBaseUrlGet } from "../../e2e/harness/e2eTargetBaseUrlGet.js"

test("target base URL prefers the orchestrator override and falls back to production", () => {
  expect(e2eTargetBaseUrlGet({})).toBe("https://authworks.contentoren.de")
  expect(e2eTargetBaseUrlGet({ AUTHWORKS_E2E_BASE_URL: "" })).toBe("https://authworks.contentoren.de")
  expect(e2eTargetBaseUrlGet({ AUTHWORKS_E2E_BASE_URL: "http://login.localhost:5190" })).toBe(
    "http://login.localhost:5190",
  )
})
